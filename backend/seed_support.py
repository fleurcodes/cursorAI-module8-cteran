"""Create demo support users (admin, agent, customer). Run from backend dir: python seed_support.py"""

from app import create_app
from extensions import db
from models import User


def main():
    app = create_app()
    with app.app_context():
        demo = [
            ('Support Admin', 'support-admin@example.com', 'admin', 'admin'),
            ('Support Agent', 'support-agent@example.com', 'agent', 'agent'),
            ('Support Customer', 'support-customer@example.com', 'customer', 'customer'),
        ]
        for name, email, role, support in demo:
            if User.query.filter_by(email=email).first():
                continue
            u = User(
                full_name=name,
                email=email,
                role='developer',
                support_role=support,
                availability_status='available' if support == 'agent' else 'offline',
            )
            u.set_password('SupportDemo123!')
            if support == 'agent':
                u.set_expertise_areas(['technical', 'billing', 'general', 'feature_request'])
            db.session.add(u)
        db.session.commit()
        print('Seeded demo users (password SupportDemo123!):')
        for _, email, _, _ in demo:
            print(' ', email)


if __name__ == '__main__':
    main()
