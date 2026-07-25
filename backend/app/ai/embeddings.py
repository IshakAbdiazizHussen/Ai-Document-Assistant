import logging
from functools import lru_cache

from openai import OpenAI, OpenAIError

from app.ai.error_utils import describe_openai_error, log_openai_error
from app.core.config import get_settings

logger = logging.getLogger(__name__)

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
        # Full structured detail goes to the server log only (see
        # log_openai_error); the exception raised here — which can end up
        # in a response — stays sanitized via describe_openai_error, same
        # as before.
        empty_count = sum(1 for t in batch if not t.strip())
        total_tokens = sum(len(t) for t in batch)  # cheap proxy, not tiktoken-exact
        log_openai_error(
            logger,
            exc,
            context=(
                f"Embeddings request failed (model={model!r}, batch_size={len(batch)}, "
                f"empty_or_blank_items={empty_count}, total_chars={total_tokens})"
            ),
        )
        raise EmbeddingError(f"Embedding request failed: {describe_openai_error(exc)}") from None
    except Exception as exc:
        log_openai_error(
            logger, exc, context=f"Embeddings request failed unexpectedly (model={model!r})"
        )
        raise EmbeddingError(
            f"Embedding request failed unexpectedly: {describe_openai_error(exc)}"
        ) from None

    ordered = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in ordered]
