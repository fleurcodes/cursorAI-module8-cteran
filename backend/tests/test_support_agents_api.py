"""Support agent routes: availability updates and ticket list RBAC."""

from __future__ import annotations

from tests.conftest import auth_header


def _reg(client, email: str, support_role: str) -> tuple[str, int]:
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Agent API Tester',
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    return d['access_token'], d['user']['id']


def test_agent_updates_own_availability(client):
    ag_tok, ag_id = _reg(client, 'agents-avail-self@example.com', 'agent')
    r = client.put(
        f'/api/agents/{ag_id}/availability',
        json={'availability_status': 'busy'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 200
    assert r.get_json()['availability_status'] == 'busy'


def test_admin_updates_agent_availability(client):
    adm_tok, _ = _reg(client, 'agents-avail-adm@example.com', 'admin')
    _ag_tok, ag_id = _reg(client, 'agents-avail-target@example.com', 'agent')
    r = client.put(
        f'/api/agents/{ag_id}/availability',
        json={'availability_status': 'offline'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    assert r.get_json()['availability_status'] == 'offline'


def test_agent_cannot_update_other_agent_availability(client):
    ag1_tok, _ag1_id = _reg(client, 'agents-avail-a@example.com', 'agent')
    _ag2_tok, ag2_id = _reg(client, 'agents-avail-b@example.com', 'agent')
    r = client.put(
        f'/api/agents/{ag2_id}/availability',
        json={'availability_status': 'available'},
        headers=auth_header(ag1_tok),
    )
    assert r.status_code == 403


def test_update_availability_non_agent_user_returns_404(client):
    adm_tok, adm_id = _reg(client, 'agents-avail-nf-adm@example.com', 'admin')
    r = client.put(
        f'/api/agents/{adm_id}/availability',
        json={'availability_status': 'available'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 404


def test_update_availability_invalid_status_returns_400(client):
    ag_tok, ag_id = _reg(client, 'agents-avail-bad@example.com', 'agent')
    r = client.put(
        f'/api/agents/{ag_id}/availability',
        json={'availability_status': 'on-vacation'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 400


def test_update_availability_forbidden_for_customer(client):
    cust_tok, cust_id = _reg(client, 'agents-avail-cust@example.com', 'customer')
    r = client.put(
        f'/api/agents/{cust_id}/availability',
        json={'availability_status': 'available'},
        headers=auth_header(cust_tok),
    )
    assert r.status_code == 403


def test_agent_cannot_list_other_agents_tickets(client):
    ag1_tok, _ = _reg(client, 'agents-tix-a@example.com', 'agent')
    _ag2_tok, ag2_id = _reg(client, 'agents-tix-b@example.com', 'agent')
    r = client.get(f'/api/agents/{ag2_id}/tickets', headers=auth_header(ag1_tok))
    assert r.status_code == 403


def test_agent_tickets_includes_assigned_ticket_summary(client):
    adm_tok, _ = _reg(client, 'agents-tix-adm@example.com', 'admin')
    ag_tok, ag_id = _reg(client, 'agents-tix-ag@example.com', 'agent')
    cust_tok, _ = _reg(client, 'agents-tix-cust@example.com', 'customer')
    tid = (
        client.post(
            '/api/tickets',
            json={
                'subject': 'Assigned ticket for agent list API',
                'description': 'Description long enough for schema validation rules.',
                'priority': 'medium',
                'category': 'general',
                'auto_assign': False,
            },
            headers=auth_header(cust_tok),
        )
        .get_json()['ticket']['id']
    )
    client.post(f'/api/tickets/{tid}/assign', json={'agent_id': ag_id}, headers=auth_header(adm_tok))

    r = client.get(f'/api/agents/{ag_id}/tickets', headers=auth_header(ag_tok))
    assert r.status_code == 200
    tickets = r.get_json()['tickets']
    assert any(t['id'] == tid for t in tickets)
