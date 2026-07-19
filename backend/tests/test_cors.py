"""Regression test for a real bug found while integrating the frontend
(Feature 10): the app had no CORS middleware at all, so a browser silently
blocked every response from reaching the frontend's JS even though the
backend processed each request successfully.
"""

from fastapi.testclient import TestClient

from app.main import app


def test_preflight_allows_the_configured_frontend_origin():
    with TestClient(app) as client:
        response = client.options(
            "/documents",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_actual_response_carries_cors_header_for_allowed_origin():
    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_disallowed_origin_does_not_get_a_cors_header():
    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "http://evil.example.com"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
