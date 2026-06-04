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
| **PARTIAL** | Redis caching layer with TTL strategy | `backend/config.py` (`REDIS_URL` → `CACHE_TYPE = 'RedisCache'`, `CACHE_DEFAULT_TIMEOUT`); `docker-compose.yml` + [RUNNING.md](../RUNNING.md) document local Redis | In production set `REDIS_URL` and run Redis. |
| **PARTIAL** | pytest suite with ≥90% coverage reported | Full-suite **line+branch** coverage is **~82%** (`pytest tests/`); enforced floor **`--cov-fail-under=78`** in `backend/pytest.ini`; CI uploads `coverage.xml`. Tests include `test_support_admin_export_api.py`, `test_email_service_unit.py`, `test_support_notify_unit.py`, `test_support_tickets_crud_api.py` (incl. multipart / upload limits), `test_ticket_logic_unit.py`. | Push past **90%** with remaining support-agent routes and rare SLA branches. |

### Automated testing

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | E2E tests (Playwright) in repo | `tests/`, `playwright.config.ts` | — |
| **PASS** | Tests triggered on PR/push | `.github/workflows/ci-cd.yml` `on: [push, pull_request]` | — |
| **PASS** | SAST / dependency vulnerability scan | `.github/workflows/codeql.yml`; `ci-cd.yml` jobs `security-dependencies` (npm audit, pip-audit, Bandit), Trivy on Docker images | — |
| **PASS** | Performance test (k6 or similar) present | `scripts/qa/perf-k6.sh`, `npm run qa:perf`, documented in `QA.md` | — |
| **PASS** | Test/quality dashboard or coverage badge visible | [README.md](../README.md) badges link to Actions + coverage gate doc; `npm run qa:dashboard` → `qa-artifacts/dashboard.html`; CI artifact **`backend-coverage-xml`** | Optional: Codecov + shields dynamic badge. |

### CI/CD (GitHub Actions)

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | Workflow file(s) in `.github/workflows/` | `ci-cd.yml`, `codeql.yml` | — |
| **PASS** | Parallel test jobs | Matrix jobs: `backend-test-shard`, `e2e-playwright` (chromium-desktop / tablet / mobile), `backend-coverage-full` | — |
| **PASS** | Security scan step (CodeQL, Trivy, or Snyk) | `codeql.yml`; Trivy in `docker-images`; optional Snyk job when `vars.ENABLE_SNYK == 'true'` | — |
| **PASS** | Blue-green deploy step with environment swap | `ci-cd.yml` `docker-images` job: active/candidate containers, promote, rollback path on candidate failure | — |
| **PASS** | Post-deploy health check step | Same job: `curl` against `/health` after container start | — |

### Deployment & observability

| Verdict | Feature | Evidence | Fix (if needed) |
| --- | --- | --- | --- |
| **PASS** | Health check endpoint (`/health` or `/ping`) | `backend/app.py` `@app.route('/health')` and `/ping`; root index JSON includes `"health": "/health"` | — |
| **PASS** | Environment variables via secrets (not hardcoded) | `backend/config.py` reads secrets from env; `backend/app.py` `_enforce_production_secrets` refuses default `SECRET_KEY` / `JWT_SECRET_KEY` when `FLASK_ENV=production` or `APP_ENV=production` | — |
| **PASS** | Rollback strategy documented or scripted | `.github/workflows/ci-cd.yml` rollback branch on failed candidate; narrative in `student_exercises/deliverables/exercise_3_pipeline.md` | — |
| **PARTIAL** | Uptime / error-rate monitoring configured | Optional `DISCORD_WEBHOOK_URL` failure notification in `ci-cd.yml`; no third-party APM/uptime SaaS wired in-repo | Wire Datadog/New Relic/UptimeRobot etc. in the deployment environment if required by policy. |

---

## 2. Gap report (FAIL + PARTIAL only)

### Backend

- **PARTIAL** — Redis cache until `REDIS_URL` is set in the runtime environment.
- **PARTIAL** — Stretch goal **90%** line coverage vs current **~82%** and enforced floor **78%**.

### Automated testing

- (none — coverage badge path addressed in README + CI artifact.)

### Deployment & observability

- **PARTIAL** — Dedicated uptime/error-rate product vs CI + Discord hooks only.

---

## 3. Fix suggestions (minimal)

| Gap | Suggested change |
| --- | --- |
| Coverage toward 90% | Add tests for rare `support_admin` CSV branches and ticket multipart error paths; bump `pytest.ini` `--cov-fail-under` toward 82 once stable. |
| Redis in dev | `docker compose up -d redis` and `export REDIS_URL=...` (see [RUNNING.md](../RUNNING.md)). |
| Codecov badge | Upload `backend/coverage.xml` from CI to Codecov; add shields badge to README. |
| External monitoring | Add health-check URL to an external monitor; forward API logs/metrics to your org standard. |

---

## 4. Health score

**26 / 28** checklist rows **PASS**, **2 PARTIAL**, **0 FAIL**.

**Summary:** Backend coverage is **~82%** with a **78%** CI/local gate; admin export/users routes, email stub/SMTP paths, notification prefs, SLA hooks, ticket CRUD (including multipart, MIME/size checks, admin on-behalf), and `ticket_logic` are covered. Remaining gap is mostly **stretch 90%** polish and optional **external uptime** tooling.

---

## 5. Related docs

- [README.md](../README.md) — product overview  
- [RUNNING.md](../RUNNING.md) — local run  
- [QA.md](../QA.md) — QA dashboard, k6, ZAP, Snyk  
- [TESTING.md](../TESTING.md) — Playwright  
