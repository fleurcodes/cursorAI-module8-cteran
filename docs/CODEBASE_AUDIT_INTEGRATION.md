# Codebase audit — React + Flask + GitHub

This document implements the checklist from the module **integration / full-stack audit** prompt: each row is `[PASS | PARTIAL | FAIL]` with evidence and fixes where relevant. Last reviewed against the repository layout in **June 2026**.

---

## 1. Checklist table

### Frontend (React)

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | React + TypeScript + Tailwind CSS | `package.json` (react, typescript, tailwindcss, vite), `src/**/*.tsx`, `src/index.css` `@import "tailwindcss"` | — |
| **PASS** | Component architecture | `src/components/`, `src/pages/`, shared contexts `src/contexts/` | — |
| **PASS** | User registration with client-side validation | `src/pages/RegistrationPage.tsx`, `src/components/registration/Step1AccountInfo.tsx`, `Step2ProfileDetails.tsx` | — |
| **PASS** | Login flow with JWT storage and refresh handling | `src/services/authService.ts` (`persistSession`, `refreshAccessToken`, `authorizedFetch`), `POST /api/refresh` in `backend/resources/auth.py` | — |
| **PASS** | Protected dashboard with task CRUD | `src/pages/TeamDashboard.tsx`, `src/services/teamDashboardApi.ts` (`createTask`, `updateTask`, …), `backend/resources/tasks.py` | — |
| **PASS** | Dark mode toggle (persisted across sessions) | `src/components/shared/DarkModeToggle.tsx` (`localStorage` key `theme`), `src/main.tsx` bootstraps `document.documentElement` class before paint | — |
| **PASS** | Responsive breakpoints (mobile / tablet / desktop) | Tailwind responsive classes (`sm:`, `lg:`, etc.) across pages; Playwright projects in `playwright.config.ts` (`chromium-desktop`, `tablet`, `mobile`) | — |
| **PASS** | Playwright E2E tests | `tests/*.spec.ts`, `package.json` `"test": "playwright test"` | — |

### Backend (Flask)

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | Request/response logging middleware | `backend/middleware/request_logging.py` (`init_request_logging`), wired in `backend/app.py` | — |
| **PASS** | Real-time DB writes verified (not only seeded fixtures) | `backend/tests/test_tasks_api.py`, `test_auth.py`, `conftest.py` (`register_user`, `create_project`) create rows via API + SQLAlchemy | — |
| **PASS** | Background task queue (Celery worker + broker config) | `backend/celery_app.py`, `backend/jobs.py`, `backend/config.py` (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`) | — |
| **PARTIAL** | Redis caching layer with TTL strategy | `backend/config.py` (`REDIS_URL` → `CACHE_TYPE = 'RedisCache'`, `CACHE_DEFAULT_TIMEOUT`); falls back to `SimpleCache` when `REDIS_URL` unset | In production set `REDIS_URL` and run Redis so the cache backend is not in-memory only. |
| **FAIL** | pytest suite with ≥90% coverage reported | `backend/pytest.ini` sets `--cov-fail-under=90`, but aggregate line coverage for the app package is **well below 90%** when a full `--cov=.` run is executed; CI shards in `.github/workflows/ci-cd.yml` run subsets so the gate is bypassed via `tests/conftest.py` | Add focused tests for under-covered blueprints **or** lower the gate to a measured target **or** add a single CI job that runs the full suite with coverage and fails the workflow on `<90%`. |

### Automated testing

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | E2E tests (Playwright) in repo | `tests/`, `playwright.config.ts` | — |
| **PASS** | Tests triggered on PR/push | `.github/workflows/ci-cd.yml` `on: [push, pull_request]` | — |
| **PASS** | SAST / dependency vulnerability scan | `.github/workflows/codeql.yml`; `ci-cd.yml` jobs `security-dependencies` (npm audit, pip-audit, Bandit), Trivy on Docker images | — |
| **PASS** | Performance test (k6 or similar) present | `scripts/qa/perf-k6.sh`, `npm run qa:perf`, documented in `QA.md` | — |
| **PARTIAL** | Test/quality dashboard or coverage badge visible | `npm run qa:dashboard` → `qa-artifacts/dashboard.html` per `QA.md`; README has no embeddable coverage **badge** | Add a shields.io / Codecov badge once a workflow uploads a stable coverage artifact to a public URL. |

### CI/CD (GitHub Actions)

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | Workflow file(s) in `.github/workflows/` | `ci-cd.yml`, `codeql.yml` | — |
| **PASS** | Parallel test jobs | Matrix jobs: `backend-test-shard`, `e2e-playwright` (chromium-desktop / tablet / mobile) | — |
| **PASS** | Security scan step (CodeQL, Trivy, or Snyk) | `codeql.yml`; Trivy in `docker-images`; optional Snyk job when `vars.ENABLE_SNYK == 'true'` | — |
| **PASS** | Blue-green deploy step with environment swap | `ci-cd.yml` `docker-images` job: active/candidate containers, promote, rollback path on candidate failure | — |
| **PASS** | Post-deploy health check step | Same job: `curl` against `/health` after container start (updated from `/` to dedicated probe) | — |

### Deployment & observability

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | Health check endpoint (`/health` or `/ping`) | `backend/app.py` `@app.route('/health')` and `/ping` | — |
| **PARTIAL** | Environment variables via secrets (not hardcoded) | `backend/config.py` reads `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, etc. from env, but ships **dev defaults** (`change-me-*`) | Document required secrets for production; fail fast in prod if defaults detected (optional guard). |
| **PASS** | Rollback strategy documented or scripted | `.github/workflows/ci-cd.yml` rollback branch on failed candidate; narrative in `student_exercises/deliverables/exercise_3_pipeline.md` | — |
| **PARTIAL** | Uptime / error-rate monitoring configured | Optional `DISCORD_WEBHOOK_URL` failure notification in `ci-cd.yml`; no third-party APM/uptime SaaS wired in-repo | Wire Datadog/New Relic/UptimeRobot etc. in the deployment environment if required by policy. |

---

## 2. Gap report (FAIL + PARTIAL only)

### Backend

- **FAIL** — pytest ≥90% coverage (aggregate vs gate).
- **PARTIAL** — Redis cache until `REDIS_URL` is set in the runtime environment.

### Automated testing

- **PARTIAL** — Public coverage badge / always-on dashboard URL (local `qa-artifacts/` is generated on demand).

### Deployment & observability

- **PARTIAL** — Production-grade secret hygiene (no default keys in prod).
- **PARTIAL** — Dedicated uptime/error-rate product vs CI + Discord hooks only.

---

## 3. Fix suggestions (minimal)

| Gap | Suggested change |
| --- | --- |
| Coverage &lt; 90% | Extend `backend/tests/` for `resources/support_*.py` and low-covered services, **or** adjust `pytest.ini` / CI to a realistic `--cov-fail-under` once targets are agreed. |
| Redis in dev | `docker run redis` + `export REDIS_URL=redis://localhost:6379/0` (see `config.py`). |
| Coverage badge | Publish coverage XML from a dedicated GitHub Actions job and link a shields.io badge in `README.md`. |
| Prod secrets | Require `SECRET_KEY` / `JWT_SECRET_KEY` without insecure defaults when `FLASK_ENV=production` (small check in `create_app`). |
| External monitoring | Add health-check URL to an external monitor; forward API logs/metrics to your org standard. |

---

## 4. Health score

**22 / 28** checklist rows **PASS**, **5 PARTIAL**, **1 FAIL**.

**Summary:** The stack matches the intended React + Flask + Actions architecture (auth with refresh, E2E, security scans, blue/green simulation, health routes, Celery, optional Redis). The main quantitative gap is **backend line coverage vs the 90% gate** while the application surface (especially support routes) remains under-tested in coverage terms.

---

## 5. Related docs

- [README.md](../README.md) — product overview  
- [RUNNING.md](../RUNNING.md) — local run  
- [QA.md](../QA.md) — QA dashboard, k6, ZAP, Snyk  
- [TESTING.md](../TESTING.md) — Playwright  
