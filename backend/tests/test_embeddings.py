import json
import logging

import httpx
import pytest
from openai import OpenAI

from app.ai import embeddings as embeddings_module
from app.ai.embeddings import EmbeddingError, embed_texts

# A realistic-looking but fake key. Every test below asserts this exact
# string never appears in a raised exception's message or in logs.
FAKE_API_KEY = "sk-test-FAKE-KEY-should-never-leak-1234567890"


def _client_with_transport(handler, max_retries: int = 2) -> OpenAI:
    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    return OpenAI(api_key=FAKE_API_KEY, http_client=http_client, max_retries=max_retries)


def _install_client(monkeypatch, client: OpenAI) -> None:
    monkeypatch.setattr(embeddings_module, "_get_client", lambda: client)


def _embedding_response(inputs: list[str]) -> httpx.Response:
    data = [
        {"object": "embedding", "index": i, "embedding": [float(i), float(i) + 0.5, float(i) + 0.25]}
        for i in range(len(inputs))
    ]
    return httpx.Response(
        200,
        json={
            "object": "list",
            "data": data,
            "model": "text-embedding-3-small",
            "usage": {"prompt_tokens": 1, "total_tokens": 1},
        },
    )


def test_embed_texts_returns_vectors_in_input_order(monkeypatch):
    def handler(request):
        body = json.loads(request.content)
        return _embedding_response(body["input"])

    _install_client(monkeypatch, _client_with_transport(handler))

    result = embed_texts(["a", "b", "c"])

    assert len(result) == 3
    assert result[0] == [0.0, 0.5, 0.25]
    assert result[1] == [1.0, 1.5, 1.25]
    assert result[2] == [2.0, 2.5, 2.25]


def test_embed_texts_empty_input_returns_empty_list_without_calling_api(monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        return _embedding_response([])

    _install_client(monkeypatch, _client_with_transport(handler))

    assert embed_texts([]) == []
    assert calls == []


def test_embed_texts_batches_large_input(monkeypatch):
    call_sizes = []

    def handler(request):
        body = json.loads(request.content)
        call_sizes.append(len(body["input"]))
        return _embedding_response(body["input"])

    _install_client(monkeypatch, _client_with_transport(handler))

    texts = [f"chunk-{i}" for i in range(250)]
    result = embed_texts(texts)

    assert len(result) == 250
    assert call_sizes == [100, 100, 50]  # _MAX_BATCH_SIZE == 100, in order


def test_embed_texts_retries_timeout_then_raises_embedding_error(monkeypatch):
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        raise httpx.TimeoutException("simulated timeout", request=request)

    _install_client(monkeypatch, _client_with_transport(handler, max_retries=2))

    with pytest.raises(EmbeddingError) as exc_info:
        embed_texts(["a"])

    assert call_count["n"] == 3  # initial attempt + 2 retries
    assert FAKE_API_KEY not in str(exc_info.value)


def test_embed_texts_rate_limit_is_retried_then_succeeds(monkeypatch):
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        if call_count["n"] < 3:
            return httpx.Response(429, json={"error": {"message": "Rate limit exceeded"}})
        return _embedding_response(json.loads(request.content)["input"])

    _install_client(monkeypatch, _client_with_transport(handler, max_retries=2))

    result = embed_texts(["a"])

    assert call_count["n"] == 3
    assert len(result) == 1


def test_embed_texts_auth_error_raises_immediately_without_retry(monkeypatch):
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        return httpx.Response(
            401,
            json={
                "error": {
                    "message": f"Incorrect API key provided: {FAKE_API_KEY[:12]}***",
                    "type": "invalid_request_error",
                }
            },
        )

    _install_client(monkeypatch, _client_with_transport(handler, max_retries=2))

    with pytest.raises(EmbeddingError) as exc_info:
        embed_texts(["a"])

    assert call_count["n"] == 1  # no retries on auth errors
    assert FAKE_API_KEY not in str(exc_info.value)
    assert "Incorrect API key" not in str(exc_info.value)


def test_embed_texts_never_leaks_key_in_exception_or_logs(monkeypatch, caplog):
    def handler(request):
        return httpx.Response(
            500,
            json={"error": {"message": f"Internal error, key was {FAKE_API_KEY}"}},
        )

    _install_client(monkeypatch, _client_with_transport(handler, max_retries=0))

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(EmbeddingError) as exc_info:
            embed_texts(["a"])

    assert FAKE_API_KEY not in str(exc_info.value)
    assert FAKE_API_KEY not in caplog.text
