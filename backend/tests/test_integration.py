"""Feature 8: one full-stack test exercising upload -> process -> embed ->
store -> chat entirely through the FastAPI TestClient, with every OpenAI
call mocked so it's deterministic and makes no real network request.
"""

import json
import uuid
from pathlib import Path

import chromadb
import httpx
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI

from app.ai import llm, vector_store
from app.core.config import Settings
from app.db.session import SessionLocal
from app.main import app
from app.models import ChatMessage, ChatSession, Chunk, Document
from app.services import chat_service, document_service
from app.utils import file_validation
from tests.conftest import register_test_user

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def isolated_settings(tmp_path, monkeypatch):
    settings = Settings(
        upload_dir=str(tmp_path / "uploads"),
        chroma_persist_dir=str(tmp_path / "chroma"),
        max_upload_size_bytes=20 * 1024 * 1024,
    )
    monkeypatch.setattr(document_service, "get_settings", lambda: settings)
    monkeypatch.setattr(file_validation, "get_settings", lambda: settings)
    return settings


@pytest.fixture
def isolated_vector_store(isolated_settings, monkeypatch):
    vc = chromadb.PersistentClient(path=isolated_settings.chroma_persist_dir)
    collection = vc.get_or_create_collection(name="chunks", metadata={"hnsw:space": "cosine"})
    monkeypatch.setattr(vector_store, "_get_collection", lambda: collection)
    return collection


@pytest.fixture
def fake_embeddings(monkeypatch):
    # Every text (chunks and questions alike) embeds to the same vector, so
    # retrieval always finds the uploaded document's chunks -- this test is
    # about proving the full stack is wired correctly end to end, not
    # re-testing ranking precision (covered in test_vector_store.py).
    fake = lambda texts: [[1.0, 0.0, 0.0] for _ in texts]  # noqa: E731
    monkeypatch.setattr(document_service, "embed_texts", fake)
    monkeypatch.setattr(chat_service, "embed_texts", fake)


@pytest.fixture
def mock_chat_client(monkeypatch):
    # Stands in for the real model: only "knows" what's actually in the
    # context message it receives, so a correct answer here proves
    # retrieval genuinely surfaced the uploaded document's real content.
    def handler(request):
        body = json.loads(request.content)
        context_text = body["messages"][1]["content"].lower()
        question_text = body["messages"][-1]["content"].lower()

        if "ai document assistant" in context_text and "assistant" in question_text:
            content = (
                "According to the document, the AI Document Assistant lets a user "
                "upload documents and converse with an assistant that answers "
                "questions grounded in that content."
            )
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
                    {"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = OpenAI(api_key="sk-test", http_client=http_client, max_retries=0)
    monkeypatch.setattr(llm, "_get_client", lambda: client)


@pytest.fixture
def client():
    with TestClient(app) as c:
        register_test_user(c)
        yield c


def test_full_upload_process_chat_round_trip(
    client, isolated_settings, isolated_vector_store, fake_embeddings, mock_chat_client
):
    document_id = None
    session_id = None
    try:
        # 1. Upload a real fixture file through the actual route.
        with open(FIXTURES_DIR / "sample.pdf", "rb") as pdf_file:
            upload_response = client.post(
                "/documents/upload",
                files={"file": ("sample.pdf", pdf_file, "application/pdf")},
            )
        assert upload_response.status_code == 201
        upload_body = upload_response.json()
        document_id = upload_body["id"]
        assert upload_body["status"] == "processing"

        # 2. Processing already ran synchronously during upload (Feature 3) --
        # confirm it actually reached "ready" with real chunk rows and vector_ids.
        detail_response = client.get(f"/documents/{document_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["status"] == "ready"

        with SessionLocal() as db:
            chunks = db.query(Chunk).filter(Chunk.document_id == uuid.UUID(document_id)).all()
            assert len(chunks) > 0
            assert all(chunk.vector_id is not None for chunk in chunks)

        # 3. Ask a real question through the actual chat endpoint, scoped to
        # this document.
        chat_response = client.post(
            "/chat",
            json={
                "message": "What does this assistant let a user do?",
                "document_id": document_id,
            },
        )
        assert chat_response.status_code == 200
        chat_body = chat_response.json()
        session_id = chat_body["session_id"]

        assert "upload documents" in chat_body["answer"].lower()
        assert len(chat_body["sources"]) > 0
        for source in chat_body["sources"]:
            assert source["document_id"] == document_id

        # 4. Source chunk_ids returned actually exist in the chunks table.
        returned_chunk_ids = {uuid.UUID(source["chunk_id"]) for source in chat_body["sources"]}
        with SessionLocal() as db:
            real_ids = {
                chunk.id
                for chunk in db.query(Chunk).filter(Chunk.id.in_(returned_chunk_ids)).all()
            }
        assert returned_chunk_ids == real_ids

        # 5. History persists and replays correctly.
        history_response = client.get(f"/chat/{session_id}/messages")
        assert history_response.status_code == 200
        messages = history_response.json()
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["source_chunk_ids"] == [source["chunk_id"] for source in chat_body["sources"]]

    finally:
        # Nothing should be left behind: delete the document (removes the
        # DB row, the uploaded file, and its vectors) and the chat session.
        if document_id is not None:
            delete_response = client.delete(f"/documents/{document_id}")
            assert delete_response.status_code in (204, 404)
        if session_id is not None:
            with SessionLocal() as db:
                db.query(ChatMessage).filter(ChatMessage.session_id == uuid.UUID(session_id)).delete()
                db.query(ChatSession).filter(ChatSession.id == uuid.UUID(session_id)).delete()
                db.commit()


def test_no_residual_files_or_rows_after_the_round_trip(
    client, isolated_settings, isolated_vector_store, fake_embeddings, mock_chat_client
):
    upload_dir = Path(isolated_settings.upload_dir)

    with open(FIXTURES_DIR / "sample.txt", "rb") as txt_file:
        upload_response = client.post(
            "/documents/upload", files={"file": ("sample.txt", txt_file, "text/plain")}
        )
    document_id = upload_response.json()["id"]

    assert len(list(upload_dir.iterdir())) == 1

    delete_response = client.delete(f"/documents/{document_id}")
    assert delete_response.status_code == 204

    assert list(upload_dir.iterdir()) == []
    with SessionLocal() as db:
        assert db.query(Document).filter(Document.id == uuid.UUID(document_id)).first() is None
        assert db.query(Chunk).filter(Chunk.document_id == uuid.UUID(document_id)).count() == 0
