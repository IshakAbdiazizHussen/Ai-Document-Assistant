from pathlib import Path

import pypdf
from docx import Document as DocxDocument


class ExtractionError(Exception):
    """Raised when raw file content cannot be turned into text."""


def extract_text(file_path: str, file_type: str) -> str:
    """Extract raw text from a stored file. Text extraction only — never
    executes or evaluates file content (e.g. no macro execution on DOCX).
    """
    extractors = {
        "pdf": _extract_pdf,
        "docx": _extract_docx,
        "txt": _extract_txt,
    }
    extractor = extractors.get(file_type)
    if extractor is None:
        raise ExtractionError(f"Unsupported file type for extraction: '{file_type}'.")
    return extractor(file_path)


def _extract_pdf(file_path: str) -> str:
    # pypdf parses and walks pages one at a time rather than loading the
    # whole document as a single blob; overall memory use is still bounded
    # by the upload size limit enforced at upload time (Feature 2).
    try:
        reader = pypdf.PdfReader(file_path)
        pages = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:
        raise ExtractionError(f"Failed to extract text from PDF: {exc}") from exc

    text = "\n".join(pages)
    if not text.strip():
        raise ExtractionError("PDF contains no extractable text.")
    return text


def _extract_docx(file_path: str) -> str:
    # python-docx only parses the document XML for text content; it does not
    # execute macros or any embedded code.
    try:
        document = DocxDocument(file_path)
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
    except Exception as exc:
        raise ExtractionError(f"Failed to extract text from DOCX: {exc}") from exc

    text = "\n".join(paragraphs)
    if not text.strip():
        raise ExtractionError("DOCX contains no extractable text.")
    return text


def _extract_txt(file_path: str) -> str:
    try:
        text = Path(file_path).read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise ExtractionError(f"Failed to read TXT file: {exc}") from exc

    if not text.strip():
        raise ExtractionError("TXT file is empty.")
    return text
