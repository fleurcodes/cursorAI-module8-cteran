"""HTTP request/response logging (method, path, status, latency)."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from flask import Flask


def init_request_logging(app: Flask) -> None:
    @app.before_request
    def _request_timer() -> None:
        from flask import g

        g._http_request_started = time.perf_counter()

    @app.after_request
    def _request_log(response):
        from flask import current_app, g, request

        start = getattr(g, '_http_request_started', None)
        elapsed_ms = int((time.perf_counter() - start) * 1000) if start is not None else -1
        current_app.logger.info('%s %s %s %sms', request.method, request.path, response.status_code, elapsed_ms)
        return response
