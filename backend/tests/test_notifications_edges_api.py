"""Notifications list 404 path, mark-read cross-user 404, invalid send payload."""

from __future__ import annotations

from unittest.mock import patch

from tests.conftest import auth_header, register_user


def test_list_notifications_user_not_found_returns_404(client):
    tok, _ = register_user(client, 'notif-list404@example.com')
    with patch('resources.notifications.get_current_user', lambda: None):
        r = client.get('/api/notifications', headers=auth_header(tok))
    assert r.status_code == 404


def test_mark_notification_read_wrong_owner_returns_404(client):
    tok_a, _ = register_user(client, 'notif-mark-a@example.com')
    tok_b, uid_b = register_user(client, 'notif-mark-b@example.com')
    r_send = client.post(
        '/api/notifications/send',
        json={'user_id': uid_b, 'title': 'Hey', 'message': 'Hello'},
        headers=auth_header(tok_a),
    )
    assert r_send.status_code == 201
    nid = r_send.get_json()['notification']['id']
    r_bad = client.patch(f'/api/notifications/{nid}/read', headers=auth_header(tok_a))
    assert r_bad.status_code == 404


def test_send_notification_invalid_body_returns_400(client):
    tok, _ = register_user(client, 'notif-send400@example.com')
    r = client.post('/api/notifications/send', json={}, headers=auth_header(tok))
    assert r.status_code == 400
