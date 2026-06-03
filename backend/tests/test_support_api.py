def _register(client, email, role='customer'):
    r = client.post(
        '/api/register',
        json={
            'full_name': 'Test User',
            'email': email,
            'password': 'password123',
            'support_role': role,
        },
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()['access_token']


def test_status_transition_open_to_closed(client):
    admin_tok = _register(client, 'admin1@example.com', 'admin')
    cust_tok = _register(client, 'cust1@example.com', 'customer')

    r = client.post(
        '/api/tickets',
        json={
            'subject': 'Login issue',
            'description': 'This is a detailed description of the login issue.',
            'priority': 'medium',
            'category': 'technical',
            'auto_assign': False,
        },
        headers={'Authorization': f'Bearer {cust_tok}'},
    )
    assert r.status_code == 201, r.get_json()
    tid = r.get_json()['ticket']['id']

    r2 = client.put(
        f'/api/tickets/{tid}/status',
        json={'status': 'closed'},
        headers={'Authorization': f'Bearer {admin_tok}'},
    )
    assert r2.status_code == 200, r2.get_json()
    assert r2.get_json()['ticket']['status'] == 'closed'


def test_invalid_subject_rejected(client):
    tok = _register(client, 'cust2@example.com', 'customer')
    r = client.post(
        '/api/tickets',
        json={
            'subject': 'bad',
            'description': 'x' * 25,
            'priority': 'low',
            'category': 'general',
        },
        headers={'Authorization': f'Bearer {tok}'},
    )
    assert r.status_code == 400
    body = r.get_json()
    assert body.get('code') == 'VALIDATION_ERROR'
