from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import ACCESS_TOKEN_COOKIE_NAME, create_access_token
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
)
from app.services import auth_service
from app.services.auth_service import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidResetTokenError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user_id: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=create_access_token(user_id),
        httponly=True,
        samesite="lax",
        # Browsers reject Secure cookies over plain http:// (local dev);
        # production always serves over https, where this must be true.
        secure=settings.environment != "development",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        user = auth_service.register_user(db, request.full_name, request.email, request.password)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists."
        ) from exc

    _set_auth_cookie(response, str(user.id))
    return user


@router.post("/login", response_model=UserOut)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        user = auth_service.authenticate_user(db, request.email, request.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password."
        ) from exc

    _set_auth_cookie(response, str(user.id))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    token = auth_service.request_password_reset(db, request.email)

    # Always the same response whether or not the email exists — otherwise
    # this endpoint would let an attacker enumerate registered accounts.
    result: dict = {"detail": "If that email exists, a reset link has been sent."}

    settings = get_settings()
    if settings.environment == "development" and token:
        # No email provider is configured yet (see auth_service.py). Surface
        # the token here so local dev/testing has a real path end to end;
        # this must never happen outside development.
        result["dev_reset_token"] = token
    return result


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    try:
        auth_service.reset_password(db, request.token, request.password)
    except InvalidResetTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
