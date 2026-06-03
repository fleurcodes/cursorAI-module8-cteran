"""Lightweight performance checks: caching and response-time budgets."""

from __future__ import annotations

import time

from tests.conftest import auth_header, create_project, register_user


def test_task_list_cached_second_request_is_fast(client):
    tok, _ = register_user(client, 'perf-user@example.com')
    pid = create_project(client, tok, 'Perf Project')
    hdr = auth_header(tok)
    url = f'/api/projects/{pid}/tasks'

    client.get(url, headers=hdr)
    t0 = time.perf_counter()
    r = client.get(url, headers=hdr)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    assert r.status_code == 200
    assert elapsed_ms < 500.0, f'second GET took {elapsed_ms:.1f}ms (cache should be hot)'


def test_multiple_task_reads_stay_under_budget(client):
    tok, _ = register_user(client, 'perf-budget@example.com')
    pid = create_project(client, tok, 'Budget Project')
    hdr = auth_header(tok)
    url = f'/api/projects/{pid}/tasks'

    for _ in range(3):
        client.post(
            f'/api/projects/{pid}/tasks',
            json={'title': 'Task item for perf loop'},
            headers=hdr,
        )

    start = time.perf_counter()
    for _ in range(10):
        resp = client.get(url, headers=hdr)
        assert resp.status_code == 200
    total_ms = (time.perf_counter() - start) * 1000

    assert total_ms < 3000.0, f'10 list GETs took {total_ms:.1f}ms'
