"""Celery application factory bound to the Flask app context."""

from __future__ import annotations

from typing import TYPE_CHECKING

from celery import Celery

if TYPE_CHECKING:
    from flask import Flask

celery = Celery('module7_tasks')


def init_celery(app: Flask) -> Celery:
    conf = dict(
        broker_url=app.config['CELERY_BROKER_URL'],
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
    )
    rb = app.config.get('CELERY_RESULT_BACKEND')
    if rb:
        conf['result_backend'] = rb
    celery.conf.update(conf)
    if app.config.get('CELERY_TASK_ALWAYS_EAGER'):
        celery.conf.task_always_eager = True
        celery.conf.task_eager_propagates = True

    class ContextTask(celery.Task):
        abstract = True

        def __call__(self, *args, **kwargs):
            from flask import has_app_context

            if has_app_context():
                return super().__call__(*args, **kwargs)
            with app.app_context():
                return super().__call__(*args, **kwargs)

    celery.Task = ContextTask
    return celery
