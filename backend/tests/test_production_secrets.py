"""Production configuration guard (see app._enforce_production_secrets)."""

from __future__ import annotations

import pytest


def test_create_app_rejects_default_secrets_when_flask_env_production(monkeypatch):
    monkeypatch.setenv('FLASK_ENV', 'production')
    from app import create_app

    with pytest.raises(RuntimeError, match='insecure defaults'):
        create_app()


def test_testing_config_skips_production_secret_check_even_if_flask_env_production(monkeypatch):
    """CI / pytest uses TESTING=True; guard must not block the test app factory."""
    monkeypatch.setenv('FLASK_ENV', 'production')
    from app import create_app

    app = create_app(
        {
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
            'JWT_SECRET_KEY': 'test-jwt-secret-key-at-least-32-chars',
            'SECRET_KEY': 'test-secret',
            'CELERY_TASK_ALWAYS_EAGER': True,
            'CELERY_BROKER_URL': 'memory://',
            'CELERY_RESULT_BACKEND': None,
            'CACHE_TYPE': 'SimpleCache',
            'BCRYPT_ROUNDS': 4,
        }
    )
    assert app.config['TESTING'] is True
