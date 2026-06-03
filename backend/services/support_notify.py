"""In-app and email notifications for the support system."""

from __future__ import annotations

from extensions import db
from models import InAppNotification, User, UserNotificationPreference
from services.email_service import send_email


def _prefs(user_id: int) -> UserNotificationPreference:
    pref = UserNotificationPreference.query.filter_by(user_id=user_id).first()
    if pref:
        return pref
    pref = UserNotificationPreference(user_id=user_id)
    from extensions import db

    db.session.add(pref)
    return pref


def notify_in_app(user_id: int, title: str, message: str, ticket_id: int | None = None) -> None:
    from extensions import db

    pref = _prefs(user_id)
    if not pref.in_app_enabled:
        return
    db.session.add(
        InAppNotification(
            user_id=user_id,
            ticket_id=ticket_id,
            title=title,
            message=message,
        )
    )


def maybe_email(user_id: int, flag: str, to_email: str, subject: str, body: str) -> None:
    pref_user = db.session.get(User, user_id)
    if not pref_user:
        return
    p = _prefs(user_id)
    if flag == 'created' and not p.email_ticket_created:
        return
    if flag == 'assigned' and not p.email_ticket_assigned:
        return
    if flag == 'status' and not p.email_status_changed:
        return
    if flag == 'comment' and not p.email_new_comment:
        return
    if flag == 'sla' and not p.email_sla:
        return
    send_email(to_email, subject, body)


def notify_ticket_created(ticket) -> None:
    """FR-003: confirmation to customer (email)."""
    maybe_email(
        ticket.customer_id,
        'created',
        ticket.customer_email,
        f'Support ticket {ticket.ticket_number} received',
        f'Your ticket {ticket.ticket_number} was created. Subject: {ticket.subject}\n\nWe will respond soon.',
    )


def notify_assigned(ticket, agent: User) -> None:
    maybe_email(
        agent.id,
        'assigned',
        agent.email,
        f'New ticket assigned: {ticket.ticket_number}',
        f'You have been assigned ticket {ticket.ticket_number}: {ticket.subject}',
    )
    notify_in_app(agent.id, 'Ticket assigned', f'{ticket.ticket_number} assigned to you.', ticket.id)


def notify_status_change(ticket, old: str, new: str) -> None:
    body = f'Ticket {ticket.ticket_number} status changed from {old} to {new}.'
    maybe_email(ticket.customer_id, 'status', ticket.customer_email, f'Ticket {ticket.ticket_number} updated', body)
    if ticket.assigned_to_id and ticket.assigned_to_id != ticket.customer_id:
        agent = db.session.get(User, ticket.assigned_to_id)
        if agent:
            maybe_email(agent.id, 'status', agent.email, f'Ticket {ticket.ticket_number} updated', body)
            if agent.support_role in ('agent', 'admin'):
                notify_in_app(agent.id, 'Status updated', body, ticket.id)


def notify_new_comment(ticket, recipients: list[int], author_id: int) -> None:
    for uid in recipients:
        if uid == author_id:
            continue
        u = db.session.get(User, uid)
        if not u:
            continue
        maybe_email(
            uid,
            'comment',
            u.email,
            f'New comment on {ticket.ticket_number}',
            f'A new comment was added to ticket {ticket.ticket_number}.',
        )
        if u.support_role in ('agent', 'admin'):
            notify_in_app(uid, 'New comment', f'On ticket {ticket.ticket_number}', ticket.id)


def notify_sla_event(ticket, message: str, admin_ids: list[int]) -> None:
    if ticket.assigned_to_id:
        assignee = db.session.get(User, ticket.assigned_to_id)
        if assignee:
            maybe_email(ticket.assigned_to_id, 'sla', assignee.email, 'SLA alert', message)
        if assignee and assignee.support_role in ('agent', 'admin'):
            notify_in_app(ticket.assigned_to_id, 'SLA alert', message, ticket.id)
    for aid in admin_ids:
        au = db.session.get(User, aid)
        if au:
            maybe_email(aid, 'sla', au.email, 'SLA alert', message)
            notify_in_app(aid, 'SLA alert', message, ticket.id)
