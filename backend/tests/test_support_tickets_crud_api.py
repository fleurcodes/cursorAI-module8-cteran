"""Support ticket CRUD: detail, update, assign, priority, comments, history, satisfaction, export."""

from __future__ import annotations

from tests.conftest import auth_header


def _reg(client, email: str, support_role: str) -> tuple[str, int]:
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Crud Tester',
            'email': email,
            'password': 'password123',
            'support_role': support_role,
        },
    )
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    return d['access_token'], d['user']['id']


def _create_ticket(client, cust_token: str) -> int:
    r = client.post(
        '/api/tickets',
        json={
            'subject': 'Support ticket for CRUD tests',
            'description': 'Long enough description for validation and testing flows.',
            'priority': 'medium',
            'category': 'technical',
            'auto_assign': False,
        },
        headers=auth_header(cust_token),
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()['ticket']['id']


def test_get_ticket_detail_customer(client):
    cust_tok, _ = _reg(client, 'crud-cust-get@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.get(f'/api/tickets/{tid}', headers=auth_header(cust_tok))
    assert r.status_code == 200
    assert r.get_json()['ticket']['id'] == tid


def test_get_ticket_not_found(client):
    adm_tok, _ = _reg(client, 'crud-adm-nf@example.com', 'admin')
    r = client.get('/api/tickets/999999', headers=auth_header(adm_tok))
    assert r.status_code == 404


def test_get_ticket_forbidden_other_customer(client):
    a_tok, _ = _reg(client, 'crud-cust-a@example.com', 'customer')
    b_tok, _ = _reg(client, 'crud-cust-b@example.com', 'customer')
    tid = _create_ticket(client, a_tok)
    r = client.get(f'/api/tickets/{tid}', headers=auth_header(b_tok))
    assert r.status_code == 403


def test_put_ticket_admin_updates_fields(client):
    adm_tok, _ = _reg(client, 'crud-adm-put@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-put@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Updated subject line ok', 'description': 'Updated description body text.'},
        headers=auth_header(adm_tok),
    )
    assert r.status_code == 200
    body = r.get_json()['ticket']
    assert body['subject'] == 'Updated subject line ok'


def test_put_ticket_customer_forbidden_on_others_ticket(client):
    a_tok, _ = _reg(client, 'crud-cust-own@example.com', 'customer')
    b_tok, _ = _reg(client, 'crud-cust-other@example.com', 'customer')
    tid = _create_ticket(client, a_tok)
    r = client.put(
        f'/api/tickets/{tid}',
        json={'subject': 'Hacked subject line no'},
        headers=auth_header(b_tok),
    )
    assert r.status_code == 403


def test_delete_ticket_admin(client):
    adm_tok, _ = _reg(client, 'crud-adm-del@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-del@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.delete(f'/api/tickets/{tid}', headers=auth_header(adm_tok))
    assert r.status_code == 200


def test_assign_and_priority_change_flow(client):
    adm_tok, _ = _reg(client, 'crud-adm-asg@example.com', 'admin')
    ag_tok, ag_id = _reg(client, 'crud-agent-asg@example.com', 'agent')
    cust_tok, _ = _reg(client, 'crud-cust-asg@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)

    r_asg = client.post(
        f'/api/tickets/{tid}/assign',
        json={'agent_id': ag_id},
        headers=auth_header(adm_tok),
    )
    assert r_asg.status_code == 200, r_asg.get_json()

    r_pr = client.put(
        f'/api/tickets/{tid}/priority',
        json={'priority': 'high', 'reason': 'Escalated per test flow'},
        headers=auth_header(ag_tok),
    )
    assert r_pr.status_code == 200
    assert r_pr.get_json()['ticket']['priority'] == 'high'


def test_list_and_post_comments(client):
    cust_tok, _ = _reg(client, 'crud-cust-cmt@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r0 = client.get(f'/api/tickets/{tid}/comments', headers=auth_header(cust_tok))
    assert r0.status_code == 200
    assert r0.get_json()['comments'] == []

    r1 = client.post(
        f'/api/tickets/{tid}/comments',
        json={'content': 'Customer visible comment text.'},
        headers=auth_header(cust_tok),
    )
    assert r1.status_code == 201, r1.get_json()

    r2 = client.get(f'/api/tickets/{tid}/comments', headers=auth_header(cust_tok))
    assert len(r2.get_json()['comments']) == 1


def test_agent_internal_comment_hidden_from_customer(client):
    adm_tok, _ = _reg(client, 'crud-adm-int@example.com', 'admin')
    ag_tok, ag_id = _reg(client, 'crud-agent-int@example.com', 'agent')
    cust_tok, _ = _reg(client, 'crud-cust-int@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.post(f'/api/tickets/{tid}/assign', json={'agent_id': ag_id}, headers=auth_header(adm_tok))

    r1 = client.post(
        f'/api/tickets/{tid}/comments',
        json={'content': 'Internal note for agents only.', 'is_internal': True},
        headers=auth_header(ag_tok),
    )
    assert r1.status_code == 201

    cust_list = client.get(f'/api/tickets/{tid}/comments', headers=auth_header(cust_tok))
    assert cust_list.status_code == 200
    contents = [c['content'] for c in cust_list.get_json()['comments']]
    assert 'Internal note for agents only.' not in contents

    adm_list = client.get(f'/api/tickets/{tid}/comments', headers=auth_header(adm_tok))
    all_contents = [c['content'] for c in adm_list.get_json()['comments']]
    assert 'Internal note for agents only.' in all_contents


def test_ticket_history_after_status_change(client):
    adm_tok, _ = _reg(client, 'crud-adm-hist@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-hist@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.put(f'/api/tickets/{tid}/status', json={'status': 'closed'}, headers=auth_header(adm_tok))

    r = client.get(f'/api/tickets/{tid}/history', headers=auth_header(cust_tok))
    assert r.status_code == 200
    hist = r.get_json()['history']
    assert any(e.get('type') == 'status' for e in hist)


def test_customer_satisfaction_and_duplicate(client):
    adm_tok, _ = _reg(client, 'crud-adm-csat@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-csat@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    client.put(f'/api/tickets/{tid}/status', json={'status': 'resolved'}, headers=auth_header(adm_tok))

    r1 = client.post(f'/api/tickets/{tid}/satisfaction', json={'score': 5}, headers=auth_header(cust_tok))
    assert r1.status_code == 201

    r2 = client.post(f'/api/tickets/{tid}/satisfaction', json={'score': 4}, headers=auth_header(cust_tok))
    assert r2.status_code == 409


def test_satisfaction_forbidden_for_admin(client):
    adm_tok, _ = _reg(client, 'crud-adm-only@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-only@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.post(f'/api/tickets/{tid}/satisfaction', json={'score': 3}, headers=auth_header(adm_tok))
    assert r.status_code == 403


def test_export_tickets_csv_admin(client):
    adm_tok, _ = _reg(client, 'crud-adm-csv@example.com', 'admin')
    r = client.get('/api/tickets/export.csv', headers=auth_header(adm_tok))
    assert r.status_code == 200
    assert 'text/csv' in (r.headers.get('Content-Type') or '') or r.mimetype == 'text/csv'
    assert b'ticket_number' in r.data


def test_export_csv_forbidden_agent(client):
    ag_tok, _ = _reg(client, 'crud-agent-csv@example.com', 'agent')
    r = client.get('/api/tickets/export.csv', headers=auth_header(ag_tok))
    assert r.status_code == 403


def test_priority_forbidden_for_customer(client):
    adm_tok, _ = _reg(client, 'crud-adm-pri@example.com', 'admin')
    cust_tok, _ = _reg(client, 'crud-cust-pri@example.com', 'customer')
    tid = _create_ticket(client, cust_tok)
    r = client.put(
        f'/api/tickets/{tid}/priority',
        json={'priority': 'urgent', 'reason': 'Should not work'},
        headers=auth_header(cust_tok),
    )
    assert r.status_code == 403
