from pathlib import Path

import pypdf
from docx import Document as DocxDocument

# Word/plain-text formats don't carry any real page-break information we can
# read back out (DOCX pagination is a render-time layout concern; TXT has no
# page concept at all), so their content is paginated into fixed-size windows
# purely so the document viewer has something consistent to page through.
# This is a defined convention, not a claim that it matches how the file
# would paginate if printed.
_VIRTUAL_PAGE_WORD_COUNT = 500


class ExtractionError(Exception):
    """Raised when raw file content cannot be turned into text."""


def extract_pages(file_path: str, file_type: str) -> list[str]:
    """Extract raw text from a stored file, one entry per page. PDF pages are
    real; DOCX/TXT are split into fixed-size virtual pages (see module
    docstring above). Text extraction only — never executes or evaluates
    file content (e.g. no macro execution on DOCX).
    """
    extractors = {
        "pdf": _extract_pdf_pages,
        "docx": _extract_docx_pages,
        "txt": _extract_txt_pages,
    }
    extractor = extractors.get(file_type)
    if extractor is None:
        raise ExtractionError(f"Unsupported file type for extraction: '{file_type}'.")

    pages = extractor(file_path)
    if not any(page.strip() for page in pages):
        raise ExtractionError(f"{file_type.upper()} contains no extractable text.")
    return pages


def extract_text(file_path: str, file_type: str) -> str:
    """Backward-compatible single-string extraction, built on extract_pages()."""
    return "\n".join(extract_pages(file_path, file_type))


def _extract_pdf_pages(file_path: str) -> list[str]:
    # pypdf parses and walks pages one at a time rather than loading the
    # whole document as a single blob; overall memory use is still bounded
    # by the upload size limit enforced at upload time (Feature 2).
    try:
        reader = pypdf.PdfReader(file_path)
        return [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:
        raise ExtractionError(f"Failed to extract text from PDF: {exc}") from exc


def _extract_docx_pages(file_path: str) -> list[str]:
    # python-docx only parses the document XML for text content; it does not
    # execute macros or any embedded code.
    try:
        document = DocxDocument(file_path)
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
    except Exception as exc:
        raise ExtractionError(f"Failed to extract text from DOCX: {exc}") from exc

    return _paginate(paragraphs)


def _extract_txt_pages(file_path: str) -> list[str]:
    try:
        text = Path(file_path).read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise ExtractionError(f"Failed to read TXT file: {exc}") from exc

    return _paginate(text.splitlines())


def _paginate(lines: list[str], words_per_page: int = _VIRTUAL_PAGE_WORD_COUNT) -> list[str]:
    """Group lines into virtual pages of roughly `words_per_page` words each,
    preserving line order and content exactly (just re-bucketed).
    """
    pages: list[str] = []
    current_lines: list[str] = []
    current_word_count = 0

    for line in lines:
        current_lines.append(line)
        current_word_count += len(line.split())
        if current_word_count >= words_per_page:
            pages.append("\n".join(current_lines))
            current_lines = []
            current_word_count = 0

    if current_lines:
        pages.append("\n".join(current_lines))

    return pages or [""]
