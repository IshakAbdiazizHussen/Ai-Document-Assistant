import uuid

from sqlalchemy.orm import Session

from app.ai import vector_store
from app.ai.embeddings import embed_texts
from app.ai.llm import generate_answer
from app.core.config import get_settings
from app.models import ChatMessage, ChatRole, ChatSession
from app.services.document_service import get_document, get_or_create_default_user

_EXCERPT_MAX_LENGTH = 300


class ChatSessionNotFoundError(Exception):
    pass


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


def send_message(
    db: Session,
    message: str,
    session_id: uuid.UUID | None = None,
    document_id: uuid.UUID | None = None,
) -> dict:
    """Persist the user's message, generate a grounded RAG answer, persist
    the assistant's reply, and return {answer, sources, session_id}.

    If the RAG pipeline raises (DocumentNotFoundError, EmbeddingError,
    LLMError, VectorStoreError), the user's message is already committed —
    it really was sent — but no assistant message is written, so the
    session is left in a consistent, retryable state rather than half
    written. The caller (the /chat route) is responsible for turning that
    exception into a clean HTTP error.
    """
    session = _get_or_create_session(db, session_id, document_id)
    effective_document_id = document_id if document_id is not None else session.document_id

    user_message = ChatMessage(session_id=session.id, role=ChatRole.USER, content=message)
    db.add(user_message)
    db.commit()

    result = answer_question(db, message, document_id=effective_document_id)

    source_chunk_ids = [source["chunk_id"] for source in result["sources"]]
    assistant_message = ChatMessage(
        session_id=session.id,
        role=ChatRole.ASSISTANT,
        content=result["answer"],
        source_chunk_ids=source_chunk_ids,
    )
    db.add(assistant_message)
    db.commit()

    return {"answer": result["answer"], "sources": result["sources"], "session_id": session.id}


def get_session_messages(db: Session, session_id: uuid.UUID) -> list[ChatMessage]:
    session = db.get(ChatSession, session_id)
    if session is None:
        raise ChatSessionNotFoundError(f"Chat session {session_id} not found.")

    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .all()
    )


def _get_or_create_session(
    db: Session, session_id: uuid.UUID | None, document_id: uuid.UUID | None
) -> ChatSession:
    if session_id is not None:
        session = db.get(ChatSession, session_id)
        if session is None:
            raise ChatSessionNotFoundError(f"Chat session {session_id} not found.")
        return session

    user = get_or_create_default_user(db)
    session = ChatSession(user_id=user.id, document_id=document_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
