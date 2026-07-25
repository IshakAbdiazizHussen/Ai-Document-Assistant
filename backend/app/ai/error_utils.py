import logging
import re

# Matches OpenAI-style secret keys wherever they show up in an error body/
# message — whole or masked/truncated (e.g. "sk-abc123***"). This is what
# actually keeps logs safe: gating on HTTP status (e.g. "only 401 can leak
# a key") is the wrong mechanism, since OpenAI can echo back a masked key
# fragment on other statuses too (a 500 body can just as easily contain
# "...key was sk-...").
_API_KEY_PATTERN = re.compile(r"sk-[A-Za-z0-9_-]{6,}")
_REDACTED = "[redacted]"


def _redact(text: str) -> str:
    return _API_KEY_PATTERN.sub(_REDACTED, text)


def describe_openai_error(exc: Exception) -> str:
    """A sanitized description of an OpenAI SDK failure: exception type and
    HTTP status only. Safe to put in a raised exception's message or an API
    response — never str(exc)/exc.message/exc.body here.
    """
    status_code = getattr(exc, "status_code", None)
    if status_code is not None:
        return f"{type(exc).__name__} (status {status_code})"
    return type(exc).__name__


def log_openai_error(logger: logging.Logger, exc: Exception, *, context: str) -> None:
    """Logs the actual reason an OpenAI API call failed — server-side only,
    never raised or returned to a client (describe_openai_error already
    covers that sanitized path). Any API-key-shaped substring is redacted
    first, regardless of status code, before it reaches the log line.
    """
    status_code = getattr(exc, "status_code", None)
    body = getattr(exc, "body", None)
    detail = body.get("error", body) if isinstance(body, dict) else str(exc)
    logger.error(
        "%s: %s (status %s) — %s", context, type(exc).__name__, status_code, _redact(str(detail))
    )
