import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.chat_message import ChatRole

_MESSAGE_MAX_LENGTH = 4000


class SourceReference(BaseModel):
    chunk_id: str
    document_id: str
    excerpt: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=_MESSAGE_MAX_LENGTH)
    session_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None

    @field_validator("message")
    @classmethod
    def _message_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    session_id: uuid.UUID


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: ChatRole
    content: str
    source_chunk_ids: list[str] | None
    created_at: datetime
