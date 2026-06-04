"""Unit tests for support_rbac helpers (JWT mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from models import Ticket, User
from support_rbac import (
    can_edit_ticket,
    can_view_ticket,
    current_user_id,
    get_support_user,
    require_support_authenticated,
)


def test_current_user_id_raises_when_identity_missing(app):
    with app.app_context():
        with patch('support_rbac.get_jwt_identity', return_value=None):
            with pytest.raises(RuntimeError, match='JWT identity missing'):
                current_user_id()


def test_current_user_id_parses_string_identity(app):
    with app.app_context():
        with patch('support_rbac.get_jwt_identity', return_value='7'):
            assert current_user_id() == 7


def test_get_support_user_returns_none_when_identity_missing(app):
    with app.app_context():
        with patch('support_rbac.get_jwt_identity', return_value=None):
            assert get_support_user() is None


def test_require_support_authenticated_user_not_found(app):
    with app.app_context():
        with patch('support_rbac.get_support_user', return_value=None):
            u, err = require_support_authenticated()
            assert u is None
            assert err is not None
            assert err[1] == 404


def test_require_support_authenticated_support_role_none(app):
    with app.app_context():
        u = User(
            full_name='No Support',
            email='rbac-none@example.com',
            password_hash='x',
            support_role='none',
        )
        with patch('support_rbac.get_support_user', return_value=u):
            out, err = require_support_authenticated()
            assert out is None
            assert err is not None
            assert err[1] == 403


def test_can_view_ticket_none_role_false():
    u = MagicMock()
    u.support_role = 'none'
    t = MagicMock()
    assert can_view_ticket(u, t) is False


def test_can_edit_ticket_customer_false():
    u = MagicMock()
    u.support_role = 'customer'
    t = MagicMock()
    assert can_edit_ticket(u, t) is False


def test_can_edit_ticket_agent_assigned_to_other_false():
    u = MagicMock()
    u.support_role = 'agent'
    u.id = 1
    t = MagicMock()
    t.assigned_to_id = 2
    assert can_edit_ticket(u, t) is False
