import json
import uuid

import chromadb
import httpx
import pytest
from openai import OpenAI

from app.ai import llm, vector_store
from app.ai.llm import LLMError
from app.ai.vector_store import ChunkRecord
from app.db.session import SessionLocal
from app.models import Document, DocumentStatus
from app.services import chat_service
from app.services.document_service import DocumentNotFoundError
from tests.conftest import make_user

PARIS_TEXT = "The capital of France is Paris, a major European city."
PYTHON_TEXT = "Python is a programming language created by Guido van Rossum in 1991."
DOCKER_TEXT = "Docker containers provide lightweight OS-level virtualization."

# Deterministic stand-ins for real question embeddings, keyed by question
# text, so retrieval ranking is exact and reproducible without a real call.
QUESTION_EMBEDDINGS = {
    "What is the capital of France?": [0.99, 0.01, 0.0],
    "What is the airspeed velocity of an unladen swallow?": [0.3, 0.3, 0.3],
}


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def isolated_vector_store(tmp_path, monkeypatch):
    client = chromadb.PersistentClient(path=str(tmp_path))
    collection = client.get_or_create_collection(name="chunks", metadata={"hnsw:space": "cosine"})
    monkeypatch.setattr(vector_store, "_get_collection", lambda: collection)
    return collection


@pytest.fixture
def fake_question_embeddings(monkeypatch):
    def fake_embed_texts(texts):
        return [QUESTION_EMBEDDINGS.get(text, [0.0, 0.0, 0.0]) for text in texts]

    monkeypatch.setattr(chat_service, "embed_texts", fake_embed_texts)


@pytest.fixture
def mock_chat_client(monkeypatch):
    # Stands in for the real model: it only "knows" what's in the context
    # message it's given, so this genuinely tests whether our retrieval and
    # prompt construction hand the model the right (or correctly absent)
    # information -- not the real model's reasoning quality.
    def handler(request):
        body = json.loads(request.content)
        messages = body["messages"]
        context_text = messages[1]["content"].lower()
        question_text = messages[-1]["content"].lower()

        if "paris" in context_text and "france" in question_text:
            content = "According to the documents, the capital of France is Paris."
        elif "guido van rossum" in context_text and "python" in question_text:
            content = "Python was created by Guido van Rossum, according to the documents."
        else:
            content = "The information is not available in the provided documents."

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
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = OpenAI(api_key="sk-test", http_client=http_client, max_retries=0)
    monkeypatch.setattr(llm, "_get_client", lambda: client)


@pytest.fixture
def seeded_documents(isolated_vector_store):
    """Two real Document rows with chunks seeded directly into the isolated
    vector store: docA (Paris, Python) and docB (Docker only).
    """
    with SessionLocal() as setup_db:
        user = make_user(setup_db)

        doc_a = Document(
            user_id=user.id,
            filename="doc-a.txt",
            file_type="txt",
            file_size_bytes=1,
            status=DocumentStatus.READY,
            storage_path="unused",
        )
        doc_b = Document(
            user_id=user.id,
            filename="doc-b.txt",
            file_type="txt",
            file_size_bytes=1,
            status=DocumentStatus.READY,
            storage_path="unused",
        )
        setup_db.add_all([doc_a, doc_b])
        setup_db.commit()
        setup_db.refresh(doc_a)
        setup_db.refresh(doc_b)
        doc_a_id, doc_b_id = doc_a.id, doc_b.id
        user_id = str(user.id)

    vector_store.add_chunks(
        str(doc_a_id),
        [
            ChunkRecord(
                chunk_id="chunk-paris",
                chunk_index=0,
                text=PARIS_TEXT,
                embedding=[1.0, 0.0, 0.0],
                user_id=user_id,
            ),
            ChunkRecord(
                chunk_id="chunk-python",
                chunk_index=1,
                text=PYTHON_TEXT,
                embedding=[0.0, 1.0, 0.0],
                user_id=user_id,
            ),
        ],
    )
    vector_store.add_chunks(
        str(doc_b_id),
        [
            ChunkRecord(
                chunk_id="chunk-docker",
                chunk_index=0,
                text=DOCKER_TEXT,
                embedding=[0.0, 0.0, 1.0],
                user_id=user_id,
            )
        ],
    )

    yield user, doc_a_id, doc_b_id

    with SessionLocal() as cleanup_db:
        cleanup_db.query(Document).filter(Document.id.in_([doc_a_id, doc_b_id])).delete(
            synchronize_session=False
        )
        cleanup_db.commit()


def test_known_answer_question_returns_correct_source_cited_answer(
    db, seeded_documents, fake_question_embeddings, mock_chat_client
):
    user, _doc_a_id, _doc_b_id = seeded_documents
    result = chat_service.answer_question(db, "What is the capital of France?", user)

    assert "Paris" in result["answer"]
    source_chunk_ids = {source["chunk_id"] for source in result["sources"]}
    assert "chunk-paris" in source_chunk_ids


def test_out_of_scope_question_declines_without_fabricating(
    db, seeded_documents, fake_question_embeddings, mock_chat_client
):
    user, _doc_a_id, _doc_b_id = seeded_documents
    result = chat_service.answer_question(
        db, "What is the airspeed velocity of an unladen swallow?", user
    )

    assert "not available" in result["answer"].lower()
    # Must not fabricate any specific fact that was never actually asked about.
    assert "paris" not in result["answer"].lower()
    assert "guido" not in result["answer"].lower()
    assert "docker" not in result["answer"].lower()


def test_document_scoped_question_never_leaks_other_documents_sources(
    db, seeded_documents, fake_question_embeddings, mock_chat_client
):
    user, doc_a_id, doc_b_id = seeded_documents

    # Ask a France question but scope retrieval to docB, which only has
    # Docker content. Regardless of docA's Paris chunk being the globally
    # closer match, it must never appear in the returned sources.
    result = chat_service.answer_question(
        db, "What is the capital of France?", user, document_id=doc_b_id
    )

    for source in result["sources"]:
        assert source["document_id"] == str(doc_b_id)
    assert not any(source["chunk_id"] == "chunk-paris" for source in result["sources"])
    assert "paris" not in result["answer"].lower()


def test_document_scoped_question_raises_for_unknown_document(
    db, seeded_documents, fake_question_embeddings, mock_chat_client
):
    user, _doc_a_id, _doc_b_id = seeded_documents
    with pytest.raises(DocumentNotFoundError):
        chat_service.answer_question(
            db, "What is the capital of France?", user, document_id=uuid.uuid4()
        )


def test_empty_retrieval_still_returns_graceful_response(
    db, isolated_vector_store, fake_question_embeddings, mock_chat_client
):
    # Nothing seeded at all -- retrieval finds no chunks whatsoever.
    user = make_user(db)
    result = chat_service.answer_question(db, "What is the capital of France?", user)

    assert result["sources"] == []
    assert "not available" in result["answer"].lower()


def test_generate_answer_wraps_failure_without_leaking_key(monkeypatch):
    fake_key = "sk-test-FAKE-KEY-should-never-leak-99999"

    def handler(request):
        return httpx.Response(500, json={"error": {"message": f"Internal error, key was {fake_key}"}})

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = OpenAI(api_key=fake_key, http_client=http_client, max_retries=0)
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(LLMError) as exc_info:
        llm.generate_answer("some question", [])

    assert fake_key not in str(exc_info.value)
