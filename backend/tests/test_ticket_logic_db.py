"""DB-backed tests for ticket_logic (next number, auto-assign, apply_assignment)."""

from __future__ import annotations

from datetime import datetime

import pytest

from extensions import db
from models import Ticket, User
from services import ticket_logic


def _clear_review_seed_users():
    """Remove startup reviewer rows so pick_auto_assign only sees test fixtures."""
    for em in ('admin@example.com', 'support@example.com'):
        u = User.query.filter_by(email=em).first()
        if u:
            db.session.delete(u)
    db.session.commit()


def _minimal_user(email: str, support_role: str = 'customer', **kwargs) -> User:
    u = User(
        full_name='TL DB User',
        email=email,
        password_hash='x',
        support_role=support_role,
        **kwargs,
    )
    return u


def _minimal_ticket(customer: User, **kwargs) -> Ticket:
    defaults = dict(
        ticket_number='TICK-TEST-0001',
        subject='Subject line for ticket logic',
        description='x' * 30,
        status='open',
        priority='medium',
        category='technical',
        customer_email=customer.email,
        customer_id=customer.id,
    )
    defaults.update(kwargs)
    return Ticket(**defaults)


def test_next_ticket_number_increments_from_max(app):
    with app.app_context():
        c = _minimal_user('tl-next-cust@example.com', 'customer')
        db.session.add(c)
        db.session.commit()
        today = datetime.utcnow().strftime('%Y%m%d')
        prefix = f'TICK-{today}-'
        db.session.add(
            _minimal_ticket(
                c,
                ticket_number=f'{prefix}0007',
            )
        )
        db.session.commit()
        nxt = ticket_logic.next_ticket_number()
        assert nxt == f'{prefix}0008'


def test_next_ticket_number_corrupt_suffix_resets_sequence(app):
    with app.app_context():
        c = _minimal_user('tl-corrupt-cust@example.com', 'customer')
        db.session.add(c)
        db.session.commit()
        today = datetime.utcnow().strftime('%Y%m%d')
        prefix = f'TICK-{today}-'
        db.session.add(_minimal_ticket(c, ticket_number=f'{prefix}oops'))
        db.session.commit()
        nxt = ticket_logic.next_ticket_number()
        assert nxt.startswith(prefix)
        assert nxt.endswith('0001')


def test_pick_auto_assign_prefers_available_with_lower_load(app):
    with app.app_context():
        _clear_review_seed_users()
        cust = _minimal_user('tl-pick-cust@example.com', 'customer')
        a1 = _minimal_user('tl-pick-a1@example.com', 'agent', availability_status='busy')
        a2 = _minimal_user('tl-pick-a2@example.com', 'agent', availability_status='available')
        db.session.add_all([cust, a1, a2])
        db.session.commit()
        db.session.add(
            _minimal_ticket(
                cust,
                ticket_number='TICK-PICK-01',
                assigned_to_id=a1.id,
                status='in_progress',
            )
        )
        db.session.commit()
        chosen = ticket_logic.pick_auto_assign_agent('billing')
        assert chosen is not None
        assert chosen.id == a2.id


def test_pick_auto_assign_expertise_tiebreaker(app):
    with app.app_context():
        _clear_review_seed_users()
        cust = _minimal_user('tl-exp-cust@example.com', 'customer')
        a1 = _minimal_user(
            'tl-exp-a1@example.com',
            'agent',
            availability_status='available',
            expertise_areas='["billing"]',
        )
        a2 = _minimal_user(
            'tl-exp-a2@example.com',
            'agent',
            availability_status='available',
            expertise_areas='["technical"]',
        )
        db.session.add_all([cust, a1, a2])
        db.session.commit()
        chosen = ticket_logic.pick_auto_assign_agent('billing')
        assert chosen.id == a1.id


def test_apply_assignment_open_to_assigned(app):
    with app.app_context():
        cust = _minimal_user('tl-asg-cust@example.com', 'customer')
        ag = _minimal_user('tl-asg-ag@example.com', 'agent', availability_status='available')
        db.session.add_all([cust, ag])
        db.session.commit()
        t = _minimal_ticket(cust, ticket_number='TICK-ASG-01', status='open')
        db.session.add(t)
        db.session.commit()
        ticket_logic.apply_assignment(t, ag, assigned_by_id=None)
        db.session.commit()
        assert t.assigned_to_id == ag.id
        assert t.status == 'assigned'


def test_pick_auto_assign_returns_none_without_agents(app):
    with app.app_context():
        _clear_review_seed_users()
        User.query.filter_by(support_role='agent').delete(synchronize_session='fetch')
        db.session.commit()
        assert ticket_logic.pick_auto_assign_agent('general') is None


def test_apply_assignment_in_progress_unchanged(app):
    with app.app_context():
        cust = _minimal_user('tl-asg2-cust@example.com', 'customer')
        ag = _minimal_user('tl-asg2-ag@example.com', 'agent')
        db.session.add_all([cust, ag])
        db.session.commit()
        t = _minimal_ticket(cust, ticket_number='TICK-ASG-02', status='in_progress', assigned_to_id=ag.id)
        db.session.add(t)
        db.session.commit()
        ticket_logic.apply_assignment(t, ag, assigned_by_id=1)
        assert t.status == 'in_progress'
