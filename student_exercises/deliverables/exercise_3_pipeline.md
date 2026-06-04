# Exercise 3 — CI/CD pipeline (GitHub Actions)

This document describes the workflow in [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml), companion [CodeQL workflow](../.github/workflows/codeql.yml), and container build files under [`docker/`](../docker/).

## Stages (high level)

| Stage | What runs |
| --- | --- |
| **Build** | Frontend: `npm ci`, ESLint, `npm run build`; Docker images built with BuildKit + GHA cache |
| **Test** | Backend: **3 parallel** pytest shards; E2E: **3 parallel** Playwright jobs (`chromium-desktop`, `tablet`, `mobile`) |
| **Security** | `npm audit` (high+), `pip-audit`, Bandit (report to summary; non-blocking), CodeQL on push/PR, Trivy on built images (SARIF upload when allowed), optional Snyk |
| **Deploy** | On `main`/`master` **push** only: blue/green **simulation** — active API on :5000, candidate on :5001, `GET /` health checks, promote or **rollback** (remove candidate; active unchanged) |

## Caching (time reduction)

- **npm**: `actions/setup-node` with `cache: npm` keyed on `package-lock.json`
- **pip**: `actions/setup-python` with `cache: pip` keyed on `backend/requirements.txt`
- **Playwright browsers**: `actions/cache` on `~/.cache/ms-playwright` keyed on lockfile
- **Docker layers**: `cache-from` / `cache-to` `type=gha` with separate scopes (`backend`, `frontend`)

Together with **parallel** test jobs, wall-clock time typically drops versus a single sequential job that installs everything once and runs all tests in series. Record **before/after** using GitHub Actions run durations (same branch, similar commits) to estimate improvement; reaching an exact **50%** target depends on runner variance and cache warmth.

## Optional secrets & variables

| Name | Purpose |
| --- | --- |
| `DISCORD_WEBHOOK_URL` | Server channel **Incoming Webhook** URL; on failure the workflow POSTs `{ "content": "..." }` (skipped if unset) |
| `SNYK_TOKEN` + repo variable `ENABLE_SNYK=true` | Runs [`snyk/actions/node`](https://github.com/snyk/actions) (pinned tag in workflow) |

## Monitoring & alerting

- **GitHub Step Summary**: bundle size (frontend), Bandit text, workflow job matrix results in the `notify` job
- **Security tab**: CodeQL + Trivy SARIF (upload may be skipped for fork PRs)
- **Discord**: failure webhook as above (Incoming Webhook integration in your server)

## Blue/green & rollback (scope)

The workflow demonstrates **orchestration**: health-gated promotion and automatic rollback when the candidate fails. It does **not** configure a real cloud load balancer; wiring this to AWS/Azure/GCP (target groups, traffic shifting) is an environment-specific follow-up using the same health-check pattern.

## Local Docker (optional)

From repo root (requires Docker):

```bash
docker build -f docker/backend.Dockerfile -t team-portal-api:local .
docker build -f docker/frontend.Dockerfile -t team-portal-web:local .
```

Compose-style hosting with `/api` proxy is supported by [`docker/nginx-default.conf`](../docker/nginx-default.conf) when a service named `backend` exists on the same user-defined network.
