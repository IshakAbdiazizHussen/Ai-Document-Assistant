import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models import Chunk, Document, DocumentStatus, User


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def test_document_chunk_relationship_and_cascade_delete(db_session: Session):
    user = User(email="test@example.com", hashed_password="unused-hash")
    db_session.add(user)
    db_session.flush()

    document = Document(
        user_id=user.id,
        filename="report.pdf",
        file_type="pdf",
        file_size_bytes=1024,
        status=DocumentStatus.READY,
        storage_path="storage/uploads/report.pdf",
    )
    db_session.add(document)
    db_session.flush()

    chunk = Chunk(
        document_id=document.id,
        chunk_index=0,
        text="hello world",
        vector_id="vec-1",
        token_count=2,
    )
    db_session.add(chunk)
    db_session.flush()
    db_session.refresh(document)

    assert document.chunks[0].id == chunk.id
    assert chunk.document.id == document.id

    chunk_id = chunk.id
    db_session.delete(document)
    db_session.flush()

    remaining_chunk = db_session.execute(
        select(Chunk).where(Chunk.id == chunk_id)
    ).scalar_one_or_none()
    assert remaining_chunk is None


def test_document_with_invalid_user_id_raises_integrity_error(db_session: Session):
    document = Document(
        user_id=uuid.uuid4(),
        filename="orphan.pdf",
        file_type="pdf",
        file_size_bytes=1,
        status=DocumentStatus.PROCESSING,
        storage_path="storage/uploads/orphan.pdf",
    )
    db_session.add(document)

    with pytest.raises(IntegrityError):
        db_session.flush()
