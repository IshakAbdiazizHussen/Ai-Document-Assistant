from functools import lru_cache

from openai import OpenAI, OpenAIError

from app.ai.error_utils import describe_openai_error
from app.core.config import get_settings

# Kept well under OpenAI's per-request input-item limit for the embeddings
# endpoint; large documents are split across multiple batched calls rather
# than one call per chunk.
_MAX_BATCH_SIZE = 100


class EmbeddingError(Exception):
    """Raised when generating embeddings fails, after any built-in SDK
    retries are exhausted. Never carries the raw SDK exception or API key.
    """


@lru_cache
def _get_client() -> OpenAI:
    # Centralized client construction: this is the only place the OpenAI
    # SDK is instantiated for embeddings. `max_retries` delegates transient-
    # failure retry (timeouts, 429s, 5xxs) to the SDK's own backoff, which
    # already skips retrying non-retryable errors like 401/403/404.
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key, max_retries=2)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, returning one vector per input in the same order."""
    if not texts:
        return []

    settings = get_settings()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _MAX_BATCH_SIZE):
        batch = texts[start : start + _MAX_BATCH_SIZE]
        vectors.extend(_embed_batch(batch, settings.openai_embedding_model))
    return vectors


def _embed_batch(batch: list[str], model: str) -> list[list[float]]:
    try:
        client = _get_client()
        response = client.embeddings.create(model=model, input=batch)
    except OpenAIError as exc:
        # `from None` deliberately drops the exception chain: the SDK's own
        # error message can echo back a masked fragment of the API key that
        # was used, so it must never propagate into logs or responses.
        raise EmbeddingError(f"Embedding request failed: {describe_openai_error(exc)}") from None
    except Exception as exc:
        raise EmbeddingError(
            f"Embedding request failed unexpectedly: {describe_openai_error(exc)}"
        ) from None

    ordered = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in ordered]
