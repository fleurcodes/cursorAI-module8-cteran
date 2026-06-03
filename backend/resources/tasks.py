from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from sqlalchemy.orm import joinedload

from extensions import db, socketio
from jobs import recompute_project_metrics, warm_project_tasks_list_cache
from models import User, Project, Task, ProjectMember
from schemas import TaskSchema, TaskCreateSchema, TaskUpdateSchema
from services.task_cache import (
    get_project_tasks_list_cache,
    get_task_detail_cache,
    invalidate_task_and_project_caches,
    set_project_tasks_list_cache,
    set_task_detail_cache,
)

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api')


def get_current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def authorize_project(project, user):
    return ProjectMember.query.filter_by(project_id=project.id, user_id=user.id).first() is not None


def _schedule_task_side_effects(project_id: int, enqueue_metrics: bool = False) -> None:
    from flask import current_app, has_request_context

    eager = bool(has_request_context() and current_app.config.get('CELERY_TASK_ALWAYS_EAGER'))
    if eager:
        warm_project_tasks_list_cache.apply(args=[project_id])
        if enqueue_metrics:
            recompute_project_metrics.apply(args=[project_id])
        return

    warm_project_tasks_list_cache.delay(project_id)
    if enqueue_metrics:
        recompute_project_metrics.delay(project_id)


@tasks_bp.route('/projects/<int:project_id>/tasks', methods=['GET'])
@jwt_required()
def list_tasks(project_id):
    """
    List tasks for a project.
    ---
    tags:
      - Tasks
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        type: integer
        required: true
    responses:
      200:
        description: Tasks array
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

    cached = get_project_tasks_list_cache(project_id)
    if cached is not None:
        return jsonify(cached), 200

    tasks = (
        Task.query.filter_by(project_id=project_id)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .order_by(Task.id.asc())
        .all()
    )
    payload = {'tasks': TaskSchema(many=True).dump(tasks)}
    set_project_tasks_list_cache(project_id, payload)
    return jsonify(payload), 200


@tasks_bp.route('/tasks/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task(task_id):
    """
    Get a single task by id.
    ---
    tags:
      - Tasks
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
    responses:
      200:
        description: Task detail
      401:
        description: Unauthorized
      403:
        description: Not allowed for task project
      404:
        description: Task not found
    """
    user = get_current_user()
    cached = get_task_detail_cache(task_id)
    if cached is not None:
        task_stub = Task.query.get(task_id)
        if not task_stub:
            return jsonify({'message': 'Task not found'}), 404
        if not authorize_project(task_stub.project, user):
            return jsonify({'message': 'Unauthorized access'}), 403
        return jsonify(cached), 200

    task = (
        Task.query.options(
            joinedload(Task.assignee),
            joinedload(Task.creator),
            joinedload(Task.project),
        ).get(task_id)
    )

    if not task:
        return jsonify({'message': 'Task not found'}), 404
    if not authorize_project(task.project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    payload = {'task': TaskSchema().dump(task)}
    set_task_detail_cache(task_id, payload)
    return jsonify(payload), 200


@tasks_bp.route('/projects/<int:project_id>/tasks', methods=['POST'])
@jwt_required()
def create_task(project_id):
    """
    Create a task in a project.
    ---
    tags:
      - Tasks
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
            - title
          properties:
            title:
              type: string
            description:
              type: string
            assignee_id:
              type: integer
            priority:
              type: string
              enum: [low, medium, high]
            due_date:
              type: string
              format: date
    responses:
      201:
        description: Task created
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Project or assignee not found
    """
    user = get_current_user()
    project = Project.query.get(project_id)

    if not project:
        return jsonify({'message': 'Project not found'}), 404
    if not authorize_project(project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    try:
        payload = TaskCreateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    assignee = None
    if payload.get('assignee_id'):
        assignee = User.query.get(payload['assignee_id'])
        if not assignee:
            return jsonify({'message': 'Assignee not found'}), 404
        if not authorize_project(project, assignee):
            membership = ProjectMember(project_id=project.id, user_id=assignee.id, role='contributor')
            db.session.add(membership)

    task = Task(
        title=payload['title'],
        description=payload.get('description'),
        status='todo',
        priority=payload.get('priority', 'medium'),
        due_date=payload.get('due_date'),
        project_id=project.id,
        assignee_id=assignee.id if assignee else None,
        creator_id=user.id,
    )

    db.session.add(task)
    # Flush so the new row exists before metrics run; otherwise len(project.tasks) can miss it.
    db.session.flush()
    project.recalculate_metrics()
    db.session.commit()

    invalidate_task_and_project_caches(project.id)
    _schedule_task_side_effects(project.id, enqueue_metrics=True)

    if assignee:
        socketio.emit('task.assigned', TaskSchema().dump(task), room=f'user_{assignee.id}')

    return jsonify({'task': TaskSchema().dump(task), 'message': 'Task created.'}), 201


@tasks_bp.route('/tasks/<int:task_id>', methods=['PATCH'])
@jwt_required()
def update_task(task_id):
    """
    Update a task (partial).
    ---
    tags:
      - Tasks
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            title:
              type: string
            description:
              type: string
            status:
              type: string
              enum: [todo, in-progress, completed, blocked]
            priority:
              type: string
              enum: [low, medium, high]
            assignee_id:
              type: integer
            due_date:
              type: string
              format: date
    responses:
      200:
        description: Updated task
      400:
        description: Validation error
      401:
        description: Unauthorized
      403:
        description: Not a member
      404:
        description: Task or assignee not found
    """
    user = get_current_user()
    task = Task.query.get(task_id)

    if not task:
        return jsonify({'message': 'Task not found'}), 404
    if not authorize_project(task.project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    try:
        payload = TaskUpdateSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    if payload.get('assignee_id'):
        assignee = User.query.get(payload['assignee_id'])
        if not assignee:
            return jsonify({'message': 'Assignee not found'}), 404
        task.assignee_id = assignee.id
        if not authorize_project(task.project, assignee):
            db.session.add(ProjectMember(project_id=task.project_id, user_id=assignee.id, role='contributor'))

    for key in ['title', 'description', 'status', 'priority', 'due_date']:
        if key in payload:
            setattr(task, key, payload[key])

    task.project.recalculate_metrics()
    db.session.commit()

    invalidate_task_and_project_caches(task.project_id, task_id)
    _schedule_task_side_effects(task.project_id, enqueue_metrics=True)

    if payload.get('status') == 'completed' and task.assignee_id:
        socketio.emit('task.completed', TaskSchema().dump(task), room=f'user_{task.assignee_id}')

    return jsonify({'task': TaskSchema().dump(task), 'message': 'Task updated.'}), 200


@tasks_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    """
    Delete a task.
    ---
    tags:
      - Tasks
    security:
      - Bearer: []
    parameters:
      - in: path
        name: task_id
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
        description: Task not found
    """
    user = get_current_user()
    task = Task.query.get(task_id)

    if not task:
        return jsonify({'message': 'Task not found'}), 404
    if not authorize_project(task.project, user):
        return jsonify({'message': 'Unauthorized access'}), 403

    project = task.project
    pid = project.id
    db.session.delete(task)
    db.session.flush()
    project.recalculate_metrics()
    db.session.commit()
    invalidate_task_and_project_caches(pid, task_id)
    _schedule_task_side_effects(pid, enqueue_metrics=True)
    return jsonify({'message': 'Task deleted.'}), 200
