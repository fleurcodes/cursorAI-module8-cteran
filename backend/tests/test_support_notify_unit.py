"""Unit tests for support_notify and maybe_email branches."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from extensions import db
from models import InAppNotification, User, UserNotificationPreference
from services import support_notify
from tests.conftest import register_user


def _ensure_pref(user_id: int) -> UserNotificationPreference:
    """Registration does not create notification prefs; ticket flows do via _prefs."""
    pref = support_notify._prefs(user_id)
    db.session.commit()
    return pref


def test_maybe_email_returns_when_user_missing(app):
    with app.app_context():
        with patch('services.support_notify.send_email') as se:
            support_notify.maybe_email(999_999, 'created', 'nobody@example.com', 'S', 'B')
            se.assert_not_called()


def test_maybe_email_skips_when_pref_disabled(app, client):
    _tok, uid = register_user(client, 'notify-pref-off@example.com', support_role='customer')
    with app.app_context():
        pref = _ensure_pref(uid)
        pref.email_ticket_created = False
        db.session.commit()

    with app.app_context():
        with patch('services.support_notify.send_email') as se:
            t = MagicMock()
            t.customer_id = uid
            t.customer_email = 'notify-pref-off@example.com'
            t.ticket_number = 'TICK-TEST-0001'
            t.subject = 'Subject line ok'
            support_notify.notify_ticket_created(t)
            se.assert_not_called()


def test_maybe_email_respects_assigned_status_comment_sla_flags(app, client):
    _tok, uid = register_user(client, 'notify-flags@example.com', support_role='customer')
    with app.app_context():
        pref = _ensure_pref(uid)
        pref.email_ticket_assigned = False
        pref.email_status_changed = False
        pref.email_new_comment = False
        pref.email_sla = False
        db.session.commit()

    with app.app_context():
        with patch('services.support_notify.send_email') as se:
            support_notify.maybe_email(uid, 'assigned', 'notify-flags@example.com', 'A', 'B')
            support_notify.maybe_email(uid, 'status', 'notify-flags@example.com', 'A', 'B')
            support_notify.maybe_email(uid, 'comment', 'notify-flags@example.com', 'A', 'B')
            support_notify.maybe_email(uid, 'sla', 'notify-flags@example.com', 'A', 'B')
            se.assert_not_called()


def test_notify_in_app_skips_when_disabled(app, client):
    _tok, uid = register_user(client, 'notify-inapp-off@example.com', support_role='agent')
    with app.app_context():
        pref = _ensure_pref(uid)
        pref.in_app_enabled = False
        db.session.commit()

    with app.app_context():
        n0 = InAppNotification.query.filter_by(user_id=uid).count()
        support_notify.notify_in_app(uid, 'T', 'M', None)
        n1 = InAppNotification.query.filter_by(user_id=uid).count()
    assert n0 == n1


def test_notify_in_app_creates_row_when_enabled(app, client):
    _tok, uid = register_user(client, 'notify-inapp-on@example.com', support_role='agent')
    with app.app_context():
        pref = _ensure_pref(uid)
        pref.in_app_enabled = True
        db.session.commit()
        n0 = InAppNotification.query.filter_by(user_id=uid).count()
        support_notify.notify_in_app(uid, 'Title here', 'Body text', ticket_id=None)
        db.session.commit()
        n1 = InAppNotification.query.filter_by(user_id=uid).count()
    assert n1 == n0 + 1


def test_notify_assigned_sends_email_and_in_app(app, client):
    _tok, agent_id = register_user(client, 'notify-agent-asg@example.com', support_role='agent')
    with app.app_context():
        agent = db.session.get(User, agent_id)
        t = MagicMock()
        t.id = 1
        t.ticket_number = 'TN-1'
        t.subject = 'Subj line ok'
        with patch('services.support_notify.send_email') as se:
            with patch('services.support_notify.notify_in_app') as ni:
                support_notify.notify_assigned(t, agent)
                se.assert_called_once()
                ni.assert_called_once()


def test_notify_status_change_emails_customer_and_agent(app, client):
    _c_tok, cid = register_user(client, 'notify-st-cust@example.com', 'customer')
    _a_tok, aid = register_user(client, 'notify-st-ag@example.com', 'agent')
    with app.app_context():
        _ensure_pref(cid)
        _ensure_pref(aid)
        db.session.commit()
        t = MagicMock()
        t.customer_id = cid
        t.customer_email = 'notify-st-cust@example.com'
        t.assigned_to_id = aid
        t.ticket_number = 'T-55'
        with patch('services.support_notify.send_email') as se:
            with patch('services.support_notify.notify_in_app'):
                support_notify.notify_status_change(t, 'open', 'in_progress')
                assert se.call_count >= 2


def test_notify_status_change_skips_agent_email_when_assignee_is_customer(app, client):
    _c_tok, cid = register_user(client, 'notify-st-solo@example.com', 'customer')
    with app.app_context():
        _ensure_pref(cid)
        db.session.commit()
        t = MagicMock()
        t.customer_id = cid
        t.customer_email = 'notify-st-solo@example.com'
        t.assigned_to_id = cid
        t.ticket_number = 'T-56'
        with patch('services.support_notify.send_email') as se:
            support_notify.notify_status_change(t, 'open', 'closed')
            assert se.call_count == 1


def test_notify_new_comment_skips_author(app, client):
    _u1_tok, u1 = register_user(client, 'notify-cmt-1@example.com', 'customer')
    _u2_tok, u2 = register_user(client, 'notify-cmt-2@example.com', 'customer')
    with app.app_context():
        _ensure_pref(u1)
        _ensure_pref(u2)
        db.session.commit()
        t = MagicMock()
        t.ticket_number = 'T-99'
        t.id = 123
        with patch('services.support_notify.send_email') as se:
            support_notify.notify_new_comment(t, [u1, u2], author_id=u1)
            assert se.call_count == 1
            u2_obj = db.session.get(User, u2)
            assert u2_obj is not None
            assert se.call_args[0][0] == u2_obj.email


def test_notify_sla_event_assignee_and_admin(app, client):
    _a_tok, aid = register_user(client, 'notify-sla-ag@example.com', 'agent')
    _m_tok, mid = register_user(client, 'notify-sla-adm@example.com', 'admin')
    with app.app_context():
        _ensure_pref(aid)
        _ensure_pref(mid)
        db.session.commit()
        class _Ticket:
            pass

        t = _Ticket()
        t.assigned_to_id = aid
        t.ticket_number = 'T-SLA'
        t.id = 7
        with patch('services.support_notify.send_email') as se:
            with patch('services.support_notify.notify_in_app') as ni:
                support_notify.notify_sla_event(t, 'SLA breached', [mid])
                assert se.call_count == 2
                assert ni.call_count >= 1
                assert {c.args[0] for c in ni.call_args_list}.issubset({aid, mid})
