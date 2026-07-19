def describe_openai_error(exc: Exception) -> str:
    """A sanitized description of an OpenAI SDK failure: exception type and
    HTTP status only. Never str(exc)/exc.message/exc.body — OpenAI's own
    error responses can echo back a masked fragment of the API key used, so
    nothing from the raw exception is allowed into a log line or response.
    """
    status_code = getattr(exc, "status_code", None)
    if status_code is not None:
        return f"{type(exc).__name__} (status {status_code})"
    return type(exc).__name__
