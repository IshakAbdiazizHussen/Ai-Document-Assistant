import uuid

import chromadb
import httpx
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI

from app.ai import llm, vector_store
from app.ai.embeddings import EmbeddingError
from app.ai.llm import LLMError
from app.ai.vector_store import ChunkRecord
from app.db.session import SessionLocal
from app.main import app
from app.models import ChatMessage, ChatSession, Chunk, Document, DocumentStatus
from app.services import chat_service
from tests.conftest import register_test_user


@pytest.fixture
def client():
    with TestClient(app) as c:
        register_test_user(c)
        yield c


@pytest.fixture
def created_session_ids():
    ids: list[uuid.UUID] = []
    yield ids
    if not ids:
        return
    with SessionLocal() as db:
        db.query(ChatMessage).filter(ChatMessage.session_id.in_(ids)).delete(synchronize_session=False)
        db.query(ChatSession).filter(ChatSession.id.in_(ids)).delete(synchronize_session=False)
        db.commit()


@pytest.fixture
def stub_answer_question(monkeypatch):
    """Stub out the RAG pipeline so these tests focus on session/message
    persistence and HTTP behavior -- RAG correctness itself is covered in
    test_rag.py.
    """

    def fake_answer_question(db, question, user, document_id=None, top_k=None):
        return {
            "answer": f"Stubbed answer to: {question}",
            "sources": [
                {
                    "chunk_id": "stub-chunk-1",
                    "document_id": str(document_id) if document_id else "stub-doc",
                    "excerpt": "stub excerpt",
                }
            ],
        }

    monkeypatch.setattr(chat_service, "answer_question", fake_answer_question)
    return fake_answer_question


# ---------------------------------------------------------------------------
# Session creation / reuse / ordering
# ---------------------------------------------------------------------------


def test_multi_turn_conversation_persists_and_replays_in_order(
    client, stub_answer_question, created_session_ids
):
    first = client.post("/chat", json={"message": "Hello, first question"})
    assert first.status_code == 200
    session_id = first.json()["session_id"]
    created_session_ids.append(uuid.UUID(session_id))

    second = client.post("/chat", json={"message": "Second question", "session_id": session_id})
    assert second.status_code == 200
    assert second.json()["session_id"] == session_id

    third = client.post("/chat", json={"message": "Third question", "session_id": session_id})
    assert third.status_code == 200

    history = client.get(f"/chat/{session_id}/messages")
    assert history.status_code == 200
    messages = history.json()

    assert len(messages) == 6
    assert [m["role"] for m in messages] == ["user", "assistant"] * 3
    contents = [m["content"] for m in messages]
    assert contents[0] == "Hello, first question"
    assert contents[2] == "Second question"
    assert contents[4] == "Third question"
    assert all("Stubbed answer" in contents[i] for i in (1, 3, 5))


def test_omitting_session_id_creates_new_session_each_time(
    client, stub_answer_question, created_session_ids
):
    first = client.post("/chat", json={"message": "question one"})
    second = client.post("/chat", json={"message": "question two"})

    session_1 = first.json()["session_id"]
    session_2 = second.json()["session_id"]
    created_session_ids.extend([uuid.UUID(session_1), uuid.UUID(session_2)])

    assert session_1 != session_2


def test_providing_session_id_reuses_it(client, stub_answer_question, created_session_ids):
    first = client.post("/chat", json={"message": "question one"})
    session_id = first.json()["session_id"]
    created_session_ids.append(uuid.UUID(session_id))

    second = client.post("/chat", json={"message": "question two", "session_id": session_id})
    assert second.json()["session_id"] == session_id


def test_unknown_session_id_returns_404(client):
    response = client.post("/chat", json={"message": "hi", "session_id": str(uuid.uuid4())})
    assert response.status_code == 404


def test_get_messages_for_unknown_session_returns_404(client):
    response = client.get(f"/chat/{uuid.uuid4()}/messages")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def test_blank_message_rejected_with_422(client):
    assert client.post("/chat", json={"message": "   "}).status_code == 422


def test_empty_message_rejected_with_422(client):
    assert client.post("/chat", json={"message": ""}).status_code == 422


def test_overly_long_message_rejected_with_422(client):
    assert client.post("/chat", json={"message": "a" * 5000}).status_code == 422


# ---------------------------------------------------------------------------
# Error handling: RAG pipeline failures never leak internals
# ---------------------------------------------------------------------------


def test_forced_pipeline_failure_returns_clean_error_without_leaking_internals(client, monkeypatch):
    def raise_embedding_error(db, question, user, document_id=None, top_k=None):
        raise EmbeddingError("Embedding request failed: AuthenticationError (status 401)")

    monkeypatch.setattr(chat_service, "answer_question", raise_embedding_error)

    response = client.post("/chat", json={"message": "this will fail"})

    assert response.status_code == 502
    assert "Traceback" not in response.text
    assert "AuthenticationError" not in response.text
    assert response.json()["detail"] == "The AI service is temporarily unavailable. Please try again."

    # the app keeps running afterward
    assert client.get("/health").status_code == 200


def test_session_remains_usable_after_a_pipeline_failure(
    client, stub_answer_question, created_session_ids, monkeypatch
):
    first = client.post("/chat", json={"message": "question one"})
    session_id = first.json()["session_id"]
    created_session_ids.append(uuid.UUID(session_id))

    def raise_llm_error(db, question, user, document_id=None, top_k=None):
        raise LLMError("Chat completion request failed: InternalServerError (status 500)")

    monkeypatch.setattr(chat_service, "answer_question", raise_llm_error)
    failed = client.post("/chat", json={"message": "this will fail", "session_id": session_id})
    assert failed.status_code == 502

    monkeypatch.setattr(chat_service, "answer_question", stub_answer_question)
    retried = client.post("/chat", json={"message": "retry after failure", "session_id": session_id})
    assert retried.status_code == 200
    assert retried.json()["session_id"] == session_id

    history = client.get(f"/chat/{session_id}/messages").json()
    contents = [m["content"] for m in history]
    # The failed attempt's user message really was sent, so it's persisted
    # (with no assistant reply); the retry then succeeded normally.
    assert "this will fail" in contents
    assert "retry after failure" in contents


# ---------------------------------------------------------------------------
# Full integration: sources correspond to real chunks, no cross-doc leakage
# ---------------------------------------------------------------------------


@pytest.fixture
def isolated_vector_store(tmp_path, monkeypatch):
    vc = chromadb.PersistentClient(path=str(tmp_path))
    collection = vc.get_or_create_collection(name="chunks", metadata={"hnsw:space": "cosine"})
    monkeypatch.setattr(vector_store, "_get_collection", lambda: collection)
    return collection


@pytest.fixture
def mock_chat_client(monkeypatch):
    def handler(request):
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 0,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "Real answer citing seeded content."},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    mock_client = OpenAI(api_key="sk-test", http_client=http_client, max_retries=0)
    monkeypatch.setattr(llm, "_get_client", lambda: mock_client)


@pytest.fixture
def two_seeded_documents(isolated_vector_store, client_user):
    with SessionLocal() as db:
        user_id = uuid.UUID(client_user["id"])

        doc_a = Document(
            user_id=user_id,
            filename="doc-a.txt",
            file_type="txt",
            file_size_bytes=1,
            status=DocumentStatus.READY,
            storage_path="unused",
        )
        doc_b = Document(
            user_id=user_id,
            filename="doc-b.txt",
            file_type="txt",
            file_size_bytes=1,
            status=DocumentStatus.READY,
            storage_path="unused",
        )
        db.add_all([doc_a, doc_b])
        db.commit()
        db.refresh(doc_a)
        db.refresh(doc_b)

        chunk_a = Chunk(
            document_id=doc_a.id, chunk_index=0, text="Document A real content.", token_count=4
        )
        chunk_b = Chunk(
            document_id=doc_b.id, chunk_index=0, text="Document B real content.", token_count=4
        )
        db.add_all([chunk_a, chunk_b])
        db.commit()
        db.refresh(chunk_a)
        db.refresh(chunk_b)

        doc_a_id, doc_b_id = doc_a.id, doc_b.id
        chunk_a_id, chunk_b_id = str(chunk_a.id), str(chunk_b.id)

    vector_store.add_chunks(
        str(doc_a_id),
        [
            ChunkRecord(
                chunk_id=chunk_a_id,
                chunk_index=0,
                text="Document A real content.",
                embedding=[1.0, 0.0],
                user_id=str(user_id),
            )
        ],
    )
    vector_store.add_chunks(
        str(doc_b_id),
        [
            ChunkRecord(
                chunk_id=chunk_b_id,
                chunk_index=0,
                text="Document B real content.",
                embedding=[0.0, 1.0],
                user_id=str(user_id),
            )
        ],
    )

    yield {"doc_a_id": doc_a_id, "doc_b_id": doc_b_id, "chunk_a_id": chunk_a_id, "chunk_b_id": chunk_b_id}

    with SessionLocal() as db:
        db.query(Chunk).filter(Chunk.document_id.in_([doc_a_id, doc_b_id])).delete(
            synchronize_session=False
        )
        db.query(Document).filter(Document.id.in_([doc_a_id, doc_b_id])).delete(synchronize_session=False)
        db.commit()


def test_sources_correspond_to_real_chunks_in_the_database(
    client, two_seeded_documents, mock_chat_client, monkeypatch, created_session_ids
):
    monkeypatch.setattr(chat_service, "embed_texts", lambda texts: [[1.0, 0.0] for _ in texts])

    response = client.post(
        "/chat",
        json={
            "message": "What does document A say?",
            "document_id": str(two_seeded_documents["doc_a_id"]),
        },
    )
    assert response.status_code == 200
    body = response.json()
    created_session_ids.append(uuid.UUID(body["session_id"]))

    returned_chunk_ids = {source["chunk_id"] for source in body["sources"]}
    assert two_seeded_documents["chunk_a_id"] in returned_chunk_ids

    with SessionLocal() as db:
        matching = db.query(Chunk).filter(Chunk.id == uuid.UUID(two_seeded_documents["chunk_a_id"])).first()
        assert matching is not None
        assert matching.document_id == two_seeded_documents["doc_a_id"]


def test_document_scoped_chat_never_leaks_other_documents_sources(
    client, two_seeded_documents, mock_chat_client, monkeypatch, created_session_ids
):
    # Question embedding is closest to docA's content globally, but we
    # scope the request to docB -- docA's chunk must never appear.
    monkeypatch.setattr(chat_service, "embed_texts", lambda texts: [[1.0, 0.0] for _ in texts])

    response = client.post(
        "/chat",
        json={
            "message": "What does document A say?",
            "document_id": str(two_seeded_documents["doc_b_id"]),
        },
    )
    assert response.status_code == 200
    body = response.json()
    created_session_ids.append(uuid.UUID(body["session_id"]))

    for source in body["sources"]:
        assert source["document_id"] == str(two_seeded_documents["doc_b_id"])
    assert not any(
        source["chunk_id"] == two_seeded_documents["chunk_a_id"] for source in body["sources"]
    )
