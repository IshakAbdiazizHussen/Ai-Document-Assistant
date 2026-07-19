from functools import lru_cache

import tiktoken

from app.core.config import get_settings

# cl100k_base is the encoding used by settings.openai_embedding_model
# (text-embedding-3-small), so token counts here match what the embedding
# API (Feature 4) actually sees.
_ENCODING_NAME = "cl100k_base"


@lru_cache
def _get_encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding(_ENCODING_NAME)


def count_tokens(text: str) -> int:
    return len(_get_encoding().encode(text))


def chunk_text(
    text: str,
    chunk_size_tokens: int | None = None,
    overlap_tokens: int | None = None,
) -> list[str]:
    """Split text into overlapping, token-bounded chunks."""
    settings = get_settings()
    chunk_size = chunk_size_tokens if chunk_size_tokens is not None else settings.chunk_size_tokens
    overlap = overlap_tokens if overlap_tokens is not None else settings.chunk_overlap_tokens

    if chunk_size <= 0:
        raise ValueError("chunk_size_tokens must be positive.")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap_tokens must be non-negative and smaller than chunk_size_tokens.")

    encoding = _get_encoding()
    tokens = encoding.encode(text)
    if not tokens:
        return []

    chunks: list[str] = []
    step = chunk_size - overlap
    for start in range(0, len(tokens), step):
        window = tokens[start : start + chunk_size]
        chunks.append(encoding.decode(window))
        if start + chunk_size >= len(tokens):
            break
    return chunks
