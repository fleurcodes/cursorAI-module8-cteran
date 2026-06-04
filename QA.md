# QA automation suite (Exercise 4)

This repository includes a **full-stack QA automation** setup: Page Object Model (POM) for Playwright, ESLint complexity rules, Pylint for Python, optional **OWASP ZAP** and **Snyk**, **k6** performance smoke tests, a generated **HTML quality dashboard**, and a **master script** to run the main checks.

## Quality targets (tracked on the dashboard)

| Metric | Target |
| --- | --- |
| Backend test coverage (lines) | **80%+** |
| Cyclomatic complexity | **Under 10** (ESLint `complexity` warn; Pylint `max-complexity`) |
| Critical vulnerabilities (Snyk) | **0** |
| API p95 latency (k6) | **Under 500 ms** |
| HTTP error rate (k6) | **Under 1%** |

---

## Prerequisites

- **Node 20+** — `npm install`, `npx playwright install`
- **Python 3.11+** — backend virtualenv at `backend/.venv` (see [RUNNING.md](RUNNING.md))
- Optional: **Docker** (ZAP), **k6**, **Snyk CLI** (or `npx snyk`)

Install Python QA tools in the backend venv:

```bash
cd backend
./.venv/bin/pip install -r requirements-qa.txt
```

---

## Master script (recommended)

From the repository root:

```bash
npm run qa:all
# or
bash scripts/qa/run-all.sh
```

This will:

1. Run **ESLint** (stylish + JSON to `qa-artifacts/eslint.json`)
2. Run **Pylint** on all `*.py` outside `.venv` → `qa-artifacts/pylint.json`
3. Run **pytest** with coverage → `qa-artifacts/backend-coverage.json`
4. Run **Playwright** E2E (with JSON summary → `qa-artifacts/playwright-results.json`)
5. Run **k6** if `k6` is installed **and** `curl` can reach `BASE_URL` (default `http://127.0.0.1:5000`); otherwise skipped. Use `SKIP_K6=1` to force skip.
6. Run **Snyk** when `SNYK_TOKEN` is set
7. Generate **`qa-artifacts/dashboard.html`**

Open the dashboard:

```bash
open qa-artifacts/dashboard.html
```

The script exits **non-zero** if ESLint reports **errors** (warnings alone do not fail), Pylint reports errors, pytest test failures occur, or Playwright fails.

**Coverage gate:** `backend/pytest.ini` enforces **`--cov-fail-under=66`** on the full backend suite (line+branch total; raise toward **90%** over time). GitHub Actions job **Backend — full suite + coverage gate** runs the same command and uploads **`backend-coverage-xml`** (`coverage.xml`) for dashboards or Codecov. The QA master script adds **`--cov-fail-under=0`** so `npm run qa:all` can finish and write `backend-coverage.json` for the HTML dashboard while you iterate.

---

## Page Object Model (Playwright)

Shared UI abstractions live under **`pages/`** (sibling to `tests/`):

| File | Route / area |
| --- | --- |
| [pages/LoginPage.ts](pages/LoginPage.ts) | `#/login` |
| [pages/RegistrationPage.ts](pages/RegistrationPage.ts) | Registration wizard |
| [pages/TeamDashboardPage.ts](pages/TeamDashboardPage.ts) | `#/team` |
| [pages/SupportPortalPage.ts](pages/SupportPortalPage.ts) | `#/support` |

Specs import these classes to keep selectors and flows in one place.

---

## Code quality (lint + complexity)

- **Frontend:** `npm run lint` — includes ESLint rule **`complexity`: warn at 10** ([eslint.config.js](eslint.config.js)).
- **Backend:** `cd backend && ./.venv/bin/pylint $(find . -name '*.py' ! -path './.venv/*')` — configuration in [backend/.pylintrc](backend/.pylintrc) (`max-complexity=10`).

---

## Security scanning

### OWASP ZAP (baseline, Docker)

Requires Docker. On macOS, point ZAP at the host UI or API:

```bash
npm run qa:zap -- http://host.docker.internal:5173
# or API only
npm run qa:zap -- http://host.docker.internal:5000
```

Reports: `qa-artifacts/zap/zap-report.html` and `zap-report.json`. ZAP may exit non-zero when findings exist; treat the HTML report as the source of truth.

On Linux, replace `host.docker.internal` with your host IP or published port (e.g. `http://172.17.0.1:5173`).

### Snyk

```bash
export SNYK_TOKEN=...   # from snyk.io
npm run qa:snyk
```

Writes `qa-artifacts/snyk.json` for the dashboard. Without a token, `run-all.sh` skips Snyk and the dashboard shows “n/a” for that row.

---

## Performance (k6)

1. Start the Flask API (`npm run api` or `cd backend && ./.venv/bin/python3 app.py`).
2. Run:

```bash
npm run qa:perf
# or with a custom base URL
BASE_URL=http://127.0.0.1:5000 bash scripts/qa/perf-k6.sh
```

Script: [perf/k6/api-smoke.js](perf/k6/api-smoke.js) — hits `GET /` with thresholds aligned to **p95 under 500 ms** and **error rate under 1%**.

---

## Individual commands (quick reference)

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `cd backend && ./.venv/bin/pytest tests/ -q --cov=. --cov-config=.coveragerc` | Backend tests + coverage |
| `npm test` | Playwright E2E |
| `npm run qa:dashboard` | Regenerate HTML dashboard from existing `qa-artifacts/*.json` |

---

## Course deliverable

Summary write-up for grading: [student_exercises/deliverables/exercise_4_qa_system.md](student_exercises/deliverables/exercise_4_qa_system.md).
