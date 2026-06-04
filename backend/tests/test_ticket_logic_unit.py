"""Unit tests for ticket_logic (no HTTP)."""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock

from services import ticket_logic


def test_compute_sla_deadlines_urgent_and_low():
    t0 = datetime(2025, 6, 1, 12, 0, 0)
    fr_u, res_u = ticket_logic.compute_sla_deadlines(t0, 'urgent')
    assert fr_u == t0 + timedelta(hours=2)
    assert res_u == t0 + timedelta(hours=24)

    fr_l, res_l = ticket_logic.compute_sla_deadlines(t0, 'low')
    assert fr_l == t0 + timedelta(hours=24)


def test_compute_sla_unknown_priority_uses_medium():
    t0 = datetime(2025, 1, 1, 0, 0, 0)
    fr, res = ticket_logic.compute_sla_deadlines(t0, 'not-a-real-priority')
    m_resp, m_res = ticket_logic.compute_sla_deadlines(t0, 'medium')
    assert fr == m_resp and res == m_res


def test_can_transition_invalid_move():
    tk = MagicMock()
    ok, msg = ticket_logic.can_transition('open', 'resolved', tk, 'admin')
    assert ok is False
    assert msg and 'not allowed' in msg.lower()


def test_can_transition_closed_to_reopened_admin():
    tk = MagicMock()
    tk.closed_at = datetime.utcnow() - timedelta(days=1)
    ok, msg = ticket_logic.can_transition('closed', 'reopened', tk, 'admin')
    assert ok is True
    assert msg is None


def test_can_transition_reopen_after_7_days_blocked():
    tk = MagicMock()
    tk.closed_at = datetime.utcnow() - timedelta(days=10)
    ok, msg = ticket_logic.can_transition('closed', 'reopened', tk, 'admin')
    assert ok is False
    assert msg and '7 days' in msg


def test_can_transition_customer_reopen_from_open_denied():
    tk = MagicMock()
    ok, msg = ticket_logic.can_transition('open', 'reopened', tk, 'customer')
    assert ok is False


def test_refresh_sla_flags_sets_response_breach():
    t = MagicMock()
    t.first_response_at = None
    t.sla_first_response_due = datetime.utcnow() - timedelta(hours=1)
    t.sla_resolution_due = datetime.utcnow() + timedelta(days=1)
    t.status = 'open'
    ticket_logic.refresh_sla_flags(t, now=datetime.utcnow())
    assert t.sla_response_breached is True


def test_can_transition_closed_to_reopened_without_closed_at_fails():
    tk = MagicMock()
    tk.closed_at = None
    ok, msg = ticket_logic.can_transition('closed', 'reopened', tk, 'admin')
    assert ok is False
    assert msg and 'closed timestamp' in msg.lower()


def test_can_transition_customer_may_reopen_from_resolved():
    tk = MagicMock()
    ok, msg = ticket_logic.can_transition('resolved', 'reopened', tk, 'customer')
    assert ok is True


def test_refresh_sla_resolution_breach_when_already_escalated():
    t = MagicMock()
    t.first_response_at = datetime.utcnow()
    t.sla_first_response_due = datetime.utcnow() + timedelta(hours=1)
    t.sla_resolution_due = datetime.utcnow() - timedelta(hours=1)
    t.status = 'in_progress'
    t.sla_escalated = True
    ticket_logic.refresh_sla_flags(t, now=datetime.utcnow())
    assert t.sla_resolution_breached is True


def test_refresh_sla_flags_resolution_breach_sets_escalated():
    t = MagicMock()
    t.first_response_at = datetime.utcnow()
    t.sla_first_response_due = datetime.utcnow() + timedelta(hours=1)
    t.sla_resolution_due = datetime.utcnow() - timedelta(hours=1)
    t.status = 'in_progress'
    t.sla_escalated = False
    ticket_logic.refresh_sla_flags(t, now=datetime.utcnow())
    assert t.sla_resolution_breached is True
    assert t.sla_escalated is True
