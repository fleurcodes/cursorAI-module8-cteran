"""Agent listing and availability (PRD section 6.3)."""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from models import Ticket, User
from support_rbac import require_support_authenticated
from utils.api_errors import error_response

support_agents_bp = Blueprint('support_agents', __name__, url_prefix='/api')


@support_agents_bp.route('/agents', methods=['GET'])
@jwt_required()
def list_agents():
    """
    List support agents (admin or agent).
    ---
    tags:
      - SupportAgents
    security:
      - Bearer: []
    responses:
      200:
        description: Agents list
      401:
        description: Unauthorized
      403:
        description: Forbidden
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('admin', 'agent'):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    agents = User.query.filter_by(support_role='agent').order_by(User.full_name).all()
    return jsonify(
        {
            'status': 'ok',
            'agents': [
                {
                    'id': a.id,
                    'full_name': a.full_name,
                    'email': a.email,
                    'availability_status': a.availability_status,
                    'expertise_areas': a.get_expertise_areas(),
                }
                for a in agents
            ],
        }
    )


@support_agents_bp.route('/agents/<int:agent_id>/tickets', methods=['GET'])
@jwt_required()
def agent_tickets(agent_id: int):
    """
    Tickets assigned to an agent (admin any agent; agent self only).
    ---
    tags:
      - SupportAgents
    security:
      - Bearer: []
    parameters:
      - in: path
        name: agent_id
        type: integer
        required: true
    responses:
      200:
        description: Ticket summaries
      401:
        description: Unauthorized
      403:
        description: Forbidden
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('admin', 'agent'):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    if user.support_role == 'agent' and user.id != agent_id:
        return error_response('Forbidden', 'FORBIDDEN', 403)
    tickets = Ticket.query.filter_by(assigned_to_id=agent_id).order_by(Ticket.updated_at.desc()).limit(200).all()
    return jsonify(
        {
            'status': 'ok',
            'tickets': [
                {
                    'id': t.id,
                    'ticket_number': t.ticket_number,
                    'subject': t.subject,
                    'status': t.status,
                    'priority': t.priority,
                    'updated_at': t.updated_at.isoformat() if t.updated_at else None,
                }
                for t in tickets
            ],
        }
    )


@support_agents_bp.route('/agents/<int:agent_id>/availability', methods=['PUT'])
@jwt_required()
def update_availability(agent_id: int):
    """
    Set agent availability (available, busy, offline).
    ---
    tags:
      - SupportAgents
    security:
      - Bearer: []
    parameters:
      - in: path
        name: agent_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - availability_status
          properties:
            availability_status:
              type: string
              enum: [available, busy, offline]
    responses:
      200:
        description: OK
      400:
        description: Invalid status
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Agent not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('admin', 'agent'):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    if user.support_role == 'agent' and user.id != agent_id:
        return error_response('Forbidden', 'FORBIDDEN', 403)
    agent = db.session.get(User, agent_id)
    if not agent or agent.support_role != 'agent':
        return error_response('Agent not found', 'NOT_FOUND', 404)
    body = request.get_json() or {}
    status = (body.get('availability_status') or '').strip()
    if status not in ('available', 'busy', 'offline'):
        return error_response('Invalid availability_status', 'VALIDATION_ERROR', 400)
    agent.availability_status = status
    db.session.commit()
    return jsonify({'status': 'ok', 'availability_status': agent.availability_status})
