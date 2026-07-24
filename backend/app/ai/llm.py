from functools import lru_cache

from openai import OpenAI, OpenAIError

from app.ai.error_utils import describe_openai_error
from app.ai.vector_store import SearchResult
from app.core.config import get_settings

# The single point of control for grounding behavior (docs/03-constraints.md
# AI Constraints): the model must never answer document questions from
# outside knowledge, and must say so plainly when the context doesn't
# contain the answer, rather than guessing.
SYSTEM_PROMPT = (
    "You are a document assistant. Answer the user's question using ONLY "
    "the context provided in the following message, which was retrieved "
    "from the user's own uploaded documents. Do not use any outside "
    "knowledge, and do not guess. If the context does not contain enough "
    "information to answer the question, say clearly that the information "
    "is not available in the provided documents instead of answering. "
    "Each context passage is labeled [Source N]. When a claim in your "
    "answer is drawn from a passage, cite it inline immediately after the "
    "claim using that same bracketed number, e.g. \"revenue grew 18% [1]\". "
    "Only cite sources that were actually provided; never invent a source "
    "number."
)

_NO_CONTEXT_PLACEHOLDER = "(No relevant passages were found in the documents.)"


class LLMError(Exception):
    """Raised when generating a chat completion fails. Never carries the
    raw SDK exception or API key.
    """


@lru_cache
def _get_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key, max_retries=2)


def build_grounded_prompt(
    question: str, retrieved_chunks: list[SearchResult]
) -> list[dict[str, str]]:
    """Build the chat message list for a grounded answer.

    The question is always its own final message with role "user" — never
    concatenated into the system instructions — so it cannot be interpreted
    as an override of the grounding rule above.
    """
    if retrieved_chunks:
        context = "\n\n".join(
            f"[Source {index + 1}] {chunk.text}" for index, chunk in enumerate(retrieved_chunks)
        )
    else:
        context = _NO_CONTEXT_PLACEHOLDER

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Context:\n\n{context}"},
        {"role": "user", "content": question},
    ]


def generate_answer(question: str, retrieved_chunks: list[SearchResult]) -> str:
    """Generate a grounded answer to `question` using only `retrieved_chunks`."""
    settings = get_settings()
    messages = build_grounded_prompt(question, retrieved_chunks)

    try:
        client = _get_client()
        response = client.chat.completions.create(model=settings.openai_chat_model, messages=messages)
    except OpenAIError as exc:
        raise LLMError(f"Chat completion request failed: {describe_openai_error(exc)}") from None
    except Exception as exc:
        raise LLMError(
            f"Chat completion request failed unexpectedly: {describe_openai_error(exc)}"
        ) from None

    return response.choices[0].message.content or ""
