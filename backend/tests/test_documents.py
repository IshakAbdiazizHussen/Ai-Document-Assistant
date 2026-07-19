import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import SessionLocal
from app.main import app
from app.models import Document
from app.services import document_service
from app.utils import file_validation


@pytest.fixture
def tmp_settings(tmp_path, monkeypatch):
    settings = Settings(upload_dir=str(tmp_path), max_upload_size_bytes=1024)
    monkeypatch.setattr(document_service, "get_settings", lambda: settings)
    monkeypatch.setattr(file_validation, "get_settings", lambda: settings)
    return settings


@pytest.fixture
def uploaded_ids():
    ids: list[str] = []
    yield ids
    if not ids:
        return
    with SessionLocal() as db:
        docs = db.query(Document).filter(Document.id.in_(ids)).all()
        for doc in docs:
            db.delete(doc)
        db.commit()


@pytest.fixture
def client(tmp_settings):
    with TestClient(app) as c:
        yield c


def _upload(client, filename: str, content: bytes, content_type: str):
    return client.post(
        "/documents/upload",
        files={"file": (filename, content, content_type)},
    )


def test_upload_valid_pdf(client, uploaded_ids):
    response = _upload(client, "report.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")
    assert response.status_code == 201
    body = response.json()
    uploaded_ids.append(body["id"])
    assert body["filename"] == "report.pdf"
    assert body["status"] == "processing"
    assert "created_at" in body


def test_upload_valid_docx(client, uploaded_ids):
    response = _upload(
        client,
        "notes.docx",
        b"fake docx content",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert response.status_code == 201
    body = response.json()
    uploaded_ids.append(body["id"])
    assert body["filename"] == "notes.docx"
    assert body["status"] == "processing"


def test_upload_valid_txt(client, uploaded_ids):
    response = _upload(client, "readme.txt", b"hello world", "text/plain")
    assert response.status_code == 201
    body = response.json()
    uploaded_ids.append(body["id"])
    assert body["filename"] == "readme.txt"
    assert body["status"] == "processing"


def test_upload_invalid_extension_rejected(client):
    response = _upload(client, "malware.exe", b"MZ fake exe", "application/octet-stream")
    assert response.status_code == 400
    assert "storage" not in response.text.lower()


def test_upload_spoofed_content_type_rejected(client):
    # Extension is allow-listed but the declared content-type doesn't match it.
    response = _upload(client, "note.txt", b"hello", "application/x-msdownload")
    assert response.status_code == 400


def test_upload_oversized_file_rejected(client, tmp_settings):
    oversized_content = b"a" * (tmp_settings.max_upload_size_bytes + 1)
    response = _upload(client, "big.txt", oversized_content, "text/plain")
    assert response.status_code == 413


def test_list_documents_includes_uploaded_file(client, uploaded_ids):
    upload_response = _upload(client, "list-me.txt", b"content", "text/plain")
    document_id = upload_response.json()["id"]
    uploaded_ids.append(document_id)

    list_response = client.get("/documents")
    assert list_response.status_code == 200
    ids = [item["id"] for item in list_response.json()]
    assert document_id in ids


def test_get_document_returns_full_row(client, uploaded_ids):
    upload_response = _upload(client, "detail-me.txt", b"content", "text/plain")
    document_id = upload_response.json()["id"]
    uploaded_ids.append(document_id)

    detail_response = client.get(f"/documents/{document_id}")
    assert detail_response.status_code == 200
    body = detail_response.json()
    assert body["id"] == document_id
    assert body["filename"] == "detail-me.txt"
    assert body["file_type"] == "txt"
    assert body["file_size_bytes"] == len(b"content")
    assert body["status"] == "processing"


def test_get_document_unknown_id_returns_404(client):
    response = client.get(f"/documents/{uuid.uuid4()}")
    assert response.status_code == 404


def test_delete_document_removes_file_and_row(client, tmp_settings):
    upload_response = _upload(client, "delete-me.txt", b"content", "text/plain")
    document_id = upload_response.json()["id"]

    upload_dir = Path(tmp_settings.upload_dir)
    storage_files_before = list(upload_dir.iterdir())
    assert len(storage_files_before) == 1

    delete_response = client.delete(f"/documents/{document_id}")
    assert delete_response.status_code == 204

    storage_files_after = list(upload_dir.iterdir())
    assert len(storage_files_after) == 0

    get_after_delete = client.get(f"/documents/{document_id}")
    assert get_after_delete.status_code == 404


def test_delete_unknown_id_returns_404(client):
    response = client.delete(f"/documents/{uuid.uuid4()}")
    assert response.status_code == 404
