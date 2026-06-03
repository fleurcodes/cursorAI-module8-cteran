"""Shared pytest fixtures for the Flask API."""

from __future__ import annotations

from pathlib import Path

import pytest

from app import create_app


def pytest_collection_finish(session):
    """Only enforce --cov-fail-under when every test module under tests/ is collected."""
    if session.config.getoption('collectonly', default=False):
        return

    config = session.config
    opt = getattr(config.option, 'cov_fail_under', None)
    if opt is None:
        return

    if config.getoption('keyword', default=None):
        _clear_cov_fail_under(config)
        return

    tests_dir = Path(__file__).resolve().parent
    all_test_files = {p.name for p in tests_dir.glob('test_*.py')}
    collected_files = set()
    for item in session.items:
        path = getattr(item, 'path', None)
        if path is None:
            path = Path(item.fspath)
        collected_files.add(path.name)

    if collected_files != all_test_files:
        _clear_cov_fail_under(config)


def _clear_cov_fail_under(config) -> None:
    config.option.cov_fail_under = None
    cov = config.pluginmanager.get_plugin('_cov')
    if cov is not None:
        cov.options.cov_fail_under = None


@pytest.fixture()
def app():
    application = create_app(
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
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


def register_user(client, email: str, full_name: str = 'Test User', support_role: str = 'none'):
    r = client.post(
        '/api/register',
        json={
            'full_name': full_name,
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    data = r.get_json()
    return data['access_token'], data['user']['id']


def auth_header(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def create_project(client, token: str, name: str = 'Alpha Project') -> int:
    r = client.post(
        '/api/projects',
        json={'name': name, 'description': 'd', 'member_ids': []},
        headers=auth_header(token),
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()['project']['id']


@pytest.fixture()
def task_api_context(client):
    """One owner with a project ready for task CRUD."""
    tok_a, uid_a = register_user(client, 'owner-tasks@example.com')
    tok_b, _uid_b = register_user(client, 'peer-tasks@example.com')
    project_id = create_project(client, tok_a, 'Mission Tasks')
    return {
        'client': client,
        'owner_token': tok_a,
        'owner_id': uid_a,
        'other_token': tok_b,
        'project_id': project_id,
    }
