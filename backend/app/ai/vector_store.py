from dataclasses import dataclass
from functools import lru_cache

import chromadb

from app.core.config import get_settings

_COLLECTION_NAME = "chunks"


class VectorStoreError(Exception):
    """Raised when a ChromaDB operation fails."""


@dataclass
class ChunkRecord:
    chunk_id: str
    chunk_index: int
    text: str
    embedding: list[float]


@dataclass
class SearchResult:
    chunk_id: str
    document_id: str
    text: str
    score: float


@lru_cache
def _get_collection():
    # Centralized client construction: this is the only module that imports
    # chromadb. Cosine space matches OpenAI's normalized embeddings, so
    # `score` below is a true cosine-similarity value (1.0 = identical).
    settings = get_settings()
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return client.get_or_create_collection(name=_COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


def add_chunks(document_id: str, chunk_records: list[ChunkRecord]) -> list[str]:
    """Store chunk embeddings tagged with document_id/chunk_index metadata.
    Returns the vector-store IDs, one per input record, in the same order.
    """
    if not chunk_records:
        return []

    try:
        collection = _get_collection()
        collection.add(
            ids=[record.chunk_id for record in chunk_records],
            embeddings=[record.embedding for record in chunk_records],
            documents=[record.text for record in chunk_records],
            metadatas=[
                {"document_id": str(document_id), "chunk_index": record.chunk_index}
                for record in chunk_records
            ],
        )
    except Exception as exc:
        raise VectorStoreError(f"Failed to store chunk embeddings: {type(exc).__name__}") from exc

    return [record.chunk_id for record in chunk_records]


def query(embedding: list[float], top_k: int = 5, document_id: str | None = None) -> list[SearchResult]:
    """Return the top_k most similar chunks, optionally scoped to one document."""
    try:
        collection = _get_collection()
        where = {"document_id": str(document_id)} if document_id is not None else None
        result = collection.query(query_embeddings=[embedding], n_results=top_k, where=where)
    except Exception as exc:
        raise VectorStoreError(f"Failed to query embeddings: {type(exc).__name__}") from exc

    ids = result["ids"][0] if result["ids"] else []
    documents = result["documents"][0] if result["documents"] else []
    metadatas = result["metadatas"][0] if result["metadatas"] else []
    distances = result["distances"][0] if result["distances"] else []

    return [
        SearchResult(
            chunk_id=chunk_id,
            document_id=str(metadata.get("document_id", "")),
            text=text,
            score=1.0 - distance,
        )
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances)
    ]


def delete_document(document_id: str) -> None:
    """Remove every stored vector belonging to a document."""
    try:
        collection = _get_collection()
        collection.delete(where={"document_id": str(document_id)})
    except Exception as exc:
        raise VectorStoreError(f"Failed to delete document vectors: {type(exc).__name__}") from exc
