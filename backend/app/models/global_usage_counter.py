import uuid
from datetime import date

from sqlalchemy import Date, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class GlobalUsageCounter(Base):
    """One row per calendar day for the whole app (no user_id) — tracks
    combined usage across every user, to protect the shared OpenAI budget
    even when each individual user stays under their own per-user limit.
    Same reset mechanism as UsageCounter: usage_date is unique, so a new
    day simply has no row yet rather than needing a cron job to clear it.
    """

    __tablename__ = "global_usage_counters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True, index=True)
    total_documents_uploaded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_questions_asked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
