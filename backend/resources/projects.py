from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError

from extensions import db, socketio
from models import User, Project, ProjectMember
from schemas import (
    ProjectSchema,
    ProjectCreateSchema,
    ProjectUpdateSchema,
    ProjectMemberSchema,
    ProjectMemberCreateSchema,
)

projects_bp = Blueprint('projects', __name__, url_prefix='/api')


def get_current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def authorize_project(project, user):
    if not project:
        return False
    return ProjectMember.query.filter_by(project_id=project.id, user_id=user.id).first() is not None


@projects_bp.route('/projects', methods=['GET'])
@jwt_required()
def list_projects():
    """
    List projects for the current user.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    responses:
      200:
        description: Projects array
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


@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """
    Get a single project by id (must be a member).
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
    responses:
      200:
        description: Project detail
      401:
        description: Unauthorized
      403:
        description: Not a project member
      404:
        description: Project not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    return jsonify({'project': ProjectSchema().dump(project)}), 200


@projects_bp.route('/projects', methods=['POST'])
@jwt_required()
def create_project():
    """
    Create a project and optional initial members.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
            description:
              type: string
            status:
              type: string
              enum: [on-track, at-risk, delayed]
            start_date:
              type: string
              format: date
            end_date:
              type: string
              format: date
            member_ids:
              type: array
              items:
                type: integer
    responses:
      201:
        description: Project created
      400:
        description: Validation error
      401:
        description: Unauthorized
    """
    user = get_current_user()
    try:
        payload = ProjectCreateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    project = Project(
        name=payload['name'],
        description=payload.get('description'),
        status=payload.get('status', 'on-track'),
        start_date=payload.get('start_date'),
        end_date=payload.get('end_date'),
    )

    db.session.add(project)
    db.session.flush()

    member_ids = set(payload.get('member_ids', []))
    member_ids.add(user.id)

    for member_id in member_ids:
        member = User.query.get(member_id)
        if not member:
            continue
        role = 'manager' if member_id == user.id else 'contributor'
        db.session.add(
            ProjectMember(project_id=project.id, user_id=member.id, role=role),
        )

    db.session.commit()

    socketio.emit('project.created', ProjectSchema().dump(project), room=f'user_{user.id}')
    return jsonify({'project': ProjectSchema().dump(project), 'message': 'Project created.'}), 201


@projects_bp.route('/projects/<int:project_id>', methods=['PATCH'])
@jwt_required()
def update_project(project_id):
    """
    Partially update a project.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
            description:
              type: string
            status:
              type: string
              enum: [on-track, at-risk, delayed]
            start_date:
              type: string
              format: date
            end_date:
              type: string
              format: date
    responses:
      200:
        description: Updated project
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    try:
        payload = ProjectUpdateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    for key, value in payload.items():
        setattr(project, key, value)

    db.session.commit()
    return jsonify({'project': ProjectSchema().dump(project), 'message': 'Project updated.'}), 200


@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    """
    Delete a project (member only).
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
    responses:
      200:
        description: Deleted
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted.'}), 200


@projects_bp.route('/projects/<int:project_id>/members', methods=['GET'])
@jwt_required()
def list_project_members(project_id):
    """
    List members of a project.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
    responses:
      200:
        description: Members array
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    memberships = [ProjectMemberSchema().dump(m) for m in project.memberships]
    return jsonify({'members': memberships}), 200


@projects_bp.route('/projects/<int:project_id>/members', methods=['POST'])
@jwt_required()
def add_project_member(project_id):
    """
    Add a user to a project.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - user_id
          properties:
            user_id:
              type: integer
            role:
              type: string
              enum: [manager, developer, designer, qa, admin]
    responses:
      201:
        description: Member added
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project or user not found
      409:
        description: Member already exists
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    try:
        payload = ProjectMemberCreateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    member = User.query.get(payload['user_id'])
    if not member:
        return jsonify({'message': 'User not found'}), 404

    if ProjectMember.query.filter_by(project_id=project.id, user_id=member.id).first():
        return jsonify({'message': 'Member already exists on this project'}), 409

    membership = ProjectMember(
        project_id=project.id,
        user_id=member.id,
        role=payload.get('role', 'contributor'),
    )
    db.session.add(membership)
    db.session.commit()

    socketio.emit(
        'project.member_added',
        {'project_id': project.id, 'user_id': member.id, 'role': membership.role},
        room=f'user_{member.id}',
    )
    return jsonify({'member': ProjectMemberSchema().dump(membership), 'message': 'Member added.'}), 201


@projects_bp.route('/projects/<int:project_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_project_member(project_id, user_id):
    """
    Remove a member from a project.
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
      - in: path
        name: user_id
        type: integer
        required: true
    responses:
      200:
        description: Member removed
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project or membership not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    membership = ProjectMember.query.filter_by(project_id=project.id, user_id=user_id).first()
    if not membership:
        return jsonify({'message': 'Member not found'}), 404

    db.session.delete(membership)
    db.session.commit()
    return jsonify({'message': 'Member removed.'}), 200
