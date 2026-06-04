"""Admin reports export (all CSV branches), user list/update, and RBAC."""

from __future__ import annotations

from tests.conftest import auth_header


def _reg(client, email: str, support_role: str) -> tuple[str, int]:
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Admin Export Tester',
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    return d['access_token'], d['user']['id']


def test_admin_export_csv_agents_sla_categories(client):
    adm_tok, _ = _reg(client, 'adm-exp-agents@example.com', 'admin')

    r_ag = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'agents', 'format': 'csv'},
        headers=auth_header(adm_tok),
    )
    assert r_ag.status_code == 200
    assert b'agent_id' in r_ag.data and b'open_assigned' in r_ag.data

    r_sla = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'sla', 'format': 'csv'},
        headers=auth_header(adm_tok),
    )
    assert r_sla.status_code == 200
    assert b'sla_resolution_breached' in r_sla.data

    r_cat = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'categories', 'format': 'csv'},
        headers=auth_header(adm_tok),
    )
    assert r_cat.status_code == 200
    assert b'category' in r_cat.data and b'count' in r_cat.data


def test_admin_export_json_non_tickets_still_csv(client):
    """Only tickets+json returns JSON; other report types fall through to CSV."""
    adm_tok, _ = _reg(client, 'adm-exp-json-sla@example.com', 'admin')
    r = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'sla', 'format': 'json'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    assert r.mimetype == 'text/csv' or 'csv' in (r.headers.get('Content-Type') or '')


def test_admin_export_forbidden_for_agent(client):
    ag_tok, _ = _reg(client, 'adm-exp-agent@example.com', 'agent')
    r = client.post(
        '/api/admin/reports/export',
        json={'report_type': 'categories', 'format': 'csv'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 403


def test_admin_list_and_update_users(client):
    adm_tok, _ = _reg(client, 'adm-users-list@example.com', 'admin')
    _tok_b, uid_b = _reg(client, 'adm-users-target@example.com', 'customer')

    r_list = client.get('/api/admin/users', headers=auth_header(adm_tok))
    assert r_list.status_code == 200
    users = r_list.get_json().get('users', [])
    assert any(u['id'] == uid_b for u in users)

    r_put = client.put(
        f'/api/admin/users/{uid_b}',
        json={'availability_status': 'busy', 'full_name': 'Renamed Customer'},
        headers=auth_header(adm_tok),
    )
    assert r_put.status_code == 200
    body = r_put.get_json()['user']
    assert body['full_name'] == 'Renamed Customer'
    assert body['availability_status'] == 'busy'


def test_admin_update_user_not_found(client):
    adm_tok, _ = _reg(client, 'adm-users-nf@example.com', 'admin')
    r = client.put(
        '/api/admin/users/999999',
        json={'availability_status': 'offline'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 404


def test_admin_update_user_validation_error(client):
    adm_tok, _ = _reg(client, 'adm-users-bad@example.com', 'admin')
    _tok_t, uid_t = _reg(client, 'adm-users-bad-tgt@example.com', 'customer')
    r = client.put(
        f'/api/admin/users/{uid_t}',
        json={'support_role': 'not-a-role'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 400
