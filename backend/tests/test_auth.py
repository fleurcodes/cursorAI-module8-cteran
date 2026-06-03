"""Authentication: register, login, JWT access to protected routes."""

from __future__ import annotations

from tests.conftest import auth_header, create_project, register_user


def test_register_returns_token_and_user(client):
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Auth User',
            'email': 'auth-user@example.com',
            'password': 'password123',
            'role': 'developer',
            'support_role': 'none',
        },
    )
    assert r.status_code == 201, r.get_json()
    body = r.get_json()
    assert 'access_token' in body
    assert body['user']['email'] == 'auth-user@example.com'
    assert body['user']['full_name'] == 'Auth User'


def test_register_duplicate_email_returns_409(client):
    email = 'dup-auth@example.com'
    assert client.post(
        '/api/register',
        json={'full_name': 'One', 'email': email, 'password': 'password123'},
    ).status_code == 201
    r2 = client.post(
        '/api/register',
        json={'full_name': 'Two', 'email': email, 'password': 'password123'},
    )
    assert r2.status_code == 409
    assert 'already' in r2.get_json().get('message', '').lower()


def test_register_invalid_email_returns_400(client):
    r = client.post(
        '/api/register',
        json={'full_name': 'Bad', 'email': 'not-an-email', 'password': 'password123'},
    )
    assert r.status_code == 400
    assert 'errors' in r.get_json()


def test_register_short_password_returns_400(client):
    r = client.post(
        '/api/register',
        json={'full_name': 'Bad', 'email': 'shortpw@example.com', 'password': 'short'},
    )
    assert r.status_code == 400


def test_login_success_returns_token(client):
    register_user(client, 'login-ok@example.com', full_name='Login Ok')
    r = client.post(
        '/api/login',
        json={'email': 'login-ok@example.com', 'password': 'password123'},
    )
    assert r.status_code == 200, r.get_json()
    assert 'access_token' in r.get_json()


def test_login_invalid_password_returns_401(client):
    register_user(client, 'login-bad@example.com')
    r = client.post(
        '/api/login',
        json={'email': 'login-bad@example.com', 'password': 'wrong-password'},
    )
    assert r.status_code == 401


def test_login_unknown_email_returns_401(client):
    r = client.post(
        '/api/login',
        json={'email': 'nobody@example.com', 'password': 'password123'},
    )
    assert r.status_code == 401


def test_login_invalid_payload_returns_400(client):
    r = client.post('/api/login', json={'email': 'x', 'password': 'y'})
    assert r.status_code == 400


def test_protected_route_without_token_returns_401(client):
    r = client.get('/api/projects')
    assert r.status_code == 401


def test_protected_route_with_valid_token_returns_200(client):
    tok, _ = register_user(client, 'protected@example.com')
    r = client.get('/api/projects', headers=auth_header(tok))
    assert r.status_code == 200
    assert 'projects' in r.get_json()


def test_protected_route_with_malformed_authorization_returns_401(client):
    r = client.get('/api/projects', headers={'Authorization': 'NotBearer xyz'})
    assert r.status_code == 422 or r.status_code == 401


def test_register_then_create_project_flow(client):
    tok, _ = register_user(client, 'flow-auth@example.com')
    pid = create_project(client, tok, 'Auth Flow Project')
    assert isinstance(pid, int)
