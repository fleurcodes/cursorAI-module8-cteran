import json
from datetime import datetime, date

import bcrypt
from werkzeug.security import check_password_hash

from extensions import db


class ProjectMember(db.Model):
    __tablename__ = 'project_members'
    __table_args__ = (db.Index('ix_project_members_project_user', 'project_id', 'user_id'),)

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(64), nullable=False, default='contributor')
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    project = db.relationship('Project', back_populates='memberships')
    user = db.relationship('User', back_populates='project_memberships')


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(64), nullable=False, default='developer')
    status = db.Column(db.String(32), nullable=False, default='online')
    avatar_url = db.Column(db.String(256), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    # Customer support RBAC (PRD): none | customer | agent | admin
    support_role = db.Column(db.String(32), nullable=False, default='none')
    availability_status = db.Column(db.String(32), nullable=False, default='offline')
    expertise_areas = db.Column(db.Text, nullable=True)

    project_memberships = db.relationship(
        'ProjectMember',
        back_populates='user',
        cascade='all, delete-orphan',
    )
    projects = db.relationship(
        'Project',
        secondary='project_members',
        back_populates='members',
        viewonly=True,
    )
    assigned_tasks = db.relationship(
        'Task',
        back_populates='assignee',
        foreign_keys='Task.assignee_id',
    )
    created_tasks = db.relationship(
        'Task',
        back_populates='creator',
        foreign_keys='Task.creator_id',
    )
    notifications = db.relationship(
        'Notification',
        back_populates='user',
        cascade='all, delete-orphan',
        foreign_keys='Notification.user_id',
    )
    tickets_as_customer = db.relationship(
        'Ticket',
        back_populates='customer',
        foreign_keys='Ticket.customer_id',
    )
    tickets_assigned = db.relationship(
        'Ticket',
        back_populates='assignee',
        foreign_keys='Ticket.assigned_to_id',
    )
    ticket_comments = db.relationship('TicketComment', back_populates='author')
    in_app_notifications = db.relationship('InAppNotification', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password: str, bcrypt_rounds: int = 12) -> None:
        """Hash password with bcrypt (PRD NFR-005). Legacy pbkdf2 hashes remain verifiable via check_password."""
        pw = password.encode('utf-8')
        self.password_hash = bcrypt.hashpw(pw, bcrypt.gensalt(rounds=bcrypt_rounds)).decode('utf-8')

    def check_password(self, password: str) -> bool:
        stored = self.password_hash
        if stored.startswith('$2'):
            try:
                return bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8'))
            except ValueError:
                return False
        return check_password_hash(stored, password)

    def get_expertise_areas(self) -> list:
        if not self.expertise_areas:
            return []
        try:
            data = json.loads(self.expertise_areas)
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            return []

    def set_expertise_areas(self, areas: list) -> None:
        self.expertise_areas = json.dumps(list(areas)) if areas else None


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), nullable=False, default='on-track')
    progress = db.Column(db.Integer, nullable=False, default=0)
    total_tasks = db.Column(db.Integer, nullable=False, default=0)
    completed_tasks = db.Column(db.Integer, nullable=False, default=0)
    in_progress_tasks = db.Column(db.Integer, nullable=False, default=0)
    overdue_tasks = db.Column(db.Integer, nullable=False, default=0)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tasks = db.relationship(
        'Task',
        back_populates='project',
        cascade='all, delete-orphan',
        lazy='joined',
    )
    memberships = db.relationship(
        'ProjectMember',
        back_populates='project',
        cascade='all, delete-orphan',
    )
    members = db.relationship(
        'User',
        secondary='project_members',
        back_populates='projects',
        viewonly=True,
    )

    def recalculate_metrics(self) -> None:
        self.total_tasks = len(self.tasks)
        self.completed_tasks = sum(1 for task in self.tasks if task.status == 'completed')
        self.in_progress_tasks = sum(1 for task in self.tasks if task.status == 'in-progress')
        self.overdue_tasks = sum(
            1
            for task in self.tasks
            if task.due_date and task.due_date < date.today() and task.status != 'completed'
        )
        self.progress = round((self.completed_tasks / self.total_tasks) * 100) if self.total_tasks else 0


class Task(db.Model):
    __tablename__ = 'tasks'
    __table_args__ = (
        db.Index('ix_tasks_project_id', 'project_id'),
        db.Index('ix_tasks_project_status', 'project_id', 'status'),
        db.Index('ix_tasks_assignee_id', 'assignee_id'),
        db.Index('ix_tasks_creator_id', 'creator_id'),
        db.Index('ix_tasks_due_date', 'due_date'),
    )

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(32),
        nullable=False,
        default='todo',
    )
    priority = db.Column(
        db.String(32),
        nullable=False,
        default='medium',
    )
    due_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    assignee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    project = db.relationship('Project', back_populates='tasks')
    assignee = db.relationship(
        'User',
        back_populates='assigned_tasks',
        foreign_keys=[assignee_id],
    )
    creator = db.relationship(
        'User',
        back_populates='created_tasks',
        foreign_keys=[creator_id],
    )


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    title = db.Column(db.String(128), nullable=False)
    message = db.Column(db.Text, nullable=False)
    level = db.Column(db.String(32), nullable=False, default='info')
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', back_populates='notifications', foreign_keys=[user_id])
    sender = db.relationship('User', foreign_keys=[sender_id])
    project = db.relationship('Project')


class Ticket(db.Model):
    __tablename__ = 'tickets'

    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(32), nullable=False, default='open')
    priority = db.Column(db.String(32), nullable=False, default='medium')
    category = db.Column(db.String(64), nullable=False)
    customer_email = db.Column(db.String(128), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    closed_at = db.Column(db.DateTime, nullable=True)
    first_response_at = db.Column(db.DateTime, nullable=True)
    sla_first_response_due = db.Column(db.DateTime, nullable=True)
    sla_resolution_due = db.Column(db.DateTime, nullable=True)
    sla_response_breached = db.Column(db.Boolean, default=False, nullable=False)
    sla_resolution_breached = db.Column(db.Boolean, default=False, nullable=False)
    sla_escalated = db.Column(db.Boolean, default=False, nullable=False)

    customer = db.relationship('User', back_populates='tickets_as_customer', foreign_keys=[customer_id])
    assignee = db.relationship('User', back_populates='tickets_assigned', foreign_keys=[assigned_to_id])
    comments = db.relationship('TicketComment', back_populates='ticket', cascade='all, delete-orphan')
    attachments = db.relationship('TicketAttachment', back_populates='ticket', cascade='all, delete-orphan')
    assignments = db.relationship('TicketAssignment', back_populates='ticket', cascade='all, delete-orphan')
    status_history = db.relationship('TicketStatusHistory', back_populates='ticket', cascade='all, delete-orphan')
    priority_changes = db.relationship('TicketPriorityChange', back_populates='ticket', cascade='all, delete-orphan')
    satisfaction = db.relationship('TicketSatisfaction', back_populates='ticket', uselist=False, cascade='all, delete-orphan')


class TicketComment(db.Model):
    __tablename__ = 'ticket_comments'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='comments')
    author = db.relationship('User', back_populates='ticket_comments')
    attachments = db.relationship('TicketAttachment', back_populates='comment', cascade='all, delete-orphan')


class TicketAssignment(db.Model):
    __tablename__ = 'ticket_assignments'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='assignments')
    assignee = db.relationship('User', foreign_keys=[assigned_to_id])
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])


class TicketAttachment(db.Model):
    __tablename__ = 'ticket_attachments'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('ticket_comments.id'), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(128), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='attachments')
    comment = db.relationship('TicketComment', back_populates='attachments')


class TicketStatusHistory(db.Model):
    __tablename__ = 'ticket_status_history'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    from_status = db.Column(db.String(32), nullable=True)
    to_status = db.Column(db.String(32), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='status_history')
    user = db.relationship('User')


class TicketPriorityChange(db.Model):
    __tablename__ = 'ticket_priority_changes'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    old_priority = db.Column(db.String(32), nullable=False)
    new_priority = db.Column(db.String(32), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='priority_changes')
    user = db.relationship('User')


class InAppNotification(db.Model):
    __tablename__ = 'in_app_notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', back_populates='in_app_notifications')
    ticket = db.relationship('Ticket')


class UserNotificationPreference(db.Model):
    __tablename__ = 'user_notification_preferences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    email_ticket_created = db.Column(db.Boolean, default=True, nullable=False)
    email_ticket_assigned = db.Column(db.Boolean, default=True, nullable=False)
    email_status_changed = db.Column(db.Boolean, default=True, nullable=False)
    email_new_comment = db.Column(db.Boolean, default=True, nullable=False)
    email_sla = db.Column(db.Boolean, default=True, nullable=False)
    in_app_enabled = db.Column(db.Boolean, default=True, nullable=False)

    user = db.relationship('User')


class TicketSatisfaction(db.Model):
    __tablename__ = 'ticket_satisfaction'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), unique=True, nullable=False)
    score = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='satisfaction')
