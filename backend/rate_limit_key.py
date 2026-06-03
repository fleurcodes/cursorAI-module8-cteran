"""Rate limit key: authenticated user id when JWT present, else client IP (PRD NFR-007)."""

from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_limiter.util import get_remote_address


def rate_limit_key() -> str:
    if not request.endpoint or request.endpoint == 'static':
        return get_remote_address()
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid is not None:
            return f'user:{uid}'
    except Exception:
        pass
    return get_remote_address()
