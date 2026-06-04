"""404 / 403 shortcuts on support ticket routes (coverage helpers)."""

from __future__ import annotations

from tests.conftest import auth_header, register_user


def _adm(client):
    return register_user(client, 'quick404-adm@example.com', 'Admin Q', 'admin')


def test_assign_ticket_not_found(client):
    tok, _ = _adm(client)
    r = client.post('/api/tickets/999998/assign', json={'agent_id': 1}, headers=auth_header(tok))
    assert r.status_code == 404


def test_get_ticket_not_found(client):
    tok, _ = _adm(client)
    r = client.get('/api/tickets/999998', headers=auth_header(tok))
    assert r.status_code == 404


def test_update_status_ticket_not_found(client):
    tok, _ = _adm(client)
    r = client.put('/api/tickets/999998/status', json={'status': 'closed'}, headers=auth_header(tok))
    assert r.status_code == 404


def test_delete_ticket_not_found(client):
    tok, _ = _adm(client)
    r = client.delete('/api/tickets/999998', headers=auth_header(tok))
    assert r.status_code == 404


def test_comments_not_found(client):
    tok, _ = _adm(client)
    r = client.get('/api/tickets/999998/comments', headers=auth_header(tok))
    assert r.status_code == 404


def test_history_not_found(client):
    tok, _ = _adm(client)
    r = client.get('/api/tickets/999998/history', headers=auth_header(tok))
    assert r.status_code == 404


def test_priority_ticket_not_found(client):
    tok, _ = _adm(client)
    r = client.put(
        '/api/tickets/999998/priority',
        json={'priority': 'high', 'reason': 'missing ticket'},
        headers=auth_header(tok),
    )
    assert r.status_code == 404


def test_satisfaction_ticket_not_found(client):
    cust_tok, _ = register_user(client, 'quick404-csat@example.com', 'Cust Q', 'customer')
    r = client.post('/api/tickets/999998/satisfaction', json={'score': 3}, headers=auth_header(cust_tok))
    assert r.status_code == 404
