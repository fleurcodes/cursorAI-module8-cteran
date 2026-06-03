"""Input validation and sanitization (PRD NFR-009, NFR-013, NFR-016)."""

from __future__ import annotations

import re
from typing import Optional

import bleach

# Subject: alphanumeric and common punctuation (PRD FR-001)
SUBJECT_PATTERN = re.compile(r"^[\w\s\-'.,!?()&:;/]{5,200}$", re.UNICODE)

ALLOWED_ATTACHMENT_EXT = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}

# Magic bytes for upload content sniffing (first bytes)
MAGIC_SIGNATURES: list[tuple[bytes, tuple[str, ...]]] = [
    (b'%PDF', ('application/pdf',)),
    (b'\xff\xd8\xff', ('image/jpeg',)),
    (b'\x89PNG\r\n\x1a\n', ('image/png',)),
    (b'\xd0\xcf\x11\xe0', ('application/msword',)),  # legacy .doc
    (b'PK\x03\x04', ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip')),
]


def validate_subject(subject: str) -> Optional[str]:
    s = (subject or '').strip()
    if not SUBJECT_PATTERN.match(s):
        return 'Subject must be 5-200 characters and use letters, numbers, spaces, and common punctuation only.'
    return None


def sanitize_text(text: str, max_length: Optional[int] = None) -> str:
    """Strip HTML/scripts for plain-text fields."""
    cleaned = bleach.clean(text or '', tags=[], attributes={}, strip=True)
    if max_length is not None and len(cleaned) > max_length:
        return cleaned[:max_length]
    return cleaned


def sanitize_comment_body(text: str, max_length: int = 10000) -> str:
    allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'a']
    allowed_attrs = {'a': ['href', 'title', 'rel']}
    cleaned = bleach.clean(text or '', tags=allowed_tags, attributes=allowed_attrs, strip=True)
    return cleaned[:max_length]


def sniff_mime(data: bytes) -> Optional[str]:
    for sig, mimes in MAGIC_SIGNATURES:
        if data.startswith(sig):
            return mimes[0]
    return None
