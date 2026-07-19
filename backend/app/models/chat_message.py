import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole, name="chat_role", native_enum=True), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_chunk_ids: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
