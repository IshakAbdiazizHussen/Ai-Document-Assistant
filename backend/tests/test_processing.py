import shutil
import uuid
from pathlib import Path

import pytest
import tiktoken
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import SessionLocal
from app.main import app
from app.models import Chunk, Document, DocumentStatus, User
from app.processing.chunker import chunk_text, count_tokens
from app.processing.cleaner import clean_text
from app.processing.extractor import ExtractionError, extract_text
from app.services import document_service
from app.services.document_service import DEFAULT_USER_EMAIL, process_document
from app.utils import file_validation

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _no_real_embedding_calls(monkeypatch):
    # These tests exercise extraction/chunking, not embeddings (Feature 4).
    # Stub out process_document()'s embed_texts() call so this file never
    # makes a real network call to OpenAI.
    monkeypatch.setattr(document_service, "embed_texts", lambda texts: [[0.0] for _ in texts])


# ---------------------------------------------------------------------------
# Extractor
# ---------------------------------------------------------------------------


def test_extract_pdf_produces_readable_text():
    text = extract_text(str(FIXTURES_DIR / "sample.pdf"), "pdf")
    assert len(text.strip()) > 0
    assert "AI Document Assistant" in text


def test_extract_docx_matches_source_content():
    text = extract_text(str(FIXTURES_DIR / "sample.docx"), "docx")
    assert "DISTINCTIVE_MARKER_SENTENCE" in text


def test_extract_txt_produces_readable_text():
    text = extract_text(str(FIXTURES_DIR / "sample.txt"), "txt")
    assert "DISTINCTIVE_TXT_MARKER" in text


def test_extract_corrupted_pdf_raises_extraction_error():
    with pytest.raises(ExtractionError):
        extract_text(str(FIXTURES_DIR / "corrupted.pdf"), "pdf")


def test_extract_unsupported_file_type_raises_extraction_error():
    with pytest.raises(ExtractionError):
        extract_text(str(FIXTURES_DIR / "sample.txt"), "exe")


# ---------------------------------------------------------------------------
# Cleaner
# ---------------------------------------------------------------------------


def test_clean_text_collapses_whitespace_and_blank_lines():
    raw = "Hello   World\t\t!\n\n\n\nSecond   line.  \n\n\n"
    cleaned = clean_text(raw)
    assert "   " not in cleaned
    assert "\n\n\n" not in cleaned
    assert cleaned == cleaned.strip()


def test_clean_text_strips_control_characters():
    raw = "Hello\x00World\x07!"
    cleaned = clean_text(raw)
    assert "\x00" not in cleaned
    assert "\x07" not in cleaned


# ---------------------------------------------------------------------------
# Chunker
# ---------------------------------------------------------------------------


def test_chunk_text_respects_size_and_has_exact_token_overlap():
    text = " ".join(f"word{i}" for i in range(500))
    chunk_size, overlap = 50, 10
    chunks = chunk_text(text, chunk_size_tokens=chunk_size, overlap_tokens=overlap)
    assert len(chunks) > 1

    for chunk in chunks:
        assert count_tokens(chunk) <= chunk_size

    encoding = tiktoken.get_encoding("cl100k_base")
    first_tokens = encoding.encode(chunks[0])
    second_tokens = encoding.encode(chunks[1])
    assert first_tokens[-overlap:] == second_tokens[:overlap]


def test_chunk_text_empty_string_returns_no_chunks():
    assert chunk_text("", chunk_size_tokens=50, overlap_tokens=10) == []


def test_chunk_text_invalid_overlap_raises():
    with pytest.raises(ValueError):
        chunk_text("some text", chunk_size_tokens=10, overlap_tokens=10)


# ---------------------------------------------------------------------------
# process_document (DB-level integration)
# ---------------------------------------------------------------------------


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def created_document_ids():
    ids: list[uuid.UUID] = []
    yield ids
    if not ids:
        return
    with SessionLocal() as cleanup_db:
        cleanup_db.query(Chunk).filter(Chunk.document_id.in_(ids)).delete(synchronize_session=False)
        cleanup_db.query(Document).filter(Document.id.in_(ids)).delete(synchronize_session=False)
        cleanup_db.commit()


def _make_document(db, tmp_path: Path, fixture_name: str, file_type: str) -> Document:
    dest = tmp_path / fixture_name
    shutil.copy(FIXTURES_DIR / fixture_name, dest)

    user = db.query(User).filter(User.email == DEFAULT_USER_EMAIL).first()
    if user is None:
        user = User(email=DEFAULT_USER_EMAIL)
        db.add(user)
        db.commit()
        db.refresh(user)

    document = Document(
        user_id=user.id,
        filename=fixture_name,
        file_type=file_type,
        file_size_bytes=dest.stat().st_size,
        status=DocumentStatus.PROCESSING,
        storage_path=str(dest),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def test_process_multipage_pdf_becomes_ready_with_multiple_chunks(db, tmp_path, created_document_ids):
    document = _make_document(db, tmp_path, "sample.pdf", "pdf")
    created_document_ids.append(document.id)

    result = process_document(db, document.id)

    assert result.status == DocumentStatus.READY
    assert result.error_message is None
    chunks = (
        db.query(Chunk).filter(Chunk.document_id == document.id).order_by(Chunk.chunk_index).all()
    )
    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk.vector_id is None
        assert 0 < chunk.token_count <= 800


def test_process_docx_extracts_correct_content(db, tmp_path, created_document_ids):
    document = _make_document(db, tmp_path, "sample.docx", "docx")
    created_document_ids.append(document.id)

    result = process_document(db, document.id)

    assert result.status == DocumentStatus.READY
    chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
    assert any("DISTINCTIVE_MARKER_SENTENCE" in chunk.text for chunk in chunks)


def test_process_txt_chunks_correctly(db, tmp_path, created_document_ids):
    document = _make_document(db, tmp_path, "sample.txt", "txt")
    created_document_ids.append(document.id)

    result = process_document(db, document.id)

    assert result.status == DocumentStatus.READY
    chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
    assert len(chunks) >= 1
    assert any("DISTINCTIVE_TXT_MARKER" in chunk.text for chunk in chunks)


def test_process_corrupted_pdf_marks_failed_without_crashing(db, tmp_path, created_document_ids):
    document = _make_document(db, tmp_path, "corrupted.pdf", "pdf")
    created_document_ids.append(document.id)

    result = process_document(db, document.id)  # must not raise

    assert result.status == DocumentStatus.FAILED
    assert result.error_message
    chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
    assert len(chunks) == 0


# ---------------------------------------------------------------------------
# Full route: upload -> process, end to end
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_upload_settings(tmp_path, monkeypatch):
    settings = Settings(upload_dir=str(tmp_path), max_upload_size_bytes=20 * 1024 * 1024)
    monkeypatch.setattr(document_service, "get_settings", lambda: settings)
    monkeypatch.setattr(file_validation, "get_settings", lambda: settings)
    return settings


def test_upload_route_processes_pdf_to_ready(tmp_upload_settings, created_document_ids):
    with TestClient(app) as client, open(FIXTURES_DIR / "sample.pdf", "rb") as pdf_file:
        response = client.post(
            "/documents/upload",
            files={"file": ("sample.pdf", pdf_file, "application/pdf")},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "processing"  # response snapshot, per Feature 2's contract
    document_id = uuid.UUID(body["id"])
    created_document_ids.append(document_id)

    with SessionLocal() as db:
        document = db.get(Document, document_id)
        assert document.status == DocumentStatus.READY
        chunks = db.query(Chunk).filter(Chunk.document_id == document_id).all()
        assert len(chunks) > 1
