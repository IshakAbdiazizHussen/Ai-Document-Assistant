import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)


class LoginRequest(BaseModel):
    # Plain str, not EmailStr: this looks up an *existing* account, so it
    # must never reject an address just because it doesn't look like a real
    # one (e.g. the pre-auth MVP's seeded default-user@..-assistant.local).
    # Format validation belongs on registration, where the address is new.
    email: str = Field(..., min_length=1, max_length=320)
    password: str = Field(..., min_length=1, max_length=72)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=320)


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None
    created_at: datetime
