"""Extra coverage for user blueprint profile and support notification prefs."""

from __future__ import annotations

from unittest.mock import patch

from tests.conftest import auth_header, register_user


def test_profile_returns_404_when_user_row_missing(client):
    tok, _ = register_user(client, 'prof-miss@example.com')
    with patch('resources.user.get_current_user', lambda: None):
        r = client.get('/api/profile', headers=auth_header(tok))
    assert r.status_code == 404


def test_team_dashboard_returns_404_when_user_row_missing(client):
    tok, _ = register_user(client, 'team-miss@example.com')
    with patch('resources.user.get_current_user', lambda: None):
        r = client.get('/api/team', headers=auth_header(tok))
    assert r.status_code == 404


def test_list_support_notifications_forbidden_for_customer(client):
    tok, _ = register_user(client, 'supnot-cust@example.com', 'Test User', 'customer')
    r = client.get('/api/profile/support-notifications', headers=auth_header(tok))
    assert r.status_code == 403


def test_list_support_notifications_ok_for_agent(client):
    tok, _ = register_user(client, 'supnot-ag@example.com', 'Test User', 'agent')
    r = client.get('/api/profile/support-notifications', headers=auth_header(tok))
    assert r.status_code == 200
    assert r.get_json().get('status') == 'ok'


def test_mark_support_notification_read_not_found(client):
    ag_tok, _ = register_user(client, 'supnot-read@example.com', 'Test User', 'agent')
    r = client.put('/api/profile/support-notifications/999992/read', headers=auth_header(ag_tok))
    assert r.status_code == 404


def test_update_support_notification_preferences_validation_error(client):
    ag_tok, _ = register_user(client, 'supnot-pref@example.com', 'Test User', 'agent')
    r = client.put(
        '/api/profile/support-notification-preferences',
        json={'email_ticket_created': 'not-a-bool'},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 400


def test_update_support_notification_preferences_creates_pref_row(client):
    ag_tok, _ = register_user(client, 'supnot-pref2@example.com', 'Test User', 'agent')
    r = client.put(
        '/api/profile/support-notification-preferences',
        json={'in_app_enabled': False},
        headers=auth_header(ag_tok),
    )
    assert r.status_code == 200


def test_mark_support_notification_read_success(app, client):
    ag_tok, ag_id = register_user(client, 'supnot-readok@example.com', 'Test User', 'agent')
    with app.app_context():
        from extensions import db
        from models import InAppNotification

        n = InAppNotification(user_id=ag_id, ticket_id=None, title='Read me', message='Body text')
        db.session.add(n)
        db.session.commit()
        nid = n.id
    r = client.put(f'/api/profile/support-notifications/{nid}/read', headers=auth_header(ag_tok))
    assert r.status_code == 200
