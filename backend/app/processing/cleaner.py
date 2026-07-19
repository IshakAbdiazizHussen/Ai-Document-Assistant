import re
import unicodedata


def clean_text(raw_text: str) -> str:
    """Normalize whitespace, strip control characters, collapse blank lines."""
    without_control_chars = "".join(
        ch for ch in raw_text if ch in ("\n", "\t") or unicodedata.category(ch) != "Cc"
    )
    collapsed_spaces = re.sub(r"[ \t]+", " ", without_control_chars)
    stripped_lines = "\n".join(line.strip() for line in collapsed_spaces.splitlines())
    collapsed_blank_lines = re.sub(r"\n{3,}", "\n\n", stripped_lines)
    return collapsed_blank_lines.strip()
