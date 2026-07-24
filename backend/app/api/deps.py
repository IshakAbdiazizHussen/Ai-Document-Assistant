import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import ACCESS_TOKEN_COOKIE_NAME, InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.models import User

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
