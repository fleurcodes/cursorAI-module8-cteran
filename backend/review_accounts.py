"""Predefined reviewer accounts (created on app startup if missing). See root README."""

from flask import current_app

from extensions import db
from models import User

REVIEW_ACCOUNTS = (
    {
        'email': 'admin@example.com',
        'full_name': 'Admin Smith',
        'password': 'Test1234*',
        'role': 'manager',
        'support_role': 'admin',
    },
    {
        'email': 'support@example.com',
        'full_name': 'Support Ashlyn',
        'password': 'Test1234*',
        'role': 'manager',
        'support_role': 'agent',
    },
)


def ensure_review_accounts() -> None:
    """Create reviewer demo users when absent (idempotent)."""
    bcrypt_rounds = int(current_app.config.get('BCRYPT_ROUNDS', 12))
    for spec in REVIEW_ACCOUNTS:
        email = spec['email'].strip().lower()
        if User.query.filter_by(email=email).first():
            continue
        support = spec['support_role']
        user = User(
            full_name=spec['full_name'],
            email=email,
            role=spec['role'],
            support_role=support,
            availability_status='available' if support == 'agent' else 'offline',
        )
        user.set_password(spec['password'], bcrypt_rounds=bcrypt_rounds)
        if support == 'agent':
            user.set_expertise_areas(['technical', 'billing', 'general', 'feature_request'])
        db.session.add(user)
    db.session.commit()
