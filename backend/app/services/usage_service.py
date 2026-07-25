import uuid
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import GlobalUsageCounter, UsageCounter, User

LIMIT_MESSAGE = "Habiibi tomorrow insha'Allah"
GLOBAL_LIMIT_MESSAGE = "We've reached today's site capacity. Please try again tomorrow."


class UsageLimitExceededError(Exception):
    """Raised when a user (or the whole site) has hit today's upload or
    question quota."""


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


def _get_or_create_global_counter(db: Session) -> GlobalUsageCounter:
    today = _today()
    counter = (
        db.query(GlobalUsageCounter).filter(GlobalUsageCounter.usage_date == today).first()
    )
    if counter is None:
        counter = GlobalUsageCounter(usage_date=today)
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


def check_global_upload_limit(db: Session) -> None:
    settings = get_settings()
    counter = _get_or_create_global_counter(db)
    if counter.total_documents_uploaded >= settings.max_global_docs_per_day:
        raise UsageLimitExceededError(GLOBAL_LIMIT_MESSAGE)


def check_global_question_limit(db: Session) -> None:
    settings = get_settings()
    counter = _get_or_create_global_counter(db)
    if counter.total_questions_asked >= settings.max_global_questions_per_day:
        raise UsageLimitExceededError(GLOBAL_LIMIT_MESSAGE)


def increment_documents_uploaded(db: Session, user: User) -> None:
    counter = _get_or_create_counter(db, user.id)
    counter.documents_uploaded += 1
    db.commit()


def increment_questions_asked(db: Session, user: User) -> None:
    counter = _get_or_create_counter(db, user.id)
    counter.questions_asked += 1
    db.commit()


def increment_global_documents_uploaded(db: Session) -> None:
    counter = _get_or_create_global_counter(db)
    counter.total_documents_uploaded += 1
    db.commit()


def increment_global_questions_asked(db: Session) -> None:
    counter = _get_or_create_global_counter(db)
    counter.total_questions_asked += 1
    db.commit()
