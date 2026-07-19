import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Document, DocumentStatus, User
from app.utils.file_validation import validate_upload

# MVP has no authentication system (docs/03-constraints.md rules it out of
# scope). Every document is attached to a single seeded default user until
# real auth is scoped in as a future feature.
DEFAULT_USER_EMAIL = "default-user@ai-document-assistant.local"


class DocumentNotFoundError(Exception):
    pass


def _get_or_create_default_user(db: Session) -> User:
    user = db.query(User).filter(User.email == DEFAULT_USER_EMAIL).first()
    if user is None:
        user = User(email=DEFAULT_USER_EMAIL)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


async def save_upload(file: UploadFile, db: Session) -> Document:
    extension = validate_upload(file)
    contents = await file.read()

    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    storage_path = upload_dir / f"{uuid.uuid4()}{extension}"
    storage_path.write_bytes(contents)

    user = _get_or_create_default_user(db)

    document = Document(
        user_id=user.id,
        filename=file.filename,
        file_type=extension.lstrip("."),
        file_size_bytes=len(contents),
        status=DocumentStatus.PROCESSING,
        storage_path=str(storage_path),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def list_documents(db: Session) -> list[Document]:
    return db.query(Document).order_by(Document.created_at.desc()).all()


def get_document(db: Session, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise DocumentNotFoundError(f"Document {document_id} not found.")
    return document


def delete_document(db: Session, document_id: uuid.UUID) -> None:
    document = get_document(db, document_id)
    Path(document.storage_path).unlink(missing_ok=True)
    db.delete(document)
    db.commit()
