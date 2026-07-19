import shutil
from pathlib import Path

import chromadb
import pytest

from app.ai import vector_store
from app.ai.vector_store import ChunkRecord, VectorStoreError, add_chunks, delete_document, query
from app.db.session import SessionLocal
from app.models import Chunk, Document, DocumentStatus, User
from app.services import document_service
from app.services.document_service import DEFAULT_USER_EMAIL, process_document

FIXTURES_DIR = Path(__file__).parent / "fixtures"

CHUNK_CATS = ChunkRecord(
    chunk_id="chunk-cats",
    chunk_index=0,
    text="Cats are independent pets that groom themselves.",
    embedding=[1.0, 0.0, 0.0],
)
CHUNK_FINANCE = ChunkRecord(
    chunk_id="chunk-finance",
    chunk_index=1,
    text="The stock market dropped sharply amid inflation fears.",
    embedding=[0.0, 1.0, 0.0],
)
CHUNK_DOGS = ChunkRecord(
    chunk_id="chunk-dogs",
    chunk_index=2,
    text="Dogs are loyal companions that need daily walks.",
    embedding=[0.0, 0.0, 1.0],
)


@pytest.fixture
def isolated_vector_store(tmp_path, monkeypatch):
    # A fresh, temp-directory-backed collection per test so runs never
    # touch (or depend on) the real chroma_persist_dir.
    client = chromadb.PersistentClient(path=str(tmp_path))
    collection = client.get_or_create_collection(name="chunks", metadata={"hnsw:space": "cosine"})
    monkeypatch.setattr(vector_store, "_get_collection", lambda: collection)
    return collection


def test_query_ranks_relevant_chunk_highest(isolated_vector_store):
    add_chunks("docA", [CHUNK_CATS, CHUNK_FINANCE, CHUNK_DOGS])

    results = query([0.95, 0.05, 0.0], top_k=3)

    assert results[0].chunk_id == "chunk-cats"
    assert results[0].score > results[1].score > results[2].score


def test_query_filtered_by_document_id_excludes_other_documents(isolated_vector_store):
    add_chunks("docA", [CHUNK_CATS])
    add_chunks("docB", [CHUNK_FINANCE])

    results = query([1.0, 0.0, 0.0], top_k=5, document_id="docA")

    assert len(results) == 1
    assert results[0].chunk_id == "chunk-cats"
    assert all(result.document_id == "docA" for result in results)


def test_delete_document_removes_vectors_verified_by_query(isolated_vector_store):
    add_chunks("docA", [CHUNK_CATS, CHUNK_DOGS])
    add_chunks("docB", [CHUNK_FINANCE])

    delete_document("docA")

    remaining = query([1.0, 0.0, 0.0], top_k=10)
    remaining_ids = {result.chunk_id for result in remaining}
    assert "chunk-cats" not in remaining_ids
    assert "chunk-dogs" not in remaining_ids

    doc_a_scoped = query([1.0, 0.0, 0.0], top_k=10, document_id="docA")
    assert doc_a_scoped == []

    doc_b_scoped = query([0.0, 1.0, 0.0], top_k=10, document_id="docB")
    assert len(doc_b_scoped) == 1
    assert doc_b_scoped[0].chunk_id == "chunk-finance"


def test_add_chunks_empty_list_is_noop(isolated_vector_store):
    assert add_chunks("docA", []) == []
    assert isolated_vector_store.count() == 0


def test_repeated_upload_delete_cycles_leave_no_orphaned_vectors(isolated_vector_store):
    for i in range(3):
        doc_id = f"doc-cycle-{i}"
        add_chunks(
            doc_id,
            [
                ChunkRecord(chunk_id=f"chunk-{i}-a", chunk_index=0, text="a", embedding=[1.0, 0.0, 0.0]),
                ChunkRecord(chunk_id=f"chunk-{i}-b", chunk_index=1, text="b", embedding=[0.0, 1.0, 0.0]),
            ],
        )
        assert isolated_vector_store.count() == 2

        delete_document(doc_id)
        assert isolated_vector_store.count() == 0


def test_add_chunks_wraps_failure_as_vector_store_error(monkeypatch):
    def _broken_collection():
        raise RuntimeError("simulated chromadb failure")

    monkeypatch.setattr(vector_store, "_get_collection", _broken_collection)

    with pytest.raises(VectorStoreError):
        add_chunks("docA", [CHUNK_CATS])


def test_query_wraps_failure_as_vector_store_error(monkeypatch):
    def _broken_collection():
        raise RuntimeError("simulated chromadb failure")

    monkeypatch.setattr(vector_store, "_get_collection", _broken_collection)

    with pytest.raises(VectorStoreError):
        query([1.0, 0.0, 0.0])


def test_delete_document_wraps_failure_as_vector_store_error(monkeypatch):
    def _broken_collection():
        raise RuntimeError("simulated chromadb failure")

    monkeypatch.setattr(vector_store, "_get_collection", _broken_collection)

    with pytest.raises(VectorStoreError):
        delete_document("docA")


# ---------------------------------------------------------------------------
# Full integration: upload -> process -> embed -> store -> searchable
# ---------------------------------------------------------------------------


def test_process_document_end_to_end_populates_vector_id_and_is_searchable(
    isolated_vector_store, tmp_path, monkeypatch
):
    # Deterministic fake embeddings so the query assertion below is exact,
    # without depending on a real OpenAI call.
    monkeypatch.setattr(document_service, "embed_texts", lambda texts: [[1.0, 0.0, 0.0] for _ in texts])

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == DEFAULT_USER_EMAIL).first()
        if user is None:
            user = User(email=DEFAULT_USER_EMAIL)
            db.add(user)
            db.commit()
            db.refresh(user)

        dest = tmp_path / "sample.txt"
        shutil.copy(FIXTURES_DIR / "sample.txt", dest)

        document = Document(
            user_id=user.id,
            filename="sample.txt",
            file_type="txt",
            file_size_bytes=dest.stat().st_size,
            status=DocumentStatus.PROCESSING,
            storage_path=str(dest),
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        try:
            result = process_document(db, document.id)
            assert result.status == DocumentStatus.READY

            chunks = (
                db.query(Chunk)
                .filter(Chunk.document_id == document.id)
                .order_by(Chunk.chunk_index)
                .all()
            )
            assert len(chunks) >= 1
            assert all(chunk.vector_id is not None for chunk in chunks)

            search_results = query([1.0, 0.0, 0.0], top_k=5, document_id=str(document.id))
            found_ids = {result.chunk_id for result in search_results}
            assert {chunk.vector_id for chunk in chunks} <= found_ids
        finally:
            db.query(Chunk).filter(Chunk.document_id == document.id).delete()
            db.delete(document)
            db.commit()
