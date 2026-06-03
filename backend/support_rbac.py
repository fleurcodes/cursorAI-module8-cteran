"""Role checks for support RBAC (PRD FR-032, FR-033)."""

from __future__ import annotations

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from extensions import db
from models import Ticket, User


def current_user_id() -> int:
    uid = get_jwt_identity()
    if uid is None:
        raise RuntimeError('JWT identity missing')
    return int(uid)


def get_support_user() -> User | None:
    uid = get_jwt_identity()
    if uid is None:
        return None
    return db.session.get(User, int(uid))


def require_support_authenticated():
    u = get_support_user()
    if not u:
        return None, (jsonify({'status': 'error', 'message': 'User not found', 'code': 'NOT_FOUND'}), 404)
    if u.support_role == 'none':
        return None, (
            jsonify(
                {
                    'status': 'error',
                    'message': 'Support access is not enabled for this account.',
                    'code': 'FORBIDDEN',
                }
            ),
            403,
        )
    return u, None


def can_view_ticket(user: User, ticket: Ticket) -> bool:
    if user.support_role == 'admin':
        return True
    if user.support_role == 'customer':
        return ticket.customer_id == user.id
    if user.support_role == 'agent':
        return ticket.assigned_to_id == user.id or ticket.assigned_to_id is None
    return False


def can_edit_ticket(user: User, ticket: Ticket) -> bool:
    if user.support_role == 'admin':
        return True
    if user.support_role == 'agent':
        return ticket.assigned_to_id == user.id or ticket.assigned_to_id is None
    return False
