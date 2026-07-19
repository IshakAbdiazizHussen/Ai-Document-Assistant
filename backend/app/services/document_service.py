import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.ai import vector_store
from app.ai.embeddings import EmbeddingError, embed_texts
from app.ai.vector_store import ChunkRecord, VectorStoreError
from app.core.config import get_settings
from app.models import Chunk, Document, DocumentStatus, User
from app.processing.chunker import chunk_text, count_tokens
from app.processing.cleaner import clean_text
from app.processing.extractor import ExtractionError, extract_text
from app.utils.file_validation import validate_upload

logger = logging.getLogger(__name__)

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
    # Vector cleanup happens first and is allowed to raise: unlike
    # embedding generation during processing, vector removal on delete is
    # not best-effort (docs/03-constraints.md requires it), so a failure
    # here aborts the whole delete rather than leaving orphaned vectors
    # undetected behind an apparently-successful 204.
    vector_store.delete_document(str(document.id))
    Path(document.storage_path).unlink(missing_ok=True)
    db.delete(document)
    db.commit()


def process_document(db: Session, document_id: uuid.UUID) -> Document:
    """Extract, clean, and chunk a stored document, then mark it ready or
    failed. This is the recovery boundary for the processing pipeline: any
    exception here is caught and turned into a "failed" status rather than
    left to crash the request or leave the document stuck at "processing".
    """
    document = get_document(db, document_id)
    try:
        raw_text = extract_text(document.storage_path, document.file_type)
        cleaned = clean_text(raw_text)
        chunks = chunk_text(cleaned)
        if not chunks:
            raise ExtractionError("No extractable text found after cleaning.")

        # Replace any chunks from a prior run of this document. IDs are
        # generated here (rather than left to the DB default) so they can
        # be used as vector-store IDs below without an extra flush.
        db.query(Chunk).filter(Chunk.document_id == document.id).delete()
        chunk_rows = [
            Chunk(
                id=uuid.uuid4(),
                document_id=document.id,
                chunk_index=index,
                text=chunk_content,
                vector_id=None,
                token_count=count_tokens(chunk_content),
            )
            for index, chunk_content in enumerate(chunks)
        ]
        db.add_all(chunk_rows)

        # A document's ready/failed status is decided by extraction/
        # chunking succeeding, not by embedding/vector-store availability
        # (docs/03-constraints.md: keep the MVP resilient) — a failure here
        # is logged and swallowed, leaving vector_id null for this run.
        try:
            vectors = embed_texts(chunks)
            chunk_records = [
                ChunkRecord(
                    chunk_id=str(row.id),
                    chunk_index=row.chunk_index,
                    text=row.text,
                    embedding=vector,
                )
                for row, vector in zip(chunk_rows, vectors)
            ]
            vector_ids = vector_store.add_chunks(str(document.id), chunk_records)
            for row, vector_id in zip(chunk_rows, vector_ids):
                row.vector_id = vector_id
        except (EmbeddingError, VectorStoreError):
            logger.warning(
                "Embedding/vector-store step failed for document %s", document.id, exc_info=True
            )

        document.status = DocumentStatus.READY
        document.error_message = None
    except Exception as exc:  # noqa: BLE001 - intentional recovery boundary
        document.status = DocumentStatus.FAILED
        document.error_message = str(exc)[:2000]

    db.commit()
    db.refresh(document)
    return document
