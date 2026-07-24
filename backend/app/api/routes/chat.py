import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai.embeddings import EmbeddingError
from app.ai.llm import LLMError
from app.ai.vector_store import VectorStoreError
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.chat import (
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    ChatSessionSummary,
    ChatSessionUpdate,
)
from app.services import chat_service
from app.services.chat_service import ChatSessionNotFoundError
from app.services.document_service import DocumentNotFoundError

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    try:
        return chat_service.send_message(
            db,
            request.message,
            current_user,
            session_id=request.session_id,
            document_id=request.document_id,
        )
    except ChatSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        ) from exc
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc
    except (EmbeddingError, LLMError, VectorStoreError) as exc:
        # Never leak raw OpenAI/ChromaDB error text to the client — the
        # user's message is already persisted (see chat_service.send_message
        # docstring), so the session stays usable and they can just retry.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service is temporarily unavailable. Please try again.",
        ) from exc


@router.get("/{session_id}/messages", response_model=list[ChatMessageOut])
def get_session_messages(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessageOut]:
    try:
        return chat_service.get_session_messages(db, session_id, current_user)
    except ChatSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        ) from exc


@router.get("/sessions", response_model=list[ChatSessionSummary])
def list_sessions(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ChatSessionSummary]:
    return chat_service.list_sessions(db, current_user)


@router.patch("/sessions/{session_id}", response_model=ChatSessionSummary)
def update_session(
    session_id: uuid.UUID,
    request: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionSummary:
    try:
        chat_service.update_session(
            db, session_id, current_user, title=request.title, pinned=request.pinned
        )
    except ChatSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        ) from exc

    # Re-fetch through list_sessions() so the response has the same
    # aggregated shape (message_count, last_message_preview, filename) as
    # the list endpoint, not just the bare updated row.
    return next(s for s in chat_service.list_sessions(db, current_user) if s["id"] == session_id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        chat_service.delete_session(db, session_id, current_user)
    except ChatSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        ) from exc
