"""
Celery worker entrypoint.

Run from the backend directory:
  celery -A celery_worker.celery worker --loglevel=info
"""

from celery_app import celery

import app  # noqa: F401, E402 — bootstraps create_app(), Celery, and task modules

__all__ = ['celery']
