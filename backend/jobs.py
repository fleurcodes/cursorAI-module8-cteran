"""Background jobs for task-related cache maintenance and metrics."""

from __future__ import annotations

from sqlalchemy.orm import joinedload

from celery_app import celery
from extensions import cache, db
from models import Project, Task
from schemas import TaskSchema
from services.task_cache import (
    project_tasks_list_cache_key,
    set_project_tasks_list_cache,
)


@celery.task(name='tasks.warm_project_tasks_list_cache')
def warm_project_tasks_list_cache(project_id: int) -> int:
    """
    Rebuild the cached task list for a project (used after writes to pre-warm Redis).
    Returns the number of tasks cached.
    """
    project = Project.query.get(project_id)
    if not project:
        cache.delete(project_tasks_list_cache_key(project_id))
        return 0

    tasks = (
        Task.query.filter_by(project_id=project_id)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .order_by(Task.id.asc())
        .all()
    )
    payload = {'tasks': TaskSchema(many=True).dump(tasks)}
    set_project_tasks_list_cache(project_id, payload)
    return len(tasks)


@celery.task(name='tasks.recompute_project_metrics')
def recompute_project_metrics(project_id: int) -> dict:
    """
    Recompute persisted project counters from tasks (idempotent safety net after bulk changes).
    """
    project = Project.query.options(joinedload(Project.tasks)).get(project_id)
    if not project:
        return {'ok': False, 'reason': 'missing_project'}

    project.recalculate_metrics()
    db.session.commit()
    return {
        'ok': True,
        'project_id': project_id,
        'total_tasks': project.total_tasks,
        'progress': project.progress,
    }
