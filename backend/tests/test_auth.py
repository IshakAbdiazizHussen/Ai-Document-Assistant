"""Auth (Feature: real accounts). Covers the /auth endpoints themselves and,
just as importantly, that documents/chat sessions are genuinely scoped to
the authenticated account now that per-user data isolation is real (not a
single shared default user anymore).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from tests.conftest import register_test_user

# ---------------------------------------------------------------------------
# Register / login / me / logout
# ---------------------------------------------------------------------------


def test_register_then_me_returns_the_new_account():
    with TestClient(app) as client:
        email = f"reg-{uuid.uuid4().hex[:12]}@example.com"
        response = client.post(
            "/auth/register",
            json={"full_name": "Ada Lovelace", "email": email, "password": "supersecret1"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["email"] == email
        assert body["full_name"] == "Ada Lovelace"

        me = client.get("/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email


def test_register_duplicate_email_rejected():
    with TestClient(app) as client:
        email = f"dupe-{uuid.uuid4().hex[:12]}@example.com"
        first = client.post(
            "/auth/register",
            json={"full_name": "First", "email": email, "password": "supersecret1"},
        )
        assert first.status_code == 201

        second = client.post(
            "/auth/register",
            json={"full_name": "Second", "email": email, "password": "anotherpass1"},
        )
        assert second.status_code == 409


def test_register_password_too_short_rejected():
    with TestClient(app) as client:
        response = client.post(
            "/auth/register",
            json={"full_name": "Short", "email": "short@example.com", "password": "short"},
        )
        assert response.status_code == 422


def test_login_with_correct_password_succeeds_and_sets_session():
    with TestClient(app) as client:
        email = f"login-{uuid.uuid4().hex[:12]}@example.com"
        client.post(
            "/auth/register",
            json={"full_name": "Login Test", "email": email, "password": "supersecret1"},
        )
        client.post("/auth/logout")

        response = client.post("/auth/login", json={"email": email, "password": "supersecret1"})
        assert response.status_code == 200
        assert client.get("/auth/me").status_code == 200


def test_login_with_wrong_password_returns_401_with_generic_message():
    with TestClient(app) as client:
        email = f"wrongpw-{uuid.uuid4().hex[:12]}@example.com"
        client.post(
            "/auth/register",
            json={"full_name": "Wrong PW", "email": email, "password": "supersecret1"},
        )
        client.post("/auth/logout")

        response = client.post("/auth/login", json={"email": email, "password": "not-the-password"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password."


def test_login_unknown_email_returns_same_generic_message():
    # Same message as a wrong password — never reveal whether the email exists.
    with TestClient(app) as client:
        response = client.post(
            "/auth/login", json={"email": "nobody-here@example.com", "password": "whatever1"}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password."


def test_logout_then_me_is_unauthenticated():
    with TestClient(app) as client:
        register_test_user(client)
        assert client.get("/auth/me").status_code == 200

        client.post("/auth/logout")
        assert client.get("/auth/me").status_code == 401


def test_me_without_a_session_is_401():
    with TestClient(app) as client:
        assert client.get("/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------


def test_forgot_password_unknown_email_returns_generic_success_without_a_dev_token():
    with TestClient(app) as client:
        response = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
        assert response.status_code == 200
        assert "dev_reset_token" not in response.json()


def test_forgot_password_then_reset_lets_the_new_password_log_in():
    with TestClient(app) as client:
        email = f"reset-{uuid.uuid4().hex[:12]}@example.com"
        client.post(
            "/auth/register",
            json={"full_name": "Reset Me", "email": email, "password": "originalpass1"},
        )
        client.post("/auth/logout")

        forgot = client.post("/auth/forgot-password", json={"email": email})
        assert forgot.status_code == 200
        token = forgot.json().get("dev_reset_token")
        assert token, "expected a dev_reset_token in the development environment"

        reset = client.post(
            "/auth/reset-password", json={"token": token, "password": "brandnewpass1"}
        )
        assert reset.status_code == 204

        old_login = client.post("/auth/login", json={"email": email, "password": "originalpass1"})
        assert old_login.status_code == 401

        new_login = client.post("/auth/login", json={"email": email, "password": "brandnewpass1"})
        assert new_login.status_code == 200


def test_reset_password_with_invalid_token_rejected():
    with TestClient(app) as client:
        response = client.post(
            "/auth/reset-password", json={"token": "not-a-real-token", "password": "whatever123"}
        )
        assert response.status_code == 400


def test_dev_reset_token_never_present_outside_development(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(type(settings), "environment", "production", raising=False)
    # get_settings() is lru_cached; the route reads via get_settings() each
    # call, so patch the cached instance's attribute directly instead of
    # trying to bust the cache.
    object.__setattr__(settings, "environment", "production")
    try:
        with TestClient(app) as client:
            email = f"prod-{uuid.uuid4().hex[:12]}@example.com"
            client.post(
                "/auth/register",
                json={"full_name": "Prod", "email": email, "password": "supersecret1"},
            )
            client.post("/auth/logout")
            response = client.post("/auth/forgot-password", json={"email": email})
            assert "dev_reset_token" not in response.json()
    finally:
        object.__setattr__(settings, "environment", "development")


# ---------------------------------------------------------------------------
# Routes require authentication at all
# ---------------------------------------------------------------------------


def test_documents_list_requires_authentication():
    with TestClient(app) as client:
        assert client.get("/documents").status_code == 401


def test_chat_requires_authentication():
    with TestClient(app) as client:
        assert client.post("/chat", json={"message": "hi"}).status_code == 401


# ---------------------------------------------------------------------------
# Cross-user data isolation
# ---------------------------------------------------------------------------


@pytest.fixture
def uploaded_document(client, monkeypatch, tmp_path):
    from app.core.config import Settings
    from app.services import document_service
    from app.utils import file_validation

    settings = Settings(upload_dir=str(tmp_path), max_upload_size_bytes=20 * 1024 * 1024)
    monkeypatch.setattr(document_service, "get_settings", lambda: settings)
    monkeypatch.setattr(file_validation, "get_settings", lambda: settings)
    monkeypatch.setattr(document_service, "embed_texts", lambda texts: [[0.0] for _ in texts])
    monkeypatch.setattr(
        document_service.vector_store,
        "add_chunks",
        lambda document_id, chunk_records: [r.chunk_id for r in chunk_records],
    )
    monkeypatch.setattr(document_service.vector_store, "delete_document", lambda document_id: None)

    response = client.post(
        "/documents/upload",
        files={"file": ("owned-by-a.txt", b"secret content", "text/plain")},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_other_user_cannot_read_your_document(second_client, uploaded_document):
    response = second_client.get(f"/documents/{uploaded_document}")
    assert response.status_code == 404


def test_other_user_cannot_delete_your_document(second_client, uploaded_document):
    response = second_client.delete(f"/documents/{uploaded_document}")
    assert response.status_code == 404


def test_other_user_cannot_download_your_document(second_client, uploaded_document):
    response = second_client.get(f"/documents/{uploaded_document}/download")
    assert response.status_code == 404


def test_your_document_is_absent_from_other_users_list(second_client, uploaded_document):
    response = second_client.get("/documents")
    assert response.status_code == 200
    assert uploaded_document not in [d["id"] for d in response.json()]


def test_other_user_cannot_chat_scoped_to_your_document(second_client, uploaded_document):
    response = second_client.post(
        "/chat", json={"message": "what does this say?", "document_id": uploaded_document}
    )
    assert response.status_code == 404


@pytest.fixture
def owned_session(client, monkeypatch):
    from app.services import chat_service

    monkeypatch.setattr(
        chat_service,
        "answer_question",
        lambda db, question, user, document_id=None, top_k=None: {
            "answer": "stub answer",
            "sources": [],
        },
    )
    response = client.post("/chat", json={"message": "hello"})
    assert response.status_code == 200
    return response.json()["session_id"]


def test_other_user_cannot_read_your_session_messages(second_client, owned_session):
    response = second_client.get(f"/chat/{owned_session}/messages")
    assert response.status_code == 404


def test_other_user_cannot_post_into_your_session(second_client, owned_session):
    response = second_client.post(
        "/chat", json={"message": "hijack attempt", "session_id": owned_session}
    )
    assert response.status_code == 404


def test_your_session_is_absent_from_other_users_conversation_list(second_client, owned_session):
    response = second_client.get("/chat/sessions")
    assert response.status_code == 200
    assert owned_session not in [s["id"] for s in response.json()]


def test_other_user_cannot_rename_your_session(second_client, owned_session):
    response = second_client.patch(f"/chat/sessions/{owned_session}", json={"title": "hijacked"})
    assert response.status_code == 404


def test_other_user_cannot_delete_your_session(second_client, owned_session):
    response = second_client.delete(f"/chat/sessions/{owned_session}")
    assert response.status_code == 404
