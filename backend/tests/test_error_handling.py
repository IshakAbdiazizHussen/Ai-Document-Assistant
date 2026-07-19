"""Feature 8: the global exception handler in app/main.py is the last-resort
safety net for anything a route's own typed-exception handling doesn't
catch. Verify it sanitizes the client response while still logging full
detail server-side, and that it doesn't interfere with routes' own
HTTPException/validation error handling.
"""

import logging

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import document_service


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_unhandled_exception_returns_sanitized_500(client, monkeypatch, caplog):
    sensitive_detail = "unexpected failure touching /etc/passwd with secret=abc123"

    def boom(db):
        raise RuntimeError(sensitive_detail)

    monkeypatch.setattr(document_service, "list_documents", boom)

    with caplog.at_level(logging.ERROR):
        response = client.get("/documents")

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert sensitive_detail not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text

    # but it *is* logged server-side, for debugging
    assert sensitive_detail in caplog.text


def test_app_keeps_running_after_an_unhandled_exception(client, monkeypatch):
    def boom(db):
        raise RuntimeError("boom")

    monkeypatch.setattr(document_service, "list_documents", boom)
    failed = client.get("/documents")
    assert failed.status_code == 500

    assert client.get("/health").status_code == 200


def test_existing_http_exceptions_are_unaffected_by_the_global_handler(client):
    import uuid

    response = client.get(f"/documents/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


def test_existing_validation_errors_are_unaffected_by_the_global_handler(client):
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 422
