import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.main import app
from app.models import User


def register_test_user(client: TestClient, email: str | None = None) -> dict:
    """Registers a fresh user on the given TestClient (which then carries
    the resulting session cookie for every subsequent request) and returns
    the created user's JSON body.
    """
    email = email or f"test-{uuid.uuid4().hex[:12]}@example.com"
    response = client.post(
        "/auth/register",
        json={"full_name": "Test User", "email": email, "password": "testpass123"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_user(db: Session, email: str | None = None) -> User:
    """Creates a real User row directly, for tests that call service
    functions below the HTTP layer rather than going through /auth.
    """
    email = email or f"test-{uuid.uuid4().hex[:12]}@example.com"
    user = User(email=email, hashed_password=hash_password("testpass123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client():
    """An authenticated TestClient: registration already happened, so the
    session cookie is set and every request after this is "logged in" as
    that user. Most route-level tests just need this.
    """
    with TestClient(app) as c:
        register_test_user(c)
        yield c


@pytest.fixture
def client_user(client):
    """The user id the `client` fixture is currently authenticated as —
    for fixtures that need to attribute seeded rows to whichever account
    the tests' HTTP requests will actually be authorized as.
    """
    response = client.get("/auth/me")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def second_client():
    """A second, independently-authenticated TestClient — for tests that
    need to prove one account can't see or touch another account's data.
    """
    with TestClient(app) as c:
        register_test_user(c)
        yield c
