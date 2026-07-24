import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.document import (
    DocumentCreateResponse,
    DocumentDetail,
    DocumentListItem,
    DocumentPageOut,
)
from app.services import document_service
from app.services.document_service import DocumentNotFoundError, DocumentPageNotFoundError
from app.utils.file_validation import FileTooLargeError, UnsupportedFileTypeError

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentCreateResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentCreateResponse:
    try:
        document = await document_service.save_upload(file, db, current_user)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(exc)
        ) from exc

    # Snapshot the response while status is still "processing" (Feature 2's
    # contract), then run the pipeline. process_document() never raises —
    # it resolves the document to "ready"/"failed" itself.
    response = DocumentCreateResponse.model_validate(document)
    document_service.process_document(db, document.id)
    return response


@router.get("", response_model=list[DocumentListItem])
def list_documents(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[DocumentListItem]:
    return document_service.list_documents(db, current_user)


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentDetail:
    try:
        return document_service.get_document_for_user(db, document_id, current_user)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        document_service.delete_document(db, document_id, current_user)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc


@router.get("/{document_id}/pages/{page_number}", response_model=DocumentPageOut)
def get_document_page(
    document_id: uuid.UUID,
    page_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentPageOut:
    try:
        document = document_service.get_document_for_user(db, document_id, current_user)
        page = document_service.get_document_page(db, document_id, page_number, current_user)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc
    except DocumentPageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found") from exc

    return DocumentPageOut(
        page_number=page.page_number,
        total_pages=document.page_count or page.page_number,
        text=page.text,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    try:
        document = document_service.get_document_for_user(db, document_id, current_user)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc

    return FileResponse(
        document.storage_path,
        filename=document.filename,
        media_type="application/octet-stream",
    )
