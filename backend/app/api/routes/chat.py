import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai.embeddings import EmbeddingError
from app.ai.llm import LLMError
from app.ai.vector_store import VectorStoreError
from app.db.session import get_db
from app.schemas.chat import ChatMessageOut, ChatRequest, ChatResponse
from app.services import chat_service
from app.services.chat_service import ChatSessionNotFoundError
from app.services.document_service import DocumentNotFoundError

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def send_message(request: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    try:
        return chat_service.send_message(
            db,
            request.message,
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
def get_session_messages(session_id: uuid.UUID, db: Session = Depends(get_db)) -> list[ChatMessageOut]:
    try:
        return chat_service.get_session_messages(db, session_id)
    except ChatSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        ) from exc
