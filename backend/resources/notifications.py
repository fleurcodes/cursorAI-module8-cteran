from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_socketio import emit, join_room
from marshmallow import ValidationError

from extensions import db, socketio
from models import Notification, User, Project
from schemas import NotificationSchema, NotificationCreateSchema

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api')


def get_current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


@notifications_bp.route('/notifications', methods=['GET'])
@jwt_required()
def list_notifications():
    """
    List in-app notifications for the current user.
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    responses:
      200:
        description: Notifications array
      401:
        description: Unauthorized
      404:
        description: User not found
    """
    user = get_current_user()
    if not user:
        return jsonify({'message': 'User not found'}), 404

    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
    return jsonify({'notifications': NotificationSchema(many=True).dump(notifications)}), 200


@notifications_bp.route('/notifications/send', methods=['POST'])
@jwt_required()
def send_notification():
    """
    Create and dispatch a notification to another user (and optional Socket.IO rooms).
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - user_id
            - title
            - message
          properties:
            user_id:
              type: integer
            project_id:
              type: integer
            title:
              type: string
            message:
              type: string
            level:
              type: string
              enum: [info, warning, success, error]
    responses:
      201:
        description: Notification created
      400:
        description: Validation error
      401:
        description: Unauthorized
      404:
        description: Recipient or project not found
    """
    sender = get_current_user()
    try:
        payload = NotificationCreateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    recipient = User.query.get(payload['user_id'])
    if not recipient:
        return jsonify({'message': 'Recipient not found'}), 404

    project = None
    if payload.get('project_id'):
        project = Project.query.get(payload['project_id'])
        if not project:
            return jsonify({'message': 'Project not found'}), 404

    notification = Notification(
        user_id=recipient.id,
        sender_id=sender.id,
        project_id=project.id if project else None,
        title=payload['title'],
        message=payload['message'],
        level=payload.get('level', 'info'),
    )

    db.session.add(notification)
    db.session.commit()

    payload = NotificationSchema().dump(notification)
    socketio.emit('notification', payload, room=f'user_{recipient.id}')
    if project:
        socketio.emit('project.notification', payload, room=f'project_{project.id}')

    return jsonify({'notification': payload, 'message': 'Notification dispatched.'}), 201


@notifications_bp.route('/notifications/<int:notification_id>/read', methods=['PATCH'])
@jwt_required()
def mark_notification_read(notification_id):
    """
    Mark a notification as read (owner only).
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    parameters:
      - in: path
        name: notification_id
        type: integer
        required: true
    responses:
      200:
        description: Updated notification
      401:
        description: Unauthorized
      404:
        description: Notification not found
    """
    user = get_current_user()
    notification = Notification.query.get(notification_id)

    if not notification or notification.user_id != user.id:
        return jsonify({'message': 'Notification not found'}), 404

    notification.is_read = True
    db.session.commit()
    return jsonify({'notification': NotificationSchema().dump(notification), 'message': 'Notification marked as read.'}), 200


@socketio.on('connect')
def handle_connect():
    try:
        verify_jwt_in_request(locations=['query_string'])
        user_id = int(get_jwt_identity())
    except Exception:
        return False

    if not user_id:
        return False

    join_room(f'user_{user_id}')
    emit('connected', {'message': 'Joined notification channel.'}, room=f'user_{user_id}')


@socketio.on('join_project')
def handle_join_project(data):
    try:
        verify_jwt_in_request(locations=['query_string'])
    except Exception:
        return False

    project_id = data.get('project_id') if isinstance(data, dict) else None
    if project_id:
        join_room(f'project_{project_id}')
        emit('project.joined', {'project_id': project_id}, room=f'project_{project_id}')
