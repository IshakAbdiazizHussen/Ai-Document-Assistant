import uuid
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import UsageCounter, User

LIMIT_MESSAGE = "Habiibi tomorrow insha'Allah"


class UsageLimitExceededError(Exception):
    """Raised when a user has hit their daily upload or question quota."""


def _today() -> date:
    # Server-local wall-clock date, not UTC or the caller's timezone —
    # counters roll over whenever the backend process's own clock crosses
    # midnight.
    return datetime.now().date()


def _get_or_create_counter(db: Session, user_id: uuid.UUID) -> UsageCounter:
    today = _today()
    counter = (
        db.query(UsageCounter)
        .filter(UsageCounter.user_id == user_id, UsageCounter.usage_date == today)
        .first()
    )
    if counter is None:
        counter = UsageCounter(user_id=user_id, usage_date=today)
        db.add(counter)
        db.commit()
        db.refresh(counter)
    return counter


def check_upload_limit(db: Session, user: User) -> None:
    settings = get_settings()
    counter = _get_or_create_counter(db, user.id)
    if counter.documents_uploaded >= settings.max_docs_per_day:
        raise UsageLimitExceededError(LIMIT_MESSAGE)


def check_question_limit(db: Session, user: User) -> None:
    settings = get_settings()
    counter = _get_or_create_counter(db, user.id)
    if counter.questions_asked >= settings.max_questions_per_day:
        raise UsageLimitExceededError(LIMIT_MESSAGE)


def increment_documents_uploaded(db: Session, user: User) -> None:
    counter = _get_or_create_counter(db, user.id)
    counter.documents_uploaded += 1
    db.commit()


def increment_questions_asked(db: Session, user: User) -> None:
    counter = _get_or_create_counter(db, user.id)
    counter.questions_asked += 1
    db.commit()
