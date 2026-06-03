"""Unit tests for task cache key helpers."""

from __future__ import annotations

import pytest

from extensions import cache
from services import task_cache as tc


@pytest.fixture(autouse=True)
def clear_simple_cache():
    cache.clear()


def test_cache_key_names_stable():
    assert tc.project_tasks_list_cache_key(5) == 'tasks:list:v1:5'
    assert tc.task_detail_cache_key(12) == 'tasks:detail:v1:12'


def test_invalidate_and_set_roundtrip():
    tc.set_project_tasks_list_cache(1, {'tasks': []})
    assert tc.get_project_tasks_list_cache(1) == {'tasks': []}
    tc.invalidate_project_tasks_cache(1)
    assert tc.get_project_tasks_list_cache(1) is None

    tc.set_task_detail_cache(2, {'task': {'id': 2}})
    assert tc.get_task_detail_cache(2) == {'task': {'id': 2}}
    tc.invalidate_task_detail_cache(2)
    assert tc.get_task_detail_cache(2) is None


def test_invalidate_task_and_project_caches():
    tc.set_project_tasks_list_cache(3, {'tasks': [{'id': 1}]})
    tc.set_task_detail_cache(10, {'task': {'id': 10}})
    tc.invalidate_task_and_project_caches(3, 10)
    assert tc.get_project_tasks_list_cache(3) is None
    assert tc.get_task_detail_cache(10) is None


def test_invalidate_task_and_project_caches_without_task_id():
    tc.set_project_tasks_list_cache(4, {'tasks': []})
    tc.invalidate_task_and_project_caches(4, None)
    assert tc.get_project_tasks_list_cache(4) is None
