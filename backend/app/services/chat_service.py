import uuid

from sqlalchemy.orm import Session

from app.ai import vector_store
from app.ai.embeddings import embed_texts
from app.ai.llm import generate_answer
from app.core.config import get_settings
from app.services.document_service import get_document

_EXCERPT_MAX_LENGTH = 300


def answer_question(
    db: Session,
    question: str,
    document_id: uuid.UUID | str | None = None,
    top_k: int | None = None,
) -> dict:
    """Answer a question via RAG: embed it, retrieve the most similar
    chunks (optionally scoped to one document), and generate a grounded
    answer from only those chunks.

    Raises DocumentNotFoundError if document_id is given but doesn't exist.
    """
    if document_id is not None:
        document_id = uuid.UUID(str(document_id))
        get_document(db, document_id)  # raises DocumentNotFoundError if missing

    settings = get_settings()
    k = top_k if top_k is not None else settings.retrieval_top_k

    [question_embedding] = embed_texts([question])
    retrieved_chunks = vector_store.query(
        question_embedding,
        top_k=k,
        document_id=str(document_id) if document_id is not None else None,
    )

    answer = generate_answer(question, retrieved_chunks)

    sources = [
        {
            "chunk_id": chunk.chunk_id,
            "document_id": chunk.document_id,
            "excerpt": _excerpt(chunk.text),
        }
        for chunk in retrieved_chunks
    ]

    return {"answer": answer, "sources": sources}


def _excerpt(text: str) -> str:
    if len(text) <= _EXCERPT_MAX_LENGTH:
        return text
    return text[:_EXCERPT_MAX_LENGTH].rstrip() + "..."
