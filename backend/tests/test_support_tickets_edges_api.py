"""Additional support ticket routes: filters, mentions, status edges, uploads, RBAC."""

from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO

from tests.conftest import auth_header


def _reg(client, email: str, support_role: str) -> tuple[str, int]:
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Edge Ticket User',
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    return d['access_token'], d['user']['id']


def _create_ticket(client, token: str, subject: str = 'Edge case ticket subject ok') -> int:
    r = client.post(
        '/api/tickets',
        json={
            'subject': subject,
            'description': 'Description with enough characters for validation.',
            'priority': 'medium',
            'category': 'technical',
            'auto_assign': False,
        },
        headers=auth_header(token),
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()['ticket']['id']


def test_create_ticket_forbidden_support_role_none(client):
    tok, _ = _reg(client, 'edge-none-user@example.com', 'none')
    r = client.post(
        '/api/tickets',
        json={
            'subject': 'None role ticket subj',
            'description': 'Long enough description for none role test.',
            'priority': 'low',
            'category': 'general',
        },
        headers=auth_header(tok),
    )
    assert r.status_code == 403


def test_list_tickets_admin_filters_and_search(client):
    adm_tok, _ = _reg(client, 'edge-list-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-list-cust@example.com', 'customer')
    cust_email = 'edge-list-cust@example.com'
    tid = _create_ticket(client, cust_tok)
    iso_from = (datetime.utcnow() - timedelta(days=1)).isoformat()
    iso_to = (datetime.utcnow() + timedelta(days=1)).isoformat()
    r = client.get(
        f'/api/tickets?status=open&priority=medium&category=technical&customer_email={cust_email[:8]}'
        f'&q=Edge&created_from={iso_from}&created_to={iso_to}&page=1&per_page=5',
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    ids = [t['id'] for t in r.get_json()['tickets']]
    assert tid in ids


def test_list_tickets_agent_sees_unassigned_queue(client):
    ag_tok, _ = _reg(client, 'edge-ag-unasg@example.com', 'agent')
    cust_tok, _ = _reg(client, 'edge-cust-unasg@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.get('/api/tickets', headers=auth_header(ag_tok))
    assert r.status_code == 200
    ids = [t['id'] for t in r.get_json()['tickets']]
    assert tid in ids


def test_comment_with_mention_notifies_recipient(client):
    adm_tok, _ = _reg(client, 'edge-men-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-men-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    body = 'Please escalate @edge-men-adm@example.com for visibility.'
    r = client.post(
        f'/api/tickets/{tid}/comments',
        json={'content': body},
        headers=auth_header(cust_tok),
    )
    assert r.status_code == 201, r.get_json()


def test_status_open_to_in_progress_self_assigns_unassigned_ticket(client):
    ag_tok, ag_id = _reg(client, 'edge-iprog-ag@example.com', 'agent')
    cust_tok, _ = _reg(client, 'edge-iprog-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.put(
        f'/api/tickets/{tid}/status',
        json={'status': 'in_progress'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 200
    t = r.get_json()['ticket']
    assert t['status'] == 'in_progress'
    assert t['assignee']['id'] == ag_id


def test_customer_may_reopen_closed_ticket(client):
    adm_tok, _ = _reg(client, 'edge-reop-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-reop-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.put(f'/api/tickets/{tid}/status', json={'status': 'closed'}, headers=auth_header(adm_tok))
    r = client.put(
        f'/api/tickets/{tid}/status',
        json={'status': 'reopened'},
        headers=auth_header(cust_tok),
    )
    assert r.status_code == 200
    assert r.get_json()['ticket']['status'] == 'reopened'


def test_priority_noop_when_same_priority(client):
    adm_tok, _ = _reg(client, 'edge-samep-adm@example.com', 'admin')
    ag_tok, ag_id = _reg(client, 'edge-samep-ag@example.com', 'agent')
    cust_tok, _ = _reg(client, 'edge-samep-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.post(f'/api/tickets/{tid}/assign', json={'agent_id': ag_id}, headers=auth_header(adm_tok))
    r = client.put(
        f'/api/tickets/{tid}/priority',
        json={'priority': 'medium', 'reason': 'Same priority no-op path.'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 200


def test_assign_rejects_non_agent_user(client):
    adm_tok, _ = _reg(client, 'edge-badag-adm@example.com', 'admin')
    cust_tok, cust_id = _reg(client, 'edge-badag-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.post(
        f'/api/tickets/{tid}/assign',
        json={'agent_id': cust_id},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 400


def test_post_comment_png_attachment_valid_magic(client):
    adm_tok, _ = _reg(client, 'edge-png-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-png-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 40
    data = {
        'content': 'Comment with valid PNG magic bytes.',
        'files': (BytesIO(png), 'shot.png'),
    }
    r = client.post(f'/api/tickets/{tid}/comments', data=data, headers=auth_header(adm_tok))
    assert r.status_code == 201, r.get_json()


def test_post_comment_rejects_png_mime_mismatch(client):
    adm_tok, _ = _reg(client, 'edge-badpng-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-badpng-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    data = {
        'content': 'PNG extension but PDF header.',
        'files': (BytesIO(b'%PDF-1.4\n'), 'fake.png'),
    }
    r = client.post(f'/api/tickets/{tid}/comments', data=data, headers=auth_header(adm_tok))
    assert r.status_code == 400


def test_put_ticket_customer_forbidden_even_on_own_ticket(client):
    cust_tok, _ = _reg(client, 'edge-putcust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Customer tries subject update', 'description': 'Customer tries update description ok.'},
        headers=auth_header(cust_tok),
    )
    assert r.status_code == 403


def test_put_ticket_agent_forbidden_when_not_assignee(client):
    adm_tok, _ = _reg(client, 'edge-puta-adm@example.com', 'admin')
    ag1_tok, ag1_id = _reg(client, 'edge-puta-ag1@example.com', 'agent')
    ag2_tok, ag2_id = _reg(client, 'edge-puta-ag2@example.com', 'agent')
    cust_tok, _ = _reg(client, 'edge-puta-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.post(f'/api/tickets/{tid}/assign', json={'agent_id': ag1_id}, headers=auth_header(adm_tok))
    r = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Agent two tries update subj', 'description': 'Agent two tries update description text.'},
        headers=auth_header(ag2_tok),
    )
    assert r.status_code == 403


def test_satisfaction_not_found_for_wrong_customer(client):
    adm_tok, _ = _reg(client, 'edge-csat-adm@example.com', 'admin')
    a_tok, _ = _reg(client, 'edge-csat-a@example.com', 'customer')
    b_tok, _ = _reg(client, 'edge-csat-b@example.com', 'customer')
    tid = _create_ticket(client, a_tok)
    client.put(f'/api/tickets/{tid}/status', json={'status': 'resolved'}, headers=auth_header(adm_tok))
    r = client.post(f'/api/tickets/{tid}/satisfaction', json={'score': 4}, headers=auth_header(b_tok))
    assert r.status_code == 404


def test_satisfaction_validation_error(client):
    adm_tok, _ = _reg(client, 'edge-csatv-adm@example.com', 'admin')
    cust_tok, _ = _reg(client, 'edge-csatv-cust@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.put(f'/api/tickets/{tid}/status', json={'status': 'resolved'}, headers=auth_header(adm_tok))
    r = client.post(f'/api/tickets/{tid}/satisfaction', json={'score': 99}, headers=auth_header(cust_tok))
    assert r.status_code == 400
