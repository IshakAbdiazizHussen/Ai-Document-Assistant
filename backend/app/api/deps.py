import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import ACCESS_TOKEN_COOKIE_NAME, InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.models import User
from app.services import usage_service
from app.services.usage_service import UsageLimitExceededError

_UNAUTHORIZED = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise _UNAUTHORIZED

    try:
        user_id = decode_access_token(token)
    except InvalidTokenError as exc:
        raise _UNAUTHORIZED from exc

    user = db.get(User, uuid.UUID(user_id))
    if user is None:
        raise _UNAUTHORIZED
    return user


def enforce_upload_limit(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> User:
    """Runs before the upload endpoint's body — blocks the request (and the
    OpenAI call that would follow it) before any file is even read, if the
    user has hit today's document quota."""
    try:
        usage_service.check_upload_limit(db, current_user)
    except UsageLimitExceededError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return current_user


def enforce_question_limit(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> User:
    """Same as enforce_upload_limit, for the ask-question endpoint."""
    try:
        usage_service.check_question_limit(db, current_user)
    except UsageLimitExceededError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return current_user
