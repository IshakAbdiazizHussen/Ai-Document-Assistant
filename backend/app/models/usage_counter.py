import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class UsageCounter(Base):
    """One row per user per calendar day. Keying by (user_id, usage_date)
    is what makes counters reset automatically at midnight — a new day has
    no matching row yet, so it starts at zero rather than needing a cron
    job or TTL to clear anything."""

    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("user_id", "usage_date", name="uq_usage_counters_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    documents_uploaded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    questions_asked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
