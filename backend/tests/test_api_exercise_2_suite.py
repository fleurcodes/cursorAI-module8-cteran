"""
Exercise 2: comprehensive API coverage for this REST API.

Domain mapping (this codebase does not ship separate ``/products`` or ``/orders``):

- **User management** — ``POST /api/register``, ``POST /api/login``, ``GET /api/profile``,
  ``GET /api/users``, ``GET /api/team``.
- **Product catalog** — **Projects** — ``/api/projects`` (GET/POST), ``/api/projects/<id>``
  (GET/PATCH/DELETE). Updates use **PATCH** (partial update); PUT is asserted as not allowed
  where applicable.
- **Orders** — **Tasks** (line items under a project) and **Support tickets** (customer-facing
  cases with GET/POST/PUT/DELETE on ``/api/tickets``).
"""

from __future__ import annotations

import time

from tests.conftest import auth_header, create_project, register_user


# --- Authentication ---


def test_auth_invalid_jwt_rejected(client):
    r = client.get('/api/profile', headers={'Authorization': 'Bearer totally.invalid.jwt'})
    assert r.status_code in (401, 422)


def test_auth_missing_bearer_rejected(client):
    r = client.get('/api/profile', headers={'Authorization': 'not-a-bearer-token'})
    assert r.status_code in (401, 422)


def test_auth_valid_token_accesses_profile(client):
    tok, _ = register_user(client, 'ex2-profile@example.com')
    r = client.get('/api/profile', headers=auth_header(tok))
    assert r.status_code == 200
    assert r.get_json()['user']['email'] == 'ex2-profile@example.com'


# --- Authorization (role / membership) ---


def test_authorization_non_member_cannot_read_project(client):
    tok_owner, _ = register_user(client, 'ex2-owner@example.com')
    tok_stranger, _ = register_user(client, 'ex2-stranger@example.com')
    pid = create_project(client, tok_owner, 'Private Catalog')

    r = client.get(f'/api/projects/{pid}', headers=auth_header(tok_stranger))
    assert r.status_code == 403


def test_authorization_support_notifications_require_agent_or_admin(client):
    """Plain users (support_role=none) cannot access agent-only support notification APIs."""
    tok, _ = register_user(client, 'ex2-plain@example.com', support_role='none')
    r = client.get('/api/profile/support-notifications', headers=auth_header(tok))
    assert r.status_code == 403


def test_authorization_admin_can_close_ticket_customer_cannot_without_role(client):
    admin_tok = client.post(
        '/api/login',
        json={'email': 'admin@example.com', 'password': 'Test1234*'},
    )
    assert admin_tok.status_code == 200, admin_tok.get_json()
    admin_access = admin_tok.get_json()['access_token']

    cust_tok = register_user(client, 'ex2-cust-close@example.com', support_role='customer')[0]
    create = client.post(
        '/api/tickets',
        json={
            'subject': 'Order-style ticket for RBAC',
            'description': 'Detailed description for validation and workflow tests.',
            'priority': 'medium',
            'category': 'general',
            'auto_assign': False,
        },
        headers=auth_header(cust_tok),
    )
    assert create.status_code == 201, create.get_json()
    tid = create.get_json()['ticket']['id']

    denied = client.put(
        f'/api/tickets/{tid}/status',
        json={'status': 'closed'},
        headers=auth_header(cust_tok),
    )
    assert denied.status_code in (403, 404)

    ok = client.put(
        f'/api/tickets/{tid}/status',
        json={'status': 'closed'},
        headers=auth_header(admin_access),
    )
    assert ok.status_code == 200, ok.get_json()
    assert ok.get_json()['ticket']['status'] == 'closed'


# --- Catalog (projects): CRUD ---


def test_catalog_project_crud_flow(client):
    tok, uid = register_user(client, 'ex2-catalog@example.com')
    h = auth_header(tok)

    r_list0 = client.get('/api/projects', headers=h)
    assert r_list0.status_code == 200
    assert r_list0.get_json()['projects'] == []

    r_post = client.post(
        '/api/projects',
        json={'name': 'Widget Line', 'description': 'Catalog entry', 'member_ids': []},
        headers=h,
    )
    assert r_post.status_code == 201, r_post.get_json()
    pid = r_post.get_json()['project']['id']

    r_get = client.get(f'/api/projects/{pid}', headers=h)
    assert r_get.status_code == 200
    assert r_get.get_json()['project']['name'] == 'Widget Line'

    r_patch = client.patch(
        f'/api/projects/{pid}',
        json={'name': 'Widget Line Pro', 'status': 'at-risk'},
        headers=h,
    )
    assert r_patch.status_code == 200
    assert r_patch.get_json()['project']['name'] == 'Widget Line Pro'

    r_del = client.delete(f'/api/projects/{pid}', headers=h)
    assert r_del.status_code == 200

    r_gone = client.get(f'/api/projects/{pid}', headers=h)
    assert r_gone.status_code == 404


def test_catalog_put_not_allowed_on_project(client):
    tok, _ = register_user(client, 'ex2-put@example.com')
    pid = create_project(client, tok, 'PUT probe')
    r = client.put(f'/api/projects/{pid}', json={'name': 'x'}, headers=auth_header(tok))
    assert r.status_code == 405


# --- Orders (tasks): CRUD under a project ---


def test_orders_task_crud_flow(client):
    tok, _ = register_user(client, 'ex2-tasks@example.com')
    pid = create_project(client, tok, 'Orders Project')
    h = auth_header(tok)

    r_create = client.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Ship unit A', 'priority': 'high'},
        headers=h,
    )
    assert r_create.status_code == 201, r_create.get_json()
    task_id = r_create.get_json()['task']['id']

    r_list = client.get(f'/api/projects/{pid}/tasks', headers=h)
    assert r_list.status_code == 200
    assert len(r_list.get_json()['tasks']) == 1

    r_one = client.get(f'/api/tasks/{task_id}', headers=h)
    assert r_one.status_code == 200

    r_patch = client.patch(
        f'/api/tasks/{task_id}',
        json={'status': 'completed'},
        headers=h,
    )
    assert r_patch.status_code == 200

    r_delete = client.delete(f'/api/tasks/{task_id}', headers=h)
    assert r_delete.status_code == 200

    r_missing = client.get(f'/api/tasks/{task_id}', headers=h)
    assert r_missing.status_code == 404


# --- Orders (tickets): GET / POST / PUT / DELETE ---


def test_orders_ticket_get_post_put_delete(client):
    """Customer creates and reads; PUT update and DELETE are admin-only on this API."""
    cust_tok, _ = register_user(client, 'ex2-tix@example.com', support_role='customer')
    h_cust = auth_header(cust_tok)

    r_post = client.post(
        '/api/tickets',
        json={
            'subject': 'Replacement part request',
            'description': 'Need replacement for SKU-12345 and shipping label.',
            'priority': 'high',
            'category': 'billing',
            'auto_assign': False,
        },
        headers=h_cust,
    )
    assert r_post.status_code == 201, r_post.get_json()
    tid = r_post.get_json()['ticket']['id']

    r_get = client.get(f'/api/tickets/{tid}', headers=h_cust)
    assert r_get.status_code == 200

    r_put_denied = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Customer cannot use this endpoint'},
        headers=h_cust,
    )
    assert r_put_denied.status_code == 403

    admin_login = client.post(
        '/api/login',
        json={'email': 'admin@example.com', 'password': 'Test1234*'},
    )
    assert admin_login.status_code == 200, admin_login.get_json()
    h_admin = auth_header(admin_login.get_json()['access_token'])

    r_put = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Replacement part request (updated)'},
        headers=h_admin,
    )
    assert r_put.status_code == 200, r_put.get_json()

    r_del = client.delete(f'/api/tickets/{tid}', headers=h_admin)
    assert r_del.status_code == 200

    r_404 = client.get(f'/api/tickets/{tid}', headers=h_cust)
    assert r_404.status_code == 404


# --- Input validation ---


def test_validation_register_bad_email(client):
    r = client.post(
        '/api/register',
        json={'full_name': 'X', 'email': 'not-email', 'password': 'password123'},
    )
    assert r.status_code == 400
    assert 'errors' in r.get_json()


def test_validation_task_missing_title(client):
    tok, _ = register_user(client, 'ex2-val-task@example.com')
    pid = create_project(client, tok, 'Validation Project')
    r = client.post(
        f'/api/projects/{pid}/tasks',
        json={'description': 'no title'},
        headers=auth_header(tok),
    )
    assert r.status_code == 400


# --- Error responses: 400 / 404 ---


def test_error_unknown_project_returns_404(client):
    tok, _ = register_user(client, 'ex2-404p@example.com')
    r = client.get('/api/projects/999999', headers=auth_header(tok))
    assert r.status_code == 404
    assert 'not found' in r.get_json().get('message', '').lower()


def test_error_unknown_task_returns_404(client):
    tok, _ = register_user(client, 'ex2-404t@example.com')
    r = client.get('/api/tasks/999999', headers=auth_header(tok))
    assert r.status_code == 404


# --- 500: global error handler ---


def test_error_500_returns_json_message(client):
    """With ``TESTING=True`` Flask propagates exceptions; disable briefly so the 500 handler runs."""
    app = client.application

    def _force_500():
        raise RuntimeError('exercise_2_simulated_failure')

    app.add_url_rule('/__exercise_2_force_500', '__exercise_2_force_500', _force_500, methods=['GET'])
    prev = app.config['TESTING']
    app.config['TESTING'] = False
    try:
        r = client.get('/__exercise_2_force_500')
    finally:
        app.config['TESTING'] = prev
    assert r.status_code == 500
    body = r.get_json()
    assert body is not None
    assert 'message' in body


# --- Performance (single request budget) ---


def test_performance_profile_get_under_500ms(client):
    tok, _ = register_user(client, 'ex2-perf@example.com')
    h = auth_header(tok)
    start = time.perf_counter()
    r = client.get('/api/profile', headers=h)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert r.status_code == 200
    assert elapsed_ms < 500.0, f'GET /api/profile took {elapsed_ms:.1f}ms'


def test_performance_projects_list_under_500ms(client):
    tok, _ = register_user(client, 'ex2-perf2@example.com')
    create_project(client, tok, 'Perf One')
    create_project(client, tok, 'Perf Two')
    h = auth_header(tok)
    start = time.perf_counter()
    r = client.get('/api/projects', headers=h)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert r.status_code == 200
    assert elapsed_ms < 500.0, f'GET /api/projects took {elapsed_ms:.1f}ms'


# --- Rate limiting ---


def test_rate_limit_ticket_create_exceeds_decorator_limit_returns_429(client):
    """``POST /api/tickets`` is limited to 30/minute per user (see ``support_tickets``)."""
    tok, _ = register_user(client, 'ex2-rate@example.com', support_role='customer')
    h = auth_header(tok)
    desc = 'Ticket body for rate limit test. '
    last = None
    for i in range(31):
        last = client.post(
            '/api/tickets',
            json={
                'subject': f'Rate test ticket {i:02d} subj',
                'description': desc * 2,
                'priority': 'low',
                'category': 'general',
                'auto_assign': False,
            },
            headers=h,
        )
    assert last is not None
    assert last.status_code == 429, last.get_json()
    payload = last.get_json()
    assert payload.get('code') == 'RATE_LIMIT_EXCEEDED' or 'request' in payload.get('message', '').lower()


# --- User listing (management surface) ---


def test_user_management_list_users_and_team(client):
    tok_a, _ = register_user(client, 'ex2-team-a@example.com')
    _tok_b, uid_b = register_user(client, 'ex2-team-b@example.com')
    pid = create_project(client, tok_a, 'Shared')
    client.post(
        f'/api/projects/{pid}/members',
        json={'user_id': uid_b, 'role': 'developer'},
        headers=auth_header(tok_a),
    )

    r_users = client.get('/api/users', headers=auth_header(tok_a))
    assert r_users.status_code == 200
    emails = {u['email'] for u in r_users.get_json()['users']}
    assert 'ex2-team-a@example.com' in emails
    assert 'ex2-team-b@example.com' in emails

    r_team = client.get('/api/team', headers=auth_header(tok_a))
    assert r_team.status_code == 200
    assert 'team' in r_team.get_json()
