import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.document import DocumentCreateResponse, DocumentDetail, DocumentListItem
from app.services import document_service
from app.services.document_service import DocumentNotFoundError
from app.utils.file_validation import FileTooLargeError, UnsupportedFileTypeError

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentCreateResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...), db: Session = Depends(get_db)
) -> DocumentCreateResponse:
    try:
        document = await document_service.save_upload(file, db)
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
def list_documents(db: Session = Depends(get_db)) -> list[DocumentListItem]:
    return document_service.list_documents(db)


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> DocumentDetail:
    try:
        return document_service.get_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    try:
        document_service.delete_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from exc
