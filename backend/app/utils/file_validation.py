from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings

ALLOWED_CONTENT_TYPES: dict[str, set[str]] = {
    ".pdf": {"application/pdf"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".txt": {"text/plain"},
}


class FileValidationError(Exception):
    """Base class for upload validation failures."""


class UnsupportedFileTypeError(FileValidationError):
    pass


class FileTooLargeError(FileValidationError):
    pass


def validate_upload(file: UploadFile) -> str:
    """Validate an uploaded file's extension, declared content-type, and size.

    Returns the validated lowercase file extension (including the leading dot).
    """
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_CONTENT_TYPES))
        raise UnsupportedFileTypeError(
            f"Unsupported file extension '{extension or '(none)'}'. Allowed types: {allowed}."
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES[extension]:
        raise UnsupportedFileTypeError(
            f"Declared content type '{file.content_type}' does not match extension '{extension}'."
        )

    settings = get_settings()
    if file.size is not None and file.size > settings.max_upload_size_bytes:
        raise FileTooLargeError(
            f"File exceeds maximum allowed size of {settings.max_upload_size_bytes} bytes."
        )

    return extension
