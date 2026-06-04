"""API breadth tests for notifications, user/support profile, admin, agents, and ticket listing."""

from __future__ import annotations

from tests.conftest import auth_header, create_project, register_user


def _register_support(client, email: str, support_role: str) -> tuple[str, int]:
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Breadth User',
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    data = r.get_json()
    return data['access_token'], data['user']['id']


def test_notifications_list_empty(client):
    tok, _ = register_user(client, 'notif-empty@example.com')
    r = client.get('/api/notifications', headers=auth_header(tok))
    assert r.status_code == 200
    assert r.get_json().get('notifications') == []


def test_send_notification_and_mark_read(client):
    tok_a, _uid_a = register_user(client, 'notif-sender@example.com')
    tok_b, uid_b = register_user(client, 'notif-recipient@example.com')
    r = client.post(
        '/api/notifications/send',
        json={'user_id': uid_b, 'title': 'Hello', 'message': 'Test message body', 'level': 'info'},
        headers=auth_header(tok_a),
    )
    assert r.status_code == 201, r.get_json()
    nid = r.get_json()['notification']['id']

    r2 = client.get('/api/notifications', headers=auth_header(tok_b))
    assert r2.status_code == 200
    assert len(r2.get_json()['notifications']) >= 1

    r3 = client.patch(f'/api/notifications/{nid}/read', headers=auth_header(tok_b))
    assert r3.status_code == 200
    assert r3.get_json()['notification']['is_read'] is True


def test_send_notification_recipient_not_found(client):
    tok, _ = register_user(client, 'notif-bad-recip@example.com')
    r = client.post(
        '/api/notifications/send',
        json={'user_id': 999_999, 'title': 'Hello', 'message': 'Body text here'},
        headers=auth_header(tok),
    )
    assert r.status_code == 404


def test_send_notification_with_project(client):
    tok_owner, _ = register_user(client, 'notif-proj-owner@example.com')
    pid = create_project(client, tok_owner, 'Notif Project')
    _tok_b, uid_b = register_user(client, 'notif-proj-peer@example.com')
    r = client.post(
        '/api/notifications/send',
        json={
            'user_id': uid_b,
            'project_id': pid,
            'title': 'Project ping',
            'message': 'Hello',
        },
        headers=auth_header(tok_owner),
    )
    assert r.status_code == 201, r.get_json()


def test_send_notification_project_not_found(client):
    tok_a, _ = register_user(client, 'notif-bad-proj-a@example.com')
    _tok_b, uid_b = register_user(client, 'notif-bad-proj-b@example.com')
    r = client.post(
        '/api/notifications/send',
        json={'user_id': uid_b, 'project_id': 999_999, 'title': 'Title', 'message': 'Message body ok'},
        headers=auth_header(tok_a),
    )
    assert r.status_code == 404


def test_send_notification_invalid_payload(client):
    tok, _ = register_user(client, 'notif-invalid@example.com')
    r = client.post('/api/notifications/send', json={'user_id': 'nope'}, headers=auth_header(tok))
    assert r.status_code == 400


def test_list_users_and_team_api(client):
    tok, _ = register_user(client, 'breadth-users@example.com')
    r = client.get('/api/users', headers=auth_header(tok))
    assert r.status_code == 200
    assert 'users' in r.get_json()

    r2 = client.get('/api/team', headers=auth_header(tok))
    assert r2.status_code == 200
    body = r2.get_json()
    assert 'team' in body and 'user' in body


def test_user_list_projects(client):
    tok, _ = register_user(client, 'breadth-proj-list@example.com')
    create_project(client, tok, 'Owned By Breadth')
    r = client.get('/api/projects', headers=auth_header(tok))
    assert r.status_code == 200
    assert len(r.get_json().get('projects', [])) >= 1


def test_support_profile_notifications_agent(client):
    tok, _ = _register_support(client, 'breadth-agent-notif@example.com', 'agent')
    r = client.get('/api/profile/support-notifications', headers=auth_header(tok))
    assert r.status_code == 200
    assert r.get_json().get('status') == 'ok'


def test_support_profile_notifications_forbidden_for_customer(client):
    tok, _ = _register_support(client, 'breadth-cust-notif@example.com', 'customer')
    r = client.get('/api/profile/support-notifications', headers=auth_header(tok))
    assert r.status_code == 403


def test_support_notification_preferences_update(client):
    tok, _ = _register_support(client, 'breadth-pref@example.com', 'agent')
    r = client.put(
        '/api/profile/support-notification-preferences',
        json={'email_ticket_created': False, 'in_app_enabled': True},
        headers=auth_header(tok),
    )
    assert r.status_code == 200


def test_support_notification_preferences_invalid(client):
    tok, _ = _register_support(client, 'breadth-pref-bad@example.com', 'agent')
    r = client.put(
        '/api/profile/support-notification-preferences',
        json={'email_ticket_created': 'not-a-bool'},
        headers=auth_header(tok),
    )
    assert r.status_code == 400


def test_mark_support_notification_read_not_found(client):
    tok, _ = _register_support(client, 'breadth-mark-nf@example.com', 'agent')
    r = client.put('/api/profile/support-notifications/999999/read', headers=auth_header(tok))
    assert r.status_code == 404


def test_list_tickets_requires_support_portal(client):
    tok, _ = register_user(client, 'breadth-no-support@example.com')
    r = client.get('/api/tickets', headers=auth_header(tok))
    assert r.status_code == 403


def test_list_tickets_customer_sees_own(client):
    cust_tok, _ = _register_support(client, 'breadth-tix-cust@example.com', 'customer')
    cr = client.post(
        '/api/tickets',
        json={
            'subject': 'Breadth ticket subject line',
            'description': 'Enough characters in description here.',
            'priority': 'low',
            'category': 'general',
            'auto_assign': False,
        },
        headers=auth_header(cust_tok),
    )
    assert cr.status_code == 201, cr.get_json()
    r = client.get('/api/tickets', headers=auth_header(cust_tok))
    assert r.status_code == 200
    data = r.get_json()
    assert data.get('status') == 'ok'
    assert len(data.get('tickets', [])) >= 1


def test_list_tickets_admin_filters(client):
    adm_tok, _ = _register_support(client, 'breadth-tix-admin@example.com', 'admin')
    r = client.get('/api/tickets?status=open&status=closed&page=1&per_page=10', headers=auth_header(adm_tok))
    assert r.status_code == 200
    r2 = client.get('/api/tickets?q=Ticket&unassigned=1', headers=auth_header(adm_tok))
    assert r2.status_code == 200


def test_admin_dashboard_and_reports(client):
    adm_tok, _ = _register_support(client, 'breadth-admin-dash@example.com', 'admin')
    r = client.get('/api/admin/dashboard', headers=auth_header(adm_tok))
    assert r.status_code == 200
    assert 'metrics' in r.get_json()

    r2 = client.get('/api/admin/reports/tickets?period=daily', headers=auth_header(adm_tok))
    assert r2.status_code == 200
    r3 = client.get('/api/admin/reports/tickets?period=weekly', headers=auth_header(adm_tok))
    assert r3.status_code == 200
    r4 = client.get('/api/admin/reports/tickets?period=monthly', headers=auth_header(adm_tok))
    assert r4.status_code == 200

    r5 = client.get('/api/admin/reports/agents', headers=auth_header(adm_tok))
    assert r5.status_code == 200
    r6 = client.get('/api/admin/reports/sla', headers=auth_header(adm_tok))
    assert r6.status_code == 200


def test_admin_dashboard_forbidden_for_agent(client):
    tok, _ = _register_support(client, 'breadth-agent-dash@example.com', 'agent')
    r = client.get('/api/admin/dashboard', headers=auth_header(tok))
    assert r.status_code == 403


def test_admin_reports_export_json(client):
    adm_tok, _ = _register_support(client, 'breadth-export-json@example.com', 'admin')
    r = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'tickets', 'format': 'json'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body.get('status') == 'ok'


def test_admin_reports_export_csv(client):
    adm_tok, _ = _register_support(client, 'breadth-export-csv@example.com', 'admin')
    r = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'tickets', 'format': 'csv'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    ct = r.headers.get('Content-Type', '')
    assert 'csv' in ct or r.mimetype == 'text/csv'


def test_admin_reports_export_validation_error(client):
    adm_tok, _ = _register_support(client, 'breadth-export-bad@example.com', 'admin')
    r = client.post('/api/admin/reports/export', json={}, headers=auth_header(adm_tok))
    assert r.status_code == 400


def test_list_agents_admin_and_agent(client):
    adm_tok, _ = _register_support(client, 'breadth-ag-list-adm@example.com', 'admin')
    ag_tok, _ = _register_support(client, 'breadth-ag-list-ag@example.com', 'agent')
    r = client.get('/api/agents', headers=auth_header(adm_tok))
    assert r.status_code == 200
    r2 = client.get('/api/agents', headers=auth_header(ag_tok))
    assert r2.status_code == 200


def test_list_agents_forbidden_customer(client):
    tok, _ = _register_support(client, 'breadth-ag-cust@example.com', 'customer')
    r = client.get('/api/agents', headers=auth_header(tok))
    assert r.status_code == 403


def test_agent_tickets_self(client):
    ag_tok, ag_id = _register_support(client, 'breadth-agent-self@example.com', 'agent')
    r = client.get(f'/api/agents/{ag_id}/tickets', headers=auth_header(ag_tok))
    assert r.status_code == 200


def test_agent_tickets_admin_views_other(client):
    adm_tok, _ = _register_support(client, 'breadth-adm-agtix@example.com', 'admin')
    _ag_tok, ag_id = _register_support(client, 'breadth-agent-target@example.com', 'agent')
    r = client.get(f'/api/agents/{ag_id}/tickets', headers=auth_header(adm_tok))
    assert r.status_code == 200
