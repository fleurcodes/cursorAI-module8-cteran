"""Tests for task CRUD, caching, and Celery side-effects."""

from __future__ import annotations

import pytest

from extensions import cache
from jobs import recompute_project_metrics, warm_project_tasks_list_cache
from services import task_cache as tc
from tests.conftest import register_user


@pytest.fixture(autouse=True)
def clear_simple_cache():
    cache.clear()


def test_list_tasks_forbidden_for_non_member(task_api_context):
    c = task_api_context['client']
    r = c.get(
        f"/api/projects/{task_api_context['project_id']}/tasks",
        headers={'Authorization': f"Bearer {task_api_context['other_token']}"},
    )
    assert r.status_code == 403


def test_list_tasks_project_not_found(task_api_context):
    c = task_api_context['client']
    tok = task_api_context['owner_token']
    r = c.get('/api/projects/99999/tasks', headers={'Authorization': f'Bearer {tok}'})
    assert r.status_code == 404


def test_list_tasks_populates_cache(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    key = tc.project_tasks_list_cache_key(pid)

    r1 = c.get(f'/api/projects/{pid}/tasks', headers={'Authorization': f'Bearer {tok}'})
    assert r1.status_code == 200
    assert cache.get(key) is not None

    r2 = c.get(f'/api/projects/{pid}/tasks', headers={'Authorization': f'Bearer {tok}'})
    assert r2.status_code == 200
    assert r2.get_json() == r1.get_json()


def test_create_update_delete_task_and_cache_invalidation(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    hdr = {'Authorization': f'Bearer {tok}'}
    list_key = tc.project_tasks_list_cache_key(pid)

    c.get(f'/api/projects/{pid}/tasks', headers=hdr)
    assert cache.get(list_key) is not None

    r_create = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'First actionable task', 'priority': 'high'},
        headers=hdr,
    )
    assert r_create.status_code == 201, r_create.get_json()
    tid = r_create.get_json()['task']['id']
    # Eager Celery re-warms list cache after invalidation
    assert cache.get(list_key) is not None

    r_list = c.get(f'/api/projects/{pid}/tasks', headers=hdr)
    titles = [t['title'] for t in r_list.get_json()['tasks']]
    assert 'First actionable task' in titles

    detail_key = tc.task_detail_cache_key(tid)
    r_get = c.get(f'/api/tasks/{tid}', headers=hdr)
    assert r_get.status_code == 200
    assert cache.get(detail_key) is not None

    r_patch = c.patch(
        f'/api/tasks/{tid}',
        json={'status': 'completed'},
        headers=hdr,
    )
    assert r_patch.status_code == 200, r_patch.get_json()
    assert cache.get(detail_key) is None

    r_del = c.delete(f'/api/tasks/{tid}', headers=hdr)
    assert r_del.status_code == 200


def test_create_task_validation_error(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    r = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'ab'},
        headers={'Authorization': f'Bearer {tok}'},
    )
    assert r.status_code == 400


def test_create_task_assignee_auto_adds_membership(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    owner = task_api_context['owner_token']
    _tok_other, other_id = register_user(c, 'assignee-only@example.com')
    r = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Delegated work item', 'assignee_id': other_id},
        headers={'Authorization': f'Bearer {owner}'},
    )
    assert r.status_code == 201, r.get_json()


def test_get_task_not_found(task_api_context):
    c = task_api_context['client']
    tok = task_api_context['owner_token']
    r = c.get('/api/tasks/999999', headers={'Authorization': f'Bearer {tok}'})
    assert r.status_code == 404


def test_get_task_cached_authorization(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    hdr = {'Authorization': f'Bearer {tok}'}
    r_create = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Cache auth check task'},
        headers=hdr,
    )
    tid = r_create.get_json()['task']['id']
    c.get(f'/api/tasks/{tid}', headers=hdr)
    r_peer = c.get(f'/api/tasks/{tid}', headers={'Authorization': f"Bearer {task_api_context['other_token']}"})
    assert r_peer.status_code == 403


def test_patch_task_assignee_not_found(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    hdr = {'Authorization': f'Bearer {tok}'}
    r_create = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Patch assignee probe'},
        headers=hdr,
    )
    tid = r_create.get_json()['task']['id']
    r = c.patch(f'/api/tasks/{tid}', json={'assignee_id': 999999}, headers=hdr)
    assert r.status_code == 404


def test_patch_task_invalid_status(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    hdr = {'Authorization': f'Bearer {tok}'}
    r_create = c.post(
        f'/api/projects/{pid}/tasks',
        json={'title': 'Invalid status probe'},
        headers=hdr,
    )
    tid = r_create.get_json()['task']['id']
    r = c.patch(f'/api/tasks/{tid}', json={'status': 'not-a-real-status'}, headers=hdr)
    assert r.status_code == 400


def test_celery_warm_and_recompute_jobs(task_api_context):
    c = task_api_context['client']
    pid = task_api_context['project_id']
    tok = task_api_context['owner_token']
    hdr = {'Authorization': f'Bearer {tok}'}
    c.post(f'/api/projects/{pid}/tasks', json={'title': 'Celery metrics task'}, headers=hdr)

    assert warm_project_tasks_list_cache.apply(args=[pid]).result >= 1
    body = recompute_project_metrics.apply(args=[pid]).result
    assert body['ok'] is True
    assert body['total_tasks'] >= 1

    assert warm_project_tasks_list_cache.apply(args=[999_999]).result == 0
    missing = recompute_project_metrics.apply(args=[999_999]).result
    assert missing['ok'] is False
