"""Redis/SimpleCache keys and helpers for task list and detail payloads."""

from __future__ import annotations

from typing import Any

from extensions import cache


def project_tasks_list_cache_key(project_id: int) -> str:
    return f'tasks:list:v1:{project_id}'


def task_detail_cache_key(task_id: int) -> str:
    return f'tasks:detail:v1:{task_id}'


def invalidate_project_tasks_cache(project_id: int) -> None:
    cache.delete(project_tasks_list_cache_key(project_id))


def invalidate_task_detail_cache(task_id: int) -> None:
    cache.delete(task_detail_cache_key(task_id))


def invalidate_task_and_project_caches(project_id: int, task_id: int | None = None) -> None:
    invalidate_project_tasks_cache(project_id)
    if task_id is not None:
        invalidate_task_detail_cache(task_id)


def set_project_tasks_list_cache(project_id: int, payload: dict[str, Any]) -> None:
    cache.set(project_tasks_list_cache_key(project_id), payload)


def get_project_tasks_list_cache(project_id: int) -> dict[str, Any] | None:
    return cache.get(project_tasks_list_cache_key(project_id))


def get_task_detail_cache(task_id: int) -> dict[str, Any] | None:
    return cache.get(task_detail_cache_key(task_id))


def set_task_detail_cache(task_id: int, payload: dict[str, Any]) -> None:
    cache.set(task_detail_cache_key(task_id), payload)
