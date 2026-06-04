"""Ticket numbering, SLA windows, status transitions, auto-assignment (PRD FR-002, FR-006, FR-012, FR-020)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import func

from extensions import db

if TYPE_CHECKING:
    from models import Ticket, User


PRIORITY_SLA_HOURS = {
    'urgent': (2, 24),
    'high': (4, 48),
    'medium': (8, 5 * 24),
    'low': (24, 10 * 24),
}

ALLOWED_TRANSITIONS: dict[str, tuple[str, ...]] = {
    'open': ('assigned', 'closed'),
    'assigned': ('in_progress', 'closed'),
    'in_progress': ('waiting', 'resolved', 'closed'),
    'waiting': ('in_progress',),
    'resolved': ('closed', 'reopened'),
    'closed': ('reopened',),
    'reopened': ('in_progress',),
}

TICKET_STATUSES = frozenset(ALLOWED_TRANSITIONS)
PRIORITIES = frozenset(PRIORITY_SLA_HOURS)
CATEGORIES = frozenset({'technical', 'billing', 'general', 'feature_request'})


def next_ticket_number() -> str:
    from models import Ticket

    today = datetime.utcnow().strftime('%Y%m%d')
    prefix = f'TICK-{today}-'
    like = prefix + '%'
    last = (
        db.session.query(func.max(Ticket.ticket_number))
        .filter(Ticket.ticket_number.like(like))
        .scalar()
    )
    seq = 1
    if last and last.startswith(prefix):
        try:
            seq = int(last.split('-')[-1]) + 1
        except ValueError:
            seq = 1
    return f'{prefix}{seq:04d}'


def compute_sla_deadlines(created_at: datetime, priority: str) -> tuple[datetime, datetime]:
    resp_h, res_h = PRIORITY_SLA_HOURS.get(priority, PRIORITY_SLA_HOURS['medium'])
    return created_at + timedelta(hours=resp_h), created_at + timedelta(hours=res_h)


def refresh_sla_flags(ticket: Ticket, now: datetime | None = None) -> None:
    now = now or datetime.utcnow()
    if ticket.first_response_at is None and ticket.sla_first_response_due and now > ticket.sla_first_response_due:
        ticket.sla_response_breached = True
    if ticket.status not in ('resolved', 'closed') and ticket.sla_resolution_due and now > ticket.sla_resolution_due:
        ticket.sla_resolution_breached = True
        if not ticket.sla_escalated:
            ticket.sla_escalated = True


def can_transition(from_status: str, to_status: str, ticket: Ticket, actor_support_role: str) -> tuple[bool, str | None]:
    allowed = ALLOWED_TRANSITIONS.get(from_status, ())
    if to_status not in allowed:
        return False, f'Transition from {from_status} to {to_status} is not allowed.'

    if from_status == 'closed' and to_status == 'reopened':
        if not ticket.closed_at:
            return False, 'Ticket has no closed timestamp.'
        if datetime.utcnow() - ticket.closed_at > timedelta(days=7):
            return False, 'Tickets can only be reopened within 7 days of closing.'

    if to_status == 'reopened' and actor_support_role == 'customer':
        if from_status not in ('resolved', 'closed'):
            # Unreachable with current ALLOWED_TRANSITIONS (reopened only from resolved/closed).
            return False, 'Customers may only reopen resolved or closed tickets.'  # pragma: no cover

    return True, None


def pick_auto_assign_agent(category: str) -> User | None:
    from models import Ticket, User

    agents = (
        User.query.filter_by(support_role='agent')
        .filter(User.availability_status == 'available')
        .all()
    )
    if not agents:
        agents = User.query.filter_by(support_role='agent').all()
    if not agents:
        return None

    def open_count(agent_id: int) -> int:
        return (
            Ticket.query.filter_by(assigned_to_id=agent_id)
            .filter(Ticket.status.in_(('open', 'assigned', 'in_progress', 'waiting', 'reopened')))
            .count()
        )

    def expertise_match(u: User) -> bool:
        areas = u.get_expertise_areas()
        return bool(areas and category in areas)

    scored = sorted(
        agents,
        key=lambda u: (open_count(u.id), 0 if expertise_match(u) else 1, u.id),
    )
    return scored[0] if scored else None


def apply_assignment(ticket: Ticket, agent: User, assigned_by_id: int | None) -> None:
    from models import TicketAssignment

    ticket.assigned_to_id = agent.id
    if ticket.status == 'open':
        ticket.status = 'assigned'
    db.session.add(
        TicketAssignment(
            ticket_id=ticket.id,
            assigned_to_id=agent.id,
            assigned_by_id=assigned_by_id,
        )
    )
