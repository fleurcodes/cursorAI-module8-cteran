"""Admin dashboard and reports (PRD section 6.4)."""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from extensions import db
from models import Ticket, TicketSatisfaction, User
from schemas_support import AdminReportExportSchema, UserUpdateSupportSchema
from support_rbac import require_support_authenticated
from utils.api_errors import error_response, validation_error

support_admin_bp = Blueprint('support_admin', __name__, url_prefix='/api/admin')


def _dashboard_metrics() -> dict:
    """Aggregate ticket counts. Note: auto-assigned tickets use status ``assigned``, not ``open``."""

    def count_status(s: str) -> int:
        return Ticket.query.filter_by(status=s).count()

    def count_in(*statuses: str) -> int:
        return Ticket.query.filter(Ticket.status.in_(statuses)).count()

    total = Ticket.query.count()
    # "Open" = backlog / awaiting agent work (excludes in_progress, resolved, closed)
    open_c = count_in('open', 'assigned', 'waiting', 'reopened')
    in_progress = count_status('in_progress')
    resolved = count_status('resolved')
    closed = count_status('closed')

    resolved_rows = Ticket.query.filter(Ticket.resolved_at.isnot(None)).all()
    resolution_hours: list[float] = []
    for t in resolved_rows:
        if t.resolved_at and t.created_at:
            resolution_hours.append((t.resolved_at - t.created_at).total_seconds() / 3600.0)
    avg_resolution = sum(resolution_hours) / len(resolution_hours) if resolution_hours else 0.0

    by_priority = {p: Ticket.query.filter_by(priority=p).count() for p in ['urgent', 'high', 'medium', 'low']}
    by_category: dict[str, int] = {}
    for row in db.session.query(Ticket.category, db.func.count(Ticket.id)).group_by(Ticket.category).all():
        by_category[row[0]] = row[1]

    agents = User.query.filter_by(support_role='agent').all()
    agent_metrics = []
    for a in agents:
        assigned = Ticket.query.filter_by(assigned_to_id=a.id).count()
        closed_cnt = Ticket.query.filter_by(assigned_to_id=a.id, status='closed').count()
        agent_metrics.append(
            {
                'id': a.id,
                'name': a.full_name,
                'availability': a.availability_status,
                'assigned_total': assigned,
                'closed_total': closed_cnt,
            }
        )

    sla_ok = Ticket.query.filter_by(sla_resolution_breached=False).count()
    sla_rate = (sla_ok / total) if total else 1.0

    sat = db.session.query(db.func.avg(TicketSatisfaction.score)).scalar()
    avg_csat = float(sat) if sat is not None else None

    return {
        'total_tickets': total,
        'open': open_c,
        'in_progress': in_progress,
        'resolved': resolved,
        'closed': closed,
        'average_resolution_hours': round(avg_resolution, 2),
        'by_priority': by_priority,
        'by_category': by_category,
        'agent_performance': agent_metrics,
        'sla_compliance_rate': round(sla_rate, 4),
        'average_satisfaction': round(avg_csat, 2) if avg_csat is not None else None,
    }


@support_admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    """
    Support admin dashboard metrics.
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    responses:
      200:
        description: Metrics object
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
    return jsonify({'status': 'ok', 'metrics': _dashboard_metrics()})


@support_admin_bp.route('/reports/tickets', methods=['GET'])
@jwt_required()
def reports_tickets():
    """
    Ticket volume by day for a period (daily, weekly, monthly).
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    parameters:
      - in: query
        name: period
        type: string
        enum: [daily, weekly, monthly]
        required: false
    responses:
      200:
        description: Volume buckets
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
    period = request.args.get('period', 'daily')
    now = datetime.utcnow()
    if period == 'weekly':
        start = now - timedelta(days=7)
    elif period == 'monthly':
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=1)

    q = Ticket.query.filter(Ticket.created_at >= start)
    buckets: dict[str, int] = {}
    for t in q:
        key = t.created_at.date().isoformat() if t.created_at else 'unknown'
        buckets[key] = buckets.get(key, 0) + 1
    return jsonify({'status': 'ok', 'period': period, 'volume_by_day': buckets})


@support_admin_bp.route('/reports/agents', methods=['GET'])
@jwt_required()
def reports_agents():
    """
    Agent performance snapshot (from dashboard metrics).
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    responses:
      200:
        description: Agents metrics
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
    metrics = _dashboard_metrics()
    return jsonify({'status': 'ok', 'agents': metrics['agent_performance']})


@support_admin_bp.route('/reports/sla', methods=['GET'])
@jwt_required()
def reports_sla():
    """
    SLA breach summary.
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    responses:
      200:
        description: Breach counts and compliance rate
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
    breached = Ticket.query.filter_by(sla_resolution_breached=True).count()
    total = Ticket.query.count()
    return jsonify(
        {
            'status': 'ok',
            'breached_count': breached,
            'total': total,
            'compliance_rate': round((total - breached) / total, 4) if total else 1.0,
        }
    )


@support_admin_bp.route('/reports/export', methods=['POST'])
@jwt_required()
def reports_export():
    """
    Export a report as CSV (or JSON sample for tickets+json).
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - report_type
          properties:
            report_type:
              type: string
              enum: [tickets, agents, sla, categories]
            format:
              type: string
              enum: [csv, json]
    responses:
      200:
        description: CSV file or JSON body
      400:
        description: Validation error
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
    try:
        payload = AdminReportExportSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)

    fmt = payload['format']
    rtype = payload['report_type']

    if fmt == 'json':
        if rtype == 'tickets':
            data = [t.ticket_number for t in Ticket.query.limit(100)]
            return jsonify({'status': 'ok', 'type': rtype, 'sample': data})

    buf = io.StringIO()
    w = csv.writer(buf)
    if rtype == 'tickets':
        w.writerow(['ticket_number', 'status', 'priority', 'category', 'customer_email', 'created_at'])
        for t in Ticket.query.order_by(Ticket.created_at.desc()).limit(5000):
            w.writerow(
                [
                    t.ticket_number,
                    t.status,
                    t.priority,
                    t.category,
                    t.customer_email,
                    t.created_at.isoformat() if t.created_at else '',
                ]
            )
    elif rtype == 'agents':
        w.writerow(['agent_id', 'name', 'availability', 'open_assigned'])
        for a in User.query.filter_by(support_role='agent').all():
            open_cnt = Ticket.query.filter_by(assigned_to_id=a.id).filter(Ticket.status != 'closed').count()
            w.writerow([a.id, a.full_name, a.availability_status, open_cnt])
    elif rtype == 'sla':
        w.writerow(['ticket_number', 'sla_response_breached', 'sla_resolution_breached', 'escalated'])
        for t in Ticket.query.limit(5000):
            w.writerow([t.ticket_number, t.sla_response_breached, t.sla_resolution_breached, t.sla_escalated])
    else:
        w.writerow(['category', 'count'])
        for cat, cnt in db.session.query(Ticket.category, db.func.count(Ticket.id)).group_by(Ticket.category).all():
            w.writerow([cat, cnt])

    return Response(
        buf.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=report_{rtype}.csv'},
    )


@support_admin_bp.route('/users', methods=['GET'])
@jwt_required()
def admin_list_users():
    """
    List all users with support fields (admin).
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    responses:
      200:
        description: Users list
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
    users = User.query.order_by(User.email).all()
    return jsonify(
        {
            'status': 'ok',
            'users': [
                {
                    'id': u.id,
                    'full_name': u.full_name,
                    'email': u.email,
                    'support_role': u.support_role,
                    'availability_status': u.availability_status,
                    'expertise_areas': u.get_expertise_areas(),
                }
                for u in users
            ],
        }
    )


@support_admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def admin_update_user(user_id: int):
    """
    Update a user support profile (role, availability, expertise, name).
    ---
    tags:
      - SupportAdmin
    security:
      - Bearer: []
    parameters:
      - in: path
        name: user_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            full_name:
              type: string
            support_role:
              type: string
              enum: [none, customer, agent, admin]
            availability_status:
              type: string
              enum: [available, busy, offline]
            expertise_areas:
              type: array
              items:
                type: string
    responses:
      200:
        description: Updated user
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Admin only
      404:
        description: User not found
    """
    admin, err = require_support_authenticated()
    if err:
        return err
    if admin.support_role != 'admin':
        return error_response('Admin only', 'FORBIDDEN', 403)
    target = db.session.get(User, user_id)
    if not target:
        return error_response('User not found', 'NOT_FOUND', 404)
    try:
        payload = UserUpdateSupportSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)
    if 'full_name' in payload and payload['full_name'] is not None:
        target.full_name = payload['full_name'].strip()
    if 'support_role' in payload and payload['support_role'] is not None:
        target.support_role = payload['support_role']
    if 'availability_status' in payload and payload['availability_status'] is not None:
        target.availability_status = payload['availability_status']
    if 'expertise_areas' in payload and payload['expertise_areas'] is not None:
        target.set_expertise_areas(payload['expertise_areas'])
    db.session.commit()
    return jsonify(
        {
            'status': 'ok',
            'user': {
                'id': target.id,
                'full_name': target.full_name,
                'email': target.email,
                'support_role': target.support_role,
                'availability_status': target.availability_status,
                'expertise_areas': target.get_expertise_areas(),
            },
        }
    )
