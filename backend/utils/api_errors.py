"""Standard API error payloads (PRD section 8)."""

from typing import Optional

from flask import jsonify


def error_response(
    message: str,
    code: str,
    status_code: int,
    errors: Optional[dict] = None,
):
    body = {
        'status': 'error',
        'message': message,
        'code': code,
    }
    if errors:
        body['errors'] = errors
    return jsonify(body), status_code


def validation_error(errors: dict, message: str = 'Validation failed'):
    return error_response(message, 'VALIDATION_ERROR', 400, errors=errors)
