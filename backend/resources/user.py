from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError

from extensions import db
from models import InAppNotification, User, Project, ProjectMember, UserNotificationPreference
from schemas import UserSchema, ProjectSchema
from schemas_support import NotificationPreferencesSchema
from support_rbac import require_support_authenticated
from utils.api_errors import error_response, validation_error


user_bp = Blueprint('user', __name__, url_prefix='/api')


def get_current_user():
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    return User.query.get(int(user_id))


@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    """
    Current authenticated user profile.
    ---
    tags:
      - UserAndTeam
    security:
      - Bearer: []
    responses:
      200:
        description: User payload
      401:
        description: Unauthorized
      404:
        description: User not found
    """
    user = get_current_user()
    if not user:
        return jsonify({'message': 'User not found'}), 404
    return jsonify({'user': UserSchema().dump(user)}), 200


@user_bp.route('/projects', methods=['GET'])
@jwt_required()
def list_projects():
    """
    Projects the current user belongs to (same data as GET /api/projects on projects blueprint).
    ---
    tags:
      - UserAndTeam
    security:
      - Bearer: []
    responses:
      200:
        description: List of projects
      401:
        description: Unauthorized
      404:
        description: User not found
    """
    user = get_current_user()
    if not user:
        return jsonify({'message': 'User not found'}), 404

    projects = (
        Project.query
        .join(ProjectMember)
        .filter(ProjectMember.user_id == user.id)
        .all()
    )

    return jsonify({'projects': ProjectSchema(many=True).dump(projects)}), 200


@user_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """
    List registered users (e.g. for inviting to a project).
    ---
    tags:
      - UserAndTeam
    security:
      - Bearer: []
    responses:
      200:
        description: Users array
      401:
        description: Unauthorized
    """
    users = User.query.order_by(User.full_name).all()
    return jsonify({'users': UserSchema(many=True).dump(users)}), 200


@user_bp.route('/team', methods=['GET'])
@jwt_required()
def team_dashboard():
    """
    Team dashboard aggregate (current user plus related members).
    ---
    tags:
      - UserAndTeam
    security:
      - Bearer: []
    responses:
      200:
        description: Welcome message, user, and team list
      401:
        description: Unauthorized
      404:
        description: User not found
    """
    user = get_current_user()
    if not user:
        return jsonify({'message': 'User not found'}), 404

    team_members = []
    seen_ids = set()

    for membership in user.project_memberships:
        for member in membership.project.members:
            if member.id not in seen_ids:
                seen_ids.add(member.id)
                team_members.append({'id': member.id, 'name': member.full_name, 'role': member.role, 'status': member.status})

    return jsonify({
        'message': 'Welcome to the protected Team Dashboard API.',
        'user': UserSchema().dump(user),
        'team': team_members,
    }), 200


@user_bp.route('/profile/support-notifications', methods=['GET'])
@jwt_required()
def list_support_notifications():
    """
    In-app support notifications for agents/admins.
    ---
    tags:
      - SupportProfile
    security:
      - Bearer: []
    responses:
      200:
        description: Notifications list
      401:
        description: Unauthorized
      403:
        description: Not agent or admin, or no support access
    """
    user, err = require_support_authenticated()
    if err:
        return err
    if user.support_role not in ('agent', 'admin'):
        return error_response('Forbidden', 'FORBIDDEN', 403)
    items = (
        InAppNotification.query.filter_by(user_id=user.id)
        .order_by(InAppNotification.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify(
        {
            'status': 'ok',
            'notifications': [
                {
                    'id': n.id,
                    'title': n.title,
                    'message': n.message,
                    'is_read': n.is_read,
                    'ticket_id': n.ticket_id,
                    'created_at': n.created_at.isoformat() if n.created_at else None,
                }
                for n in items
            ],
        }
    )


@user_bp.route('/profile/support-notifications/<int:nid>/read', methods=['PUT'])
@jwt_required()
def mark_support_notification_read(nid: int):
    """
    Mark a support in-app notification as read.
    ---
    tags:
      - SupportProfile
    security:
      - Bearer: []
    parameters:
      - in: path
        name: nid
        type: integer
        required: true
    responses:
      200:
        description: OK
      401:
        description: Unauthorized
      404:
        description: Notification not found
    """
    user, err = require_support_authenticated()
    if err:
        return err
    n = db.session.get(InAppNotification, nid)
    if not n or n.user_id != user.id:
        return error_response('Not found', 'NOT_FOUND', 404)
    n.is_read = True
    db.session.commit()
    return jsonify({'status': 'ok'})


@user_bp.route('/profile/support-notification-preferences', methods=['PUT'])
@jwt_required()
def update_support_notification_preferences():
    """
    Update email/in-app notification preferences for support.
    ---
    tags:
      - SupportProfile
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            email_ticket_created:
              type: boolean
            email_ticket_assigned:
              type: boolean
            email_status_changed:
              type: boolean
            email_new_comment:
              type: boolean
            email_sla:
              type: boolean
            in_app_enabled:
              type: boolean
    responses:
      200:
        description: OK
      400:
        description: Validation error
      401:
        description: Unauthorized
    """
    user, err = require_support_authenticated()
    if err:
        return err
    try:
        payload = NotificationPreferencesSchema().load(request.get_json() or {})
    except ValidationError as ve:
        return validation_error(ve.messages)
    pref = UserNotificationPreference.query.filter_by(user_id=user.id).first()
    if not pref:
        pref = UserNotificationPreference(user_id=user.id)
        db.session.add(pref)
    for key in (
        'email_ticket_created',
        'email_ticket_assigned',
        'email_status_changed',
        'email_new_comment',
        'email_sla',
        'in_app_enabled',
    ):
        if key in payload and payload[key] is not None:
            setattr(pref, key, payload[key])
    db.session.commit()
    return jsonify({'status': 'ok'})
