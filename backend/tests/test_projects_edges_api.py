"""Extra coverage for projects members, PATCH validation, and authorize_project."""

from __future__ import annotations

from unittest.mock import patch

from tests.conftest import auth_header, create_project, register_user


def test_authorize_project_false_when_project_none():
    from models import User
    from resources.projects import authorize_project

    u = User(id=1, full_name='X', email='x@example.com', password_hash='x')
    assert authorize_project(None, u) is False


def test_list_projects_returns_404_when_user_missing(client):
    tok, _ = register_user(client, 'proj-list-miss@example.com')
    # GET /api/projects is bound twice; the user blueprint route is matched first.
    with patch('resources.user.get_current_user', lambda: None), patch(
        'resources.projects.get_current_user', lambda: None
    ):
        r = client.get('/api/projects', headers=auth_header(tok))
    assert r.status_code == 404


def test_patch_project_validation_error(client):
    tok, _ = register_user(client, 'proj-patch-bad@example.com')
    pid = create_project(client, tok, 'Patch Bad Project')
    r = client.patch(
        f'/api/projects/{pid}',
        json={'status': 'not-a-valid-status'},
        headers=auth_header(tok),
    )
    assert r.status_code == 400


def test_get_project_forbidden_non_member(client):
    owner_tok, _ = register_user(client, 'proj-own-403@example.com')
    stranger_tok, _ = register_user(client, 'proj-str-403@example.com')
    pid = create_project(client, owner_tok, 'Private Proj')
    r = client.get(f'/api/projects/{pid}', headers=auth_header(stranger_tok))
    assert r.status_code == 403


def test_list_project_members_success_and_forbidden(client):
    owner_tok, _ = register_user(client, 'proj-mem-own@example.com')
    peer_tok, _ = register_user(client, 'proj-mem-peer@example.com')
    pid = create_project(client, owner_tok, 'Members Proj')
    r_ok = client.get(f'/api/projects/{pid}/members', headers=auth_header(owner_tok))
    assert r_ok.status_code == 200
    r_forb = client.get(f'/api/projects/{pid}/members', headers=auth_header(peer_tok))
    assert r_forb.status_code == 403


def test_add_project_member_duplicate_returns_409(client):
    owner_tok, owner_id = register_user(client, 'proj-dup-own@example.com')
    pid = create_project(client, owner_tok, 'Dup Member Proj')
    r2 = client.post(
        f'/api/projects/{pid}/members',
        json={'user_id': owner_id},
        headers=auth_header(owner_tok),
    )
    assert r2.status_code == 409


def test_add_project_member_unknown_user_returns_404(client):
    owner_tok, _ = register_user(client, 'proj-add404-own@example.com')
    pid = create_project(client, owner_tok, 'Add404 Proj')
    r = client.post(
        f'/api/projects/{pid}/members',
        json={'user_id': 999_998},
        headers=auth_header(owner_tok),
    )
    assert r.status_code == 404


def test_add_project_member_validation_error(client):
    owner_tok, _ = register_user(client, 'proj-add400-own@example.com')
    pid = create_project(client, owner_tok, 'Add400 Proj')
    r = client.post(
        f'/api/projects/{pid}/members',
        json={},
        headers=auth_header(owner_tok),
    )
    assert r.status_code == 400


def test_remove_project_member_not_found_returns_404(client):
    owner_tok, _ = register_user(client, 'proj-rem404-own@example.com')
    pid = create_project(client, owner_tok, 'Rem404 Proj')
    r = client.delete(f'/api/projects/{pid}/members/999997', headers=auth_header(owner_tok))
    assert r.status_code == 404


def test_delete_project_forbidden_non_member(client):
    owner_tok, _ = register_user(client, 'proj-del-own@example.com')
    stranger_tok, _ = register_user(client, 'proj-del-str@example.com')
    pid = create_project(client, owner_tok, 'Del Proj')
    r = client.delete(f'/api/projects/{pid}', headers=auth_header(stranger_tok))
    assert r.status_code == 403
