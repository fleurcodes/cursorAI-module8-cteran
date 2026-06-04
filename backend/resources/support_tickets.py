"""Ticket CRUD, comments, status, priority, assignment, history (PRD section 6.2)."""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from werkzeug.utils import secure_filename

from extensions import db, limiter
from models import (
    Ticket,
    TicketAssignment,
    TicketAttachment,
    TicketComment,
    TicketPriorityChange,
    TicketSatisfaction,
    TicketStatusHistory,
    User,
)
from schemas_support import (
    CommentCreateSchema,
    SatisfactionSchema,
    TicketAssignSchema,
    TicketCreateSchema,
    TicketPrioritySchema,
    TicketStatusSchema,
    TicketUpdateSchema,
)
from services import support_notify
from services.ticket_logic import (
    apply_assignment,
    can_transition,
    compute_sla_deadlines,
    pick_auto_assign_agent,
    refresh_sla_flags,
    next_ticket_number,
)
from support_rbac import can_edit_ticket, can_view_ticket, get_support_user, require_support_authenticated
from utils.api_errors import error_response, validation_error
from utils.validation import ALLOWED_ATTACHMENT_EXT, sanitize_comment_body, sanitize_text, sniff_mime

support_tickets_bp = Blueprint('support_tickets', __name__, url_prefix='/api')

MENTION_RE = re.compile(r'@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')


def _serialize_user_short(u: User | None) -> dict | None:
    if not u:
        return None
    return {'id': u.id, 'full_name': u.full_name, 'email': u.email, 'support_role': u.support_role}


def _serialize_ticket(t: Ticket) -> dict:
    refresh_sla_flags(t)
    return {
        'id': t.id,
        'ticket_number': t.ticket_number,
        'subject': t.subject,
        'description': t.description,
        'status': t.status,
        'priority': t.priority,
        'category': t.category,
        'customer_email': t.customer_email,
        'customer': _serialize_user_short(t.customer),
        'assignee': _serialize_user_short(t.assignee),
        'created_at': t.created_at.isoformat() if t.created_at else None,
        'updated_at': t.updated_at.isoformat() if t.updated_at else None,
        'resolved_at': t.resolved_at.isoformat() if t.resolved_at else None,
        'closed_at': t.closed_at.isoformat() if t.closed_at else None,
        'first_response_at': t.first_response_at.isoformat() if t.first_response_at else None,
        'sla_first_response_due': t.sla_first_response_due.isoformat() if t.sla_first_response_due else None,
        'sla_resolution_due': t.sla_resolution_due.isoformat() if t.sla_resolution_due else None,
        'sla_response_breached': t.sla_response_breached,
        'sla_resolution_breached': t.sla_resolution_breached,
        'sla_escalated': t.sla_escalated,
    }


def _save_upload_files(ticket_id: int, comment_id: int | None, files: list, max_files: int = 3) -> list[str]:
    errors: list[str] = []
    if not files:
        return errors
    upload_root = Path(current_app.config['UPLOAD_FOLDER'])
    upload_root.mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(files[:max_files]):
        if not f or not f.filename:
            continue
        name = secure_filename(f.filename)
        ext = Path(name).suffix.lower()
        if ext not in ALLOWED_ATTACHMENT_EXT:
            errors.append(f'File {name}: type not allowed.')
            continue
        data = f.read(6 * 1024 * 1024)
        if len(data) > 5 * 1024 * 1024:
            errors.append(f'File {name}: exceeds 5MB limit.')
            continue
        sniffed = sniff_mime(data)
        if ext == '.pdf' and sniffed and 'pdf' not in sniffed:
            errors.append(f'File {name}: content does not match type.')
            continue
        if ext in ('.jpg', '.jpeg') and sniffed and 'jpeg' not in sniffed:
            errors.append(f'File {name}: content does not match type.')
            continue
        if ext == '.png' and sniffed and 'png' not in sniffed:
            errors.append(f'File {name}: content does not match type.')
            continue
        if ext == '.doc' and sniffed and sniffed != 'application/msword':
            errors.append(f'File {name}: content does not match type.')
            continue
        if ext == '.docx' and sniffed and 'wordprocessingml' not in sniffed and 'zip' not in (sniffed or ''):
            errors.append(f'File {name}: content does not match type.')
            continue
        stored = f'{uuid.uuid4().hex}{ext}'
        out_path = upload_root / stored
        out_path.write_bytes(data)
        rel = str(out_path.relative_to(Path(current_app.root_path)))
        db.session.add(
            TicketAttachment(
                ticket_id=ticket_id,
                comment_id=comment_id,
                filename=name,
                file_path=str(out_path),
                file_size=len(data),
                file_type=f.mimetype or sniffed or 'application/octet-stream',
            )
        )
    return errors


def _mention_user_ids(text: str) -> list[int]:
    emails = {m.group(1).lower() for m in MENTION_RE.finditer(text or '')}
    ids: list[int] = []
    for em in emails:
        u = User.query.filter_by(email=em).first()
        if u:
            ids.append(u.id)
    return ids


@support_tickets_bp.route('/tickets', methods=['GET'])
@jwt_required()
@limiter.limit('100 per minute')
def list_tickets():
    """
    List support tickets with filters and pagination (support roles).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: query
        name: status
        type: string
        required: false
        description: Repeat for multiple (multi)
      - in: query
        name: priority
        type: string
        required: false
      - in: query
        name: category
        type: string
        required: false
      - in: query
        name: assigned_to
        type: integer
        required: false
      - in: query
        name: unassigned
        type: string
        required: false
        description: Use 1 for unassigned only
      - in: query
        name: customer_email
        type: string
        required: false
      - in: query
        name: q
        type: string
        required: false
        description: Search subject, description, ticket number
      - in: query
        name: ticket_number
        type: string
        required: false
      - in: query
        name: created_from
        type: string
        required: false
        description: ISO datetime
      - in: query
        name: created_to
        type: string
        required: false
      - in: query
        name: page
        type: integer
        required: false
      - in: query
        name: per_page
        type: integer
        required: false
    responses:
      200:
        description: Paginated tickets
      401:
        description: Unauthorized
      429:
        description: Rate limited
    """
    user, err = require_support_authenticated()
    if err:
        return err

    q = Ticket.query
    if user.support_role == 'customer':
        q = q.filter(Ticket.customer_id == user.id)
    elif user.support_role == 'agent':
        q = q.filter((Ticket.assigned_to_id == user.id) | (Ticket.assigned_to_id.is_(None)))

    status_list = request.args.getlist('status')
    if status_list:
        q = q.filter(Ticket.status.in_(status_list))
    priorities = request.args.getlist('priority')
    if priorities:
        q = q.filter(Ticket.priority.in_(priorities))
    categories = request.args.getlist('category')
    if categories:
        q = q.filter(Ticket.category.in_(categories))
    assigned_to = request.args.get('assigned_to', type=int)
    if assigned_to is not None:
        q = q.filter(Ticket.assigned_to_id == assigned_to)
    if request.args.get('unassigned') == '1':
        q = q.filter(Ticket.assigned_to_id.is_(None))
    email = request.args.get('customer_email')
    if email and user.support_role in ('admin', 'agent'):
        q = q.filter(Ticket.customer_email.ilike(f'%{email.strip()}%'))
    kw = request.args.get('q')
    if kw:
        like = f'%{kw.strip()}%'
        q = q.filter((Ticket.subject.ilike(like)) | (Ticket.description.ilike(like)) | (Ticket.ticket_number.ilike(like)))
    num = request.args.get('ticket_number')
    if num:
        q = q.filter(Ticket.ticket_number == num.strip())
    df = request.args.get('created_from')
    dt = request.args.get('created_to')
    if df:
        q = q.filter(Ticket.created_at >= datetime.fromisoformat(df))
    if dt:
        q = q.filter(Ticket.created_at <= datetime.fromisoformat(dt))

    page = request.args.get('page', default=1, type=int)
    per_page = min(request.args.get('per_page', default=20, type=int), 100)
    pagination = q.order_by(Ticket.updated_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    for t in pagination.items:
        refresh_sla_flags(t)
    db.session.commit()

    return jsonify(
        {
            'status': 'ok',
            'tickets': [_serialize_ticket(t) for t in pagination.items],
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
        }
    )


@support_tickets_bp.route('/tickets', methods=['POST'])
@jwt_required()
@limiter.limit('30 per minute')
def create_ticket():
    """
    Create a ticket (JSON or multipart with optional files). Admin may set on_behalf_email in JSON.
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    consumes:
      - application/json
      - multipart/form-data
    parameters:
      - in: body
        name: body
        required: false
        description: JSON body when Content-Type is application/json
        schema:
          type: object
          required:
            - subject
            - description
            - priority
            - category
          properties:
            subject:
              type: string
            description:
              type: string
            priority:
              type: string
              enum: [low, medium, high, urgent]
            category:
              type: string
              enum: [technical, billing, general, feature_request]
            customer_email:
              type: string
              format: email
            auto_assign:
              type: boolean
            on_behalf_email:
              type: string
              description: Admin only — create for another user
    responses:
      201:
        description: Ticket created
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Forbidden
      429:
        description: Rate limited
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('customer', 'agent', 'admin'):
        return error_response('Cannot create tickets with this role', 'FORBIDDEN', 403)

    if request.content_type and 'multipart/form-data' in request.content_type:
        form = request.form
        payload_raw = {
            'subject': form.get('subject', ''),
            'description': form.get('description', ''),
            'priority': form.get('priority', 'medium'),
            'category': form.get('category', 'general'),
            'customer_email': form.get('customer_email'),
            'on_behalf_email': form.get('on_behalf_email'),
            'auto_assign': form.get('auto_assign', 'true').lower() in ('1', 'true', 'yes'),
        }
    else:
        payload_raw = request.get_json() or {}

    try:
        payload = TicketCreateSchema().load(payload_raw)
    except ValidationError as ve:
        return validation_error(ve.messages)

    subject = sanitize_text(payload['subject'].strip(), 200)
    description = sanitize_text(payload['description'].strip(), 5000)
    customer_id = user.id
    customer_email = (payload.get('customer_email') or user.email).strip().lower()
    if user.support_role == 'admin':
        ob = payload.get('on_behalf_email')
        if ob:
            other = User.query.filter_by(email=str(ob).strip().lower()).first()
            if not other:
                return error_response('on_behalf_email user not found', 'VALIDATION_ERROR', 400)
            customer_id = other.id
            customer_email = other.email

    t = Ticket(
        ticket_number=next_ticket_number(),
        subject=subject,
        description=description,
        status='open',
        priority=payload['priority'],
        category=payload['category'],
        customer_email=customer_email,
        customer_id=customer_id,
    )
    t.sla_first_response_due, t.sla_resolution_due = compute_sla_deadlines(datetime.utcnow(), t.priority)
    db.session.add(t)
    db.session.flush()

    files = request.files.getlist('files')
    f_err = _save_upload_files(t.id, None, files)
    if f_err:
        db.session.rollback()
        return validation_error({'files': f_err})

    if payload.get('auto_assign', True):
        agent = pick_auto_assign_agent(t.category)
        if agent:
            apply_assignment(t, agent, assigned_by_id=None)

    db.session.add(
        TicketStatusHistory(ticket_id=t.id, user_id=user.id, from_status=None, to_status=t.status)
    )
    db.session.commit()

    support_notify.notify_ticket_created(t)
    if t.assigned_to_id:
        agent = db.session.get(User, t.assigned_to_id)
        if agent:
            support_notify.notify_assigned(t, agent)

    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)}), 201


@support_tickets_bp.route('/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id: int):
    """
    Get ticket detail by id.
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
    responses:
      200:
        description: Ticket
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    if not can_view_ticket(user, t):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    refresh_sla_flags(t)
    db.session.commit()
    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})


@support_tickets_bp.route('/tickets/<int:ticket_id>', methods=['PUT'])
@jwt_required()
def update_ticket(ticket_id: int):
    """
    Update ticket subject/description (agent or admin).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            subject:
              type: string
            description:
              type: string
    responses:
      200:
        description: Updated ticket
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    if user.support_role == 'customer' and t.customer_id != user.id:
        return error_response('Forbidden', 'FORBIDDEN', 403)
    if user.support_role == 'agent' and not can_edit_ticket(user, t):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    if user.support_role not in ('admin', 'agent'):
        return error_response('Forbidden', 'FORBIDDEN', 403)

    try:
        payload = TicketUpdateSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)

    if 'subject' in payload and payload['subject'] is not None:
        t.subject = sanitize_text(payload['subject'].strip(), 200)
    if 'description' in payload and payload['description'] is not None:
        t.description = sanitize_text(payload['description'].strip(), 5000)
    db.session.commit()
    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})


@support_tickets_bp.route('/tickets/<int:ticket_id>', methods=['DELETE'])
@jwt_required()
def delete_ticket(ticket_id: int):
    """
    Delete a ticket (admin only).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
    responses:
      200:
        description: Deleted
      401:
        description: Unauthorized
      403:
        description: Admin only
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role != 'admin':
        return error_response('Admin only', 'FORBIDDEN', 403)
    t = db.session.get(Ticket, ticket_id)
    if not t:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'status': 'ok'}), 200


@support_tickets_bp.route('/tickets/<int:ticket_id>/status', methods=['PUT'])
@jwt_required()
def update_status(ticket_id: int):
    """
    Transition ticket status (RBAC and state machine apply).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - status
          properties:
            status:
              type: string
            note:
              type: string
    responses:
      200:
        description: Updated ticket
      400:
        description: Invalid transition
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    if not can_view_ticket(user, t):
        return error_response('Forbidden', 'FORBIDDEN', 403)

    try:
        payload = TicketStatusSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)

    new_status = payload['status'].strip()
    old = t.status

    if user.support_role == 'customer':
        if new_status != 'reopened':
            return error_response('Customers can only reopen tickets', 'FORBIDDEN', 403)
    elif user.support_role in ('agent', 'admin'):
        if not can_edit_ticket(user, t) and user.support_role != 'admin':
            return error_response('Forbidden', 'FORBIDDEN', 403)
    else:
        return error_response('Forbidden', 'FORBIDDEN', 403)

    if (
        new_status == 'in_progress'
        and t.assigned_to_id is None
        and user.support_role in ('agent', 'admin')
        and t.status == 'open'
    ):
        apply_assignment(t, user, assigned_by_id=user.id if user.support_role == 'admin' else None)

    ok, reason = can_transition(t.status, new_status, t, user.support_role)
    if not ok:
        return error_response(reason or 'Invalid transition', 'VALIDATION_ERROR', 400)

    t.status = new_status
    if new_status == 'resolved':
        t.resolved_at = datetime.utcnow()
    if new_status == 'closed':
        t.closed_at = datetime.utcnow()
    if new_status in ('in_progress', 'assigned') and t.first_response_at is None and user.support_role in (
        'agent',
        'admin',
    ):
        t.first_response_at = datetime.utcnow()

    db.session.add(TicketStatusHistory(ticket_id=t.id, user_id=user.id, from_status=old, to_status=new_status))
    db.session.commit()
    support_notify.notify_status_change(t, old, new_status)
    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})


@support_tickets_bp.route('/tickets/<int:ticket_id>/priority', methods=['PUT'])
@jwt_required()
def update_priority(ticket_id: int):
    """
    Change ticket priority with reason (agent or admin).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - priority
            - reason
          properties:
            priority:
              type: string
              enum: [low, medium, high, urgent]
            reason:
              type: string
    responses:
      200:
        description: Updated ticket
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('agent', 'admin'):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    t = db.session.get(Ticket, ticket_id)
    if not t or not can_view_ticket(user, t):
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    if user.support_role == 'agent' and not can_edit_ticket(user, t):
        return error_response('Forbidden', 'FORBIDDEN', 403)

    try:
        payload = TicketPrioritySchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)

    old_p = t.priority
    new_p = payload['priority']
    if old_p == new_p:
        return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})
    t.priority = new_p
    t.sla_first_response_due, t.sla_resolution_due = compute_sla_deadlines(t.created_at, new_p)
    db.session.add(
        TicketPriorityChange(
            ticket_id=t.id,
            user_id=user.id,
            old_priority=old_p,
            new_priority=new_p,
            reason=sanitize_text(payload['reason'].strip(), 2000),
        )
    )
    db.session.commit()
    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})


@support_tickets_bp.route('/tickets/<int:ticket_id>/assign', methods=['POST'])
@jwt_required()
def assign_ticket(ticket_id: int):
    """
    Assign ticket to an agent (admin only).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - agent_id
          properties:
            agent_id:
              type: integer
    responses:
      200:
        description: Updated ticket
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Admin only
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role != 'admin':
        return error_response('Admin only', 'FORBIDDEN', 403)
    t = db.session.get(Ticket, ticket_id)
    if not t:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    try:
        payload = TicketAssignSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)
    agent = db.session.get(User, payload['agent_id'])
    if not agent or agent.support_role != 'agent':
        return error_response('Invalid agent', 'VALIDATION_ERROR', 400)
    prev_status = t.status
    apply_assignment(t, agent, assigned_by_id=user.id)
    if prev_status == 'open' and t.status == 'assigned':
        db.session.add(
            TicketStatusHistory(
                ticket_id=t.id,
                user_id=user.id,
                from_status='open',
                to_status='assigned',
            )
        )
    db.session.commit()
    support_notify.notify_assigned(t, agent)
    return jsonify({'status': 'ok', 'ticket': _serialize_ticket(t)})


@support_tickets_bp.route('/tickets/<int:ticket_id>/comments', methods=['GET'])
@jwt_required()
def list_comments(ticket_id: int):
    """
    List comments on a ticket (internal notes hidden from customers).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
    responses:
      200:
        description: Comments array
      401:
        description: Unauthorized
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t or not can_view_ticket(user, t):
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    q = TicketComment.query.filter_by(ticket_id=t.id).order_by(TicketComment.created_at.asc())
    items = []
    for c in q:
        if c.is_internal and user.support_role == 'customer':
            continue
        items.append(
            {
                'id': c.id,
                'content': c.content,
                'is_internal': c.is_internal,
                'created_at': c.created_at.isoformat() if c.created_at else None,
                'author': _serialize_user_short(c.author),
                'attachments': [
                    {'id': a.id, 'filename': a.filename, 'size': a.file_size, 'type': a.file_type}
                    for a in c.attachments
                ],
            }
        )
    return jsonify({'status': 'ok', 'comments': items})


@support_tickets_bp.route('/tickets/<int:ticket_id>/comments', methods=['POST'])
@jwt_required()
@limiter.limit('60 per minute')
def add_comment(ticket_id: int):
    """
    Add a comment (JSON or multipart with optional files).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    consumes:
      - application/json
      - multipart/form-data
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: false
        description: JSON when not multipart
        schema:
          type: object
          required:
            - content
          properties:
            content:
              type: string
            is_internal:
              type: boolean
              description: Agent/admin only
    responses:
      201:
        description: Comment created
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Not found
      429:
        description: Rate limited
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t or not can_view_ticket(user, t):
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    if user.support_role == 'customer' and t.customer_id != user.id:
        return error_response('Forbidden', 'FORBIDDEN', 403)

    if request.content_type and 'multipart/form-data' in (request.content_type or ''):
        payload_raw = {
            'content': request.form.get('content', ''),
            'is_internal': request.form.get('is_internal', 'false').lower() in ('1', 'true', 'yes'),
        }
    else:
        payload_raw = request.get_json() or {}

    try:
        payload = CommentCreateSchema().load(payload_raw)
    except ValidationError as ve:
        return validation_error(ve.messages)

    is_internal = bool(payload.get('is_internal')) and user.support_role in ('agent', 'admin')
    body = sanitize_comment_body(payload['content'])
    c = TicketComment(ticket_id=t.id, user_id=user.id, content=body, is_internal=is_internal)
    db.session.add(c)
    db.session.flush()

    files = request.files.getlist('files')
    f_err = _save_upload_files(t.id, c.id, files)
    if f_err:
        db.session.rollback()
        return validation_error({'files': f_err})

    if not t.first_response_at and not is_internal and user.support_role in ('agent', 'admin'):
        t.first_response_at = datetime.utcnow()

    mention_ids = _mention_user_ids(body)
    recipients = {t.customer_id, t.assigned_to_id or 0, *mention_ids}
    recipients.discard(0)
    db.session.commit()
    support_notify.notify_new_comment(t, list(recipients), user.id)
    return jsonify({'status': 'ok', 'comment_id': c.id}), 201


@support_tickets_bp.route('/tickets/<int:ticket_id>/history', methods=['GET'])
@jwt_required()
def ticket_history(ticket_id: int):
    """
    Combined status, assignment, and priority history for a ticket.
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
    responses:
      200:
        description: History events
      401:
        description: Unauthorized
      404:
        description: Not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    t = db.session.get(Ticket, ticket_id)
    if not t or not can_view_ticket(user, t):
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    events: list[dict] = []
    for h in TicketStatusHistory.query.filter_by(ticket_id=t.id).order_by(TicketStatusHistory.created_at.asc()):
        events.append(
            {
                'type': 'status',
                'at': h.created_at.isoformat() if h.created_at else None,
                'from': h.from_status,
                'to': h.to_status,
                'user': _serialize_user_short(h.user),
            }
        )
    for a in TicketAssignment.query.filter_by(ticket_id=t.id).order_by(TicketAssignment.assigned_at.asc()):
        events.append(
            {
                'type': 'assignment',
                'at': a.assigned_at.isoformat() if a.assigned_at else None,
                'assignee': _serialize_user_short(a.assignee),
                'assigned_by': _serialize_user_short(a.assigned_by),
            }
        )
    for p in TicketPriorityChange.query.filter_by(ticket_id=t.id).order_by(TicketPriorityChange.created_at.asc()):
        events.append(
            {
                'type': 'priority',
                'at': p.created_at.isoformat() if p.created_at else None,
                'from': p.old_priority,
                'to': p.new_priority,
                'reason': p.reason,
                'user': _serialize_user_short(p.user),
            }
        )
    events.sort(key=lambda e: e.get('at') or '')
    return jsonify({'status': 'ok', 'history': events})


@support_tickets_bp.route('/tickets/<int:ticket_id>/satisfaction', methods=['POST'])
@jwt_required()
def add_satisfaction(ticket_id: int):
    """
    Submit CSAT score 1–5 (customer, own ticket, once).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    parameters:
      - in: path
        name: ticket_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - score
          properties:
            score:
              type: integer
              minimum: 1
              maximum: 5
    responses:
      201:
        description: Recorded
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Customers only
      404:
        description: Not found
      409:
        description: Already submitted
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role != 'customer':
        return error_response('Customers only', 'FORBIDDEN', 403)
    t = db.session.get(Ticket, ticket_id)
    if not t or t.customer_id != user.id:
        return error_response('Ticket not found', 'NOT_FOUND', 404)
    try:
        payload = SatisfactionSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)
    if TicketSatisfaction.query.filter_by(ticket_id=t.id).first():
        return error_response('Already submitted', 'CONFLICT', 409)
    db.session.add(TicketSatisfaction(ticket_id=t.id, score=payload['score']))
    db.session.commit()
    return jsonify({'status': 'ok'}), 201


@support_tickets_bp.route('/tickets/export.csv', methods=['GET'])
@jwt_required()
def export_tickets_csv():
    """
    Download tickets as CSV (admin only, capped rows).
    ---
    tags:
      - SupportTickets
    security:
      - Bearer: []
    produces:
      - text/csv
    responses:
      200:
        description: CSV attachment
      401:
        description: Unauthorized
      403:
        description: Admin only
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role != 'admin':
        return error_response('Admin only', 'FORBIDDEN', 403)
    q = Ticket.query.order_by(Ticket.created_at.desc()).limit(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            'ticket_number',
            'subject',
            'status',
            'priority',
            'category',
            'customer_email',
            'assignee_id',
            'created_at',
            'resolved_at',
        ]
    )
    for t in q:
        w.writerow(
            [
                t.ticket_number,
                t.subject,
                t.status,
                t.priority,
                t.category,
                t.customer_email,
                t.assigned_to_id or '',
                t.created_at.isoformat() if t.created_at else '',
                t.resolved_at.isoformat() if t.resolved_at else '',
            ]
        )
    from flask import Response

    return Response(buf.getvalue(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=tickets.csv'})
