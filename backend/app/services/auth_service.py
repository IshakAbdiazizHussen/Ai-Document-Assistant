import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_reset_token, hash_password, verify_password
from app.models import User

logger = logging.getLogger(__name__)


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InvalidResetTokenError(Exception):
    pass


def register_user(db: Session, full_name: str, email: str, password: str) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise EmailAlreadyRegisteredError(f"{email} is already registered.")

    user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(password, user.hashed_password):
        # Same error for "no such user" and "wrong password" — never reveal
        # which one it was, that would let an attacker enumerate accounts.
        raise InvalidCredentialsError("Incorrect email or password.")
    return user


def request_password_reset(db: Session, email: str) -> str | None:
    """Returns the raw reset token if the email matched an account, else
    None. The caller must respond identically either way — this return
    value exists only so dev/test environments can surface the token
    without a real email provider configured (see routes/auth.py).
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None

    settings = get_settings()
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.reset_token_expire_minutes
    )
    db.commit()

    # No email provider is wired up yet — this is the only place the link
    # is surfaced outside of the dev-only API response.
    logger.info("Password reset requested for %s — token: %s", email, token)
    return token


def reset_password(db: Session, token: str, new_password: str) -> User:
    user = db.query(User).filter(User.reset_token == token).first()
    now = datetime.now(timezone.utc)
    if user is None or user.reset_token_expires_at is None or user.reset_token_expires_at < now:
        raise InvalidResetTokenError("This reset link is invalid or has expired.")

    user.hashed_password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    db.refresh(user)
    return user
