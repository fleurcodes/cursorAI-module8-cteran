"""Validation helpers (utils.validation) and schema-level ticket rules."""

from __future__ import annotations

import pytest
from marshmallow import ValidationError

from schemas_support import TicketCreateSchema
from utils import validation as v


def test_validate_subject_accepts_valid_ticket_title():
    assert v.validate_subject('Login problem with SSO') is None


def test_validate_subject_rejects_too_short():
    err = v.validate_subject('Hi')
    assert err is not None
    assert '5-200' in err or 'characters' in err


def test_validate_subject_rejects_disallowed_characters():
    err = v.validate_subject('Valid length but bad char <script>')
    assert err is not None


def test_validate_subject_strips_whitespace():
    assert v.validate_subject('  Enough chars here ok  ') is None


def test_sanitize_text_strips_html():
    assert v.sanitize_text('<p>Hello</p>') == 'Hello'


def test_sanitize_text_truncates_with_max_length():
    long_text = 'a' * 100
    assert len(v.sanitize_text(long_text, max_length=20)) == 20


def test_sanitize_comment_body_allows_limited_markup():
    raw = '<p>Hi</p><script>x</script><strong>bold</strong>'
    out = v.sanitize_comment_body(raw)
    assert 'bold' in out
    assert '<script>' not in out.lower()


def test_sniff_mime_pdf():
    assert v.sniff_mime(b'%PDF-1.4\n%') == 'application/pdf'


def test_sniff_mime_jpeg():
    assert v.sniff_mime(b'\xff\xd8\xff\xe0' + b'\x00' * 20) == 'image/jpeg'


def test_sniff_mime_unknown():
    assert v.sniff_mime(b'not-a-real-file') is None


def test_allowed_attachment_ext_contains_common_types():
    assert '.pdf' in v.ALLOWED_ATTACHMENT_EXT
    assert '.png' in v.ALLOWED_ATTACHMENT_EXT


def test_ticket_create_schema_subject_validation():
    schema = TicketCreateSchema()
    with pytest.raises(ValidationError):
        schema.load(
            {
                'subject': 'bad',
                'description': 'x' * 25,
                'priority': 'low',
                'category': 'general',
            }
        )


def test_ticket_create_schema_description_min_length():
    schema = TicketCreateSchema()
    with pytest.raises(ValidationError):
        schema.load(
            {
                'subject': 'Valid subject line here',
                'description': 'short',
                'priority': 'low',
                'category': 'general',
            }
        )


def test_ticket_create_schema_valid_payload():
    schema = TicketCreateSchema()
    data = schema.load(
        {
            'subject': 'Printer will not connect',
            'description': 'Detailed description of the printer issue here.',
            'priority': 'medium',
            'category': 'technical',
            'auto_assign': False,
        }
    )
    assert data['subject'].startswith('Printer')
