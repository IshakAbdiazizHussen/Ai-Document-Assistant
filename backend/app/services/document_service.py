import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.ai import vector_store
from app.ai.embeddings import EmbeddingError, embed_texts
from app.ai.vector_store import ChunkRecord, VectorStoreError
from app.core.config import get_settings
from app.models import Chunk, Document, DocumentPage, DocumentStatus, User
from app.processing.chunker import chunk_text, count_tokens
from app.processing.cleaner import clean_text
from app.processing.extractor import ExtractionError, extract_pages
from app.utils.file_validation import validate_upload

logger = logging.getLogger(__name__)


class DocumentNotFoundError(Exception):
    pass


class DocumentPageNotFoundError(Exception):
    pass


async def save_upload(file: UploadFile, db: Session, user: User) -> Document:
    extension = validate_upload(file)
    contents = await file.read()

    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    storage_path = upload_dir / f"{uuid.uuid4()}{extension}"
    storage_path.write_bytes(contents)

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


def list_documents(db: Session, user: User) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.created_at.desc())
        .all()
    )


def get_document(db: Session, document_id: uuid.UUID) -> Document:
    """Unscoped lookup for internal pipeline use only (e.g. process_document(),
    called right after save_upload() within the same authenticated request).
    User-facing code must use get_document_for_user() instead — this one
    does not check ownership.
    """
    document = db.get(Document, document_id)
    if document is None:
        raise DocumentNotFoundError(f"Document {document_id} not found.")
    return document


def get_document_for_user(db: Session, document_id: uuid.UUID, user: User) -> Document:
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user.id)
        .first()
    )
    if document is None:
        # Same error whether the document doesn't exist or belongs to
        # someone else — never confirm another user's document ID is real.
        raise DocumentNotFoundError(f"Document {document_id} not found.")
    return document


def get_document_page(db: Session, document_id: uuid.UUID, page_number: int, user: User) -> DocumentPage:
    get_document_for_user(db, document_id, user)  # raises DocumentNotFoundError if not this user's
    page = (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id == document_id, DocumentPage.page_number == page_number)
        .first()
    )
    if page is None:
        raise DocumentPageNotFoundError(f"Document {document_id} has no page {page_number}.")
    return page


def delete_document(db: Session, document_id: uuid.UUID, user: User) -> None:
    document = get_document_for_user(db, document_id, user)
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
        raw_pages = extract_pages(document.storage_path, document.file_type)
        cleaned_pages = [clean_text(page) for page in raw_pages]

        # Replace any pages/chunks from a prior run of this document. Chunk
        # IDs are generated here (rather than left to the DB default) so
        # they can be used as vector-store IDs below without an extra flush.
        db.query(DocumentPage).filter(DocumentPage.document_id == document.id).delete()
        db.query(Chunk).filter(Chunk.document_id == document.id).delete()

        page_rows = [
            DocumentPage(document_id=document.id, page_number=page_number, text=page_text)
            for page_number, page_text in enumerate(cleaned_pages, start=1)
        ]
        db.add_all(page_rows)
        document.page_count = len(cleaned_pages)

        chunk_rows: list[Chunk] = []
        chunk_index = 0
        for page_number, page_text in enumerate(cleaned_pages, start=1):
            for chunk_content in chunk_text(page_text):
                chunk_rows.append(
                    Chunk(
                        id=uuid.uuid4(),
                        document_id=document.id,
                        chunk_index=chunk_index,
                        page_number=page_number,
                        text=chunk_content,
                        vector_id=None,
                        token_count=count_tokens(chunk_content),
                    )
                )
                chunk_index += 1

        if not chunk_rows:
            raise ExtractionError("No extractable text found after cleaning.")
        db.add_all(chunk_rows)

        # A document's ready/failed status is decided by extraction/
        # chunking succeeding, not by embedding/vector-store availability
        # (docs/03-constraints.md: keep the MVP resilient) — a failure here
        # is logged and swallowed, leaving vector_id null for this run.
        try:
            vectors = embed_texts([row.text for row in chunk_rows])
            chunk_records = [
                ChunkRecord(
                    chunk_id=str(row.id),
                    chunk_index=row.chunk_index,
                    page_number=row.page_number,
                    text=row.text,
                    embedding=vector,
                    user_id=str(document.user_id),
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
