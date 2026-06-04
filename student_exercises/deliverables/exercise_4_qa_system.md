# Exercise 4 — Complete QA system (deliverable summary)

## What was implemented

1. **Test automation (POM)** — `TeamDashboardPage` and `SupportPortalPage` under `pages/`, used from `tests/team-dashboard.spec.ts` and `tests/support-center.spec.ts` alongside existing `LoginPage` / `RegistrationPage`.
2. **Code quality** — ESLint `complexity` rule (warn at 10); Pylint with `max-complexity=10` and `backend/requirements-qa.txt`; coverage via `backend/.coveragerc` + pytest-cov.
3. **Security automation** — `scripts/qa/security-zap.sh` (OWASP ZAP baseline in Docker); `scripts/qa/security-snyk.sh` (Snyk via `npx`, `SNYK_TOKEN` optional).
4. **Performance** — `perf/k6/api-smoke.js` + `scripts/qa/perf-k6.sh` (thresholds: p95 under 500 ms, errors under 1%).
5. **Quality dashboard** — `scripts/qa/build-dashboard.mjs` → `qa-artifacts/dashboard.html` (aggregates JSON artifacts).
6. **Master runner** — `scripts/qa/run-all.sh` and `npm run qa:all`.
7. **Documentation** — [QA.md](../../QA.md) (how to run everything, targets, prerequisites).

## How to run the full suite

```bash
npm install && npx playwright install
cd backend && ./.venv/bin/pip install -r requirements-qa.txt
cd .. && npm run qa:all
```

Optional: start the API before `qa:all` if you want k6 to run automatically; or `SKIP_K6=1 npm run qa:all`.
