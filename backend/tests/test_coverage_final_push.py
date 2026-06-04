"""Small tests to push total coverage past 90% (rate limit key, tasks side-effects, models, multipart ticket create)."""

from __future__ import annotations

import pytest
from werkzeug.security import generate_password_hash

from tests.conftest import auth_header, create_project, register_user


def test_rate_limit_key_when_request_endpoint_missing(app):
    with app.test_request_context('/___coverage_no_route___'):
        from rate_limit_key import rate_limit_key

        out = rate_limit_key()
        assert isinstance(out, str)
        assert len(out) > 0


def test_user_check_password_werkzeug_legacy_hash(app):
    with app.app_context():
        from extensions import db
        from models import User

        u = User(
            full_name='Legacy Hash User',
            email='legacy-hash-user@example.com',
            password_hash=generate_password_hash('secretpass', method='pbkdf2:sha256'),
        )
        db.session.add(u)
        db.session.commit()
        assert u.check_password('secretpass') is True


def test_create_task_triggers_celery_delay_when_not_eager(app, client, monkeypatch):
    app.config['CELERY_TASK_ALWAYS_EAGER'] = False
    delays: list = []
    monkeypatch.setattr(
        'resources.tasks.warm_project_tasks_list_cache.delay',
        lambda project_id: delays.append(project_id),
    )
    monkeypatch.setattr(
        'resources.tasks.recompute_project_metrics.delay',
        lambda project_id: delays.append(('metrics', project_id)),
    )

    tok, _ = register_user(client, 'task-delay-owner@example.com')
    pid = create_project(client, tok, 'Delay Project')
    r = client.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Task for delay path', 'description': 'd'},
        headers=auth_header(tok),
    )
    assert r.status_code == 201
    assert any(isinstance(x, int) for x in delays)


def test_patch_task_assignee_auto_adds_non_member(app, client):
    owner_tok, _ = register_user(client, 'task-patch-own@example.com')
    peer_tok, peer_id = register_user(client, 'task-patch-peer@example.com')
    third_tok, third_id = register_user(client, 'task-patch-third@example.com')
    pid = create_project(client, owner_tok, 'Patch Assign Project')
    r0 = client.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Assignable task title', 'description': 'd', 'assignee_id': peer_id},
        headers=auth_header(owner_tok),
    )
    assert r0.status_code == 201
    tid = r0.get_json()['task']['id']

    r1 = client.patch(
        f'/api/tasks/{tid}',
        json={'assignee_id': third_id},
        headers=auth_header(owner_tok),
    )
    assert r1.status_code == 200
    assert r1.get_json()['task']['assignee']['id'] == third_id


def test_patch_task_validation_error_returns_400(client, task_api_context):
    c = task_api_context['client']
    tok = task_api_context['owner_token']
    pid = task_api_context['project_id']
    r0 = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Patch validation task', 'description': 'd'},
        headers=auth_header(tok),
    )
    tid = r0.get_json()['task']['id']
    r = c.patch(f'/api/tasks/{tid}', json={'status': 'not-valid'}, headers=auth_header(tok))
    assert r.status_code == 400


def test_create_task_assignee_not_found_returns_404(client, task_api_context):
    c = task_api_context['client']
    tok = task_api_context['owner_token']
    pid = task_api_context['project_id']
    r = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Missing assignee task', 'description': 'd', 'assignee_id': 999_996},
        headers=auth_header(tok),
    )
    assert r.status_code == 404


def test_multipart_create_ticket_with_pdf_attachment(client):
    from io import BytesIO

    r_reg = client.post(
        '/api/register',
        json={
            'full_name': 'Multipart Customer',
            'email': 'mp-create-cust@example.com',
            'password': 'password123',
            'support_role': 'customer',
        },
    )
    assert r_reg.status_code == 201, r_reg.get_json()
    cust_tok = r_reg.get_json()['access_token']
    pdf = b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
    data = {
        'subject': 'Multipart ticket with file ok',
        'description': 'Long enough description for multipart ticket creation.',
        'priority': 'low',
        'category': 'general',
        'auto_assign': 'false',
        'files': (BytesIO(pdf), 'spec.pdf'),
    }
    r = client.post('/api/tickets', data=data, headers=auth_header(cust_tok))
    assert r.status_code == 201, r.get_json()


def test_socketio_join_project_without_project_id(app, client):
    from extensions import socketio

    tok, _ = register_user(client, 'sio-join-empty@example.com')
    sio = socketio.test_client(app, flask_test_client=client, query_string=f'jwt={tok}')
    assert sio.is_connected()
    sio.emit('join_project', {})
    sio.disconnect()


def test_post_comment_docx_magic_bytes_accepted(client):
    from io import BytesIO

    r_reg = client.post(
        '/api/register',
        json={
            'full_name': 'Docx Customer',
            'email': 'docx-cust@example.com',
            'password': 'password123',
            'support_role': 'customer',
        },
    )
    assert r_reg.status_code == 201
    tok_c = r_reg.get_json()['access_token']
    adm_tok, _ = register_user(client, 'docx-adm@example.com', 'Admin Docx', 'admin')
    tid = (
        client.post(
            '/api/tickets',
            json={
                'subject': 'Docx attach ticket subject ok',
                'description': 'Description long enough for ticket validation rules.',
                'priority': 'low',
                'category': 'general',
                'auto_assign': False,
            },
            headers=auth_header(tok_c),
        )
        .get_json()['ticket']['id']
    )
    docx_like = b'PK\x03\x04' + bytes(80)
    data = {'content': 'Comment with minimal OOXML zip header.', 'files': (BytesIO(docx_like), 'memo.docx')}
    r = client.post(f'/api/tickets/{tid}/comments', data=data, headers=auth_header(adm_tok))
    assert r.status_code == 201, r.get_json()


def test_create_ticket_description_too_short_returns_400(client):
    r_reg = client.post(
        '/api/register',
        json={
            'full_name': 'Short Desc User',
            'email': 'short-desc@example.com',
            'password': 'password123',
            'support_role': 'customer',
        },
    )
    tok = r_reg.get_json()['access_token']
    r = client.post(
        '/api/tickets',
        json={
            'subject': 'Valid subject line ok',
            'description': 'too short',
            'priority': 'low',
            'category': 'general',
        },
        headers=auth_header(tok),
    )
    assert r.status_code == 400


def test_list_tasks_project_not_found_returns_404(client):
    tok, _ = register_user(client, 'tasks-404-proj@example.com')
    r = client.get('/api/projects/999991/tasks', headers=auth_header(tok))
    assert r.status_code == 404


def test_post_comment_jpeg_attachment_accepted(client):
    from io import BytesIO

    r_reg = client.post(
        '/api/register',
        json={
            'full_name': 'Jpeg Customer',
            'email': 'jpeg-cust@example.com',
            'password': 'password123',
            'support_role': 'customer',
        },
    )
    assert r_reg.status_code == 201, r_reg.get_json()
    tok_c = r_reg.get_json()['access_token']
    adm_tok, _ = register_user(client, 'jpeg-adm@example.com', 'Admin Jpeg', 'admin')
    tid = (
        client.post(
            '/api/tickets',
            json={
                'subject': 'Jpeg attach ticket subject ok',
                'description': 'Description long enough for ticket validation rules.',
                'priority': 'low',
                'category': 'general',
                'auto_assign': False,
            },
            headers=auth_header(tok_c),
        )
        .get_json()['ticket']['id']
    )
    jpeg = b'\xff\xd8\xff\xe0' + bytes(120)
    data = {'content': 'Agent uploads a JPEG attachment.', 'files': (BytesIO(jpeg), 'evidence.jpg')}
    r = client.post(f'/api/tickets/{tid}/comments', data=data, headers=auth_header(adm_tok))
    assert r.status_code == 201, r.get_json()


def test_post_comment_skips_empty_filename_upload(client):
    from io import BytesIO

    r_reg = client.post(
        '/api/register',
        json={
            'full_name': 'Empty fname cust',
            'email': 'empty-fname@example.com',
            'password': 'password123',
            'support_role': 'customer',
        },
    )
    assert r_reg.status_code == 201
    tok_c = r_reg.get_json()['access_token']
    adm_tok, _ = register_user(client, 'empty-fname-adm@example.com', 'Admin EF', 'admin')
    tid = (
        client.post(
            '/api/tickets',
            json={
                'subject': 'Empty filename ticket subject ok',
                'description': 'Description long enough for ticket validation rules.',
                'priority': 'low',
                'category': 'general',
                'auto_assign': False,
            },
            headers=auth_header(tok_c),
        )
        .get_json()['ticket']['id']
    )
    data = {
        'content': 'Comment with empty filename file part.',
        'files': (BytesIO(b'%PDF-1.4'), ''),
    }
    r = client.post(f'/api/tickets/{tid}/comments', data=data, headers=auth_header(adm_tok))
    assert r.status_code == 201, r.get_json()
