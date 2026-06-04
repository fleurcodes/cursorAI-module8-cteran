#!/usr/bin/env bash
# Master QA runner (Exercise 4): lint, pylint, backend coverage, Playwright E2E, dashboard.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ART="$ROOT/qa-artifacts"
mkdir -p "$ART"

FAIL=0

echo "== ESLint (JSON + human-readable) =="
cd "$ROOT"
if npm run lint -- -f json -o "$ART/eslint.json"; then
  :
else
  FAIL=1
fi

echo "== Pylint (backend, requires venv + pip install -r requirements-qa.txt) =="
cd "$ROOT/backend"
if [[ -x ./.venv/bin/pylint ]]; then
  PYLIST=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && PYLIST+=("$line")
  done < <(find . -name '*.py' ! -path './.venv/*')
  if ((${#PYLIST[@]} > 0)); then
    if ./.venv/bin/pylint "${PYLIST[@]}" -f json >"$ART/pylint.json" 2>"$ART/pylint.log"; then
      :
    else
      echo "Pylint reported issues (see $ART/pylint.log); continuing."
      FAIL=1
    fi
  fi
else
  echo "Skip pylint: backend/.venv/bin/pylint not found (create venv and pip install -r requirements-qa.txt)"
fi

echo "== Pytest + coverage (backend) =="
cd "$ROOT/backend"
if [[ -x ./.venv/bin/pytest ]]; then
  if ./.venv/bin/pytest tests/ -q \
    --cov-report=term-missing \
    --cov-report=json:"$ART/backend-coverage.json" \
    --cov-fail-under=0; then
    :
  else
    FAIL=1
  fi
else
  echo "Skip pytest: backend/.venv/bin/pytest not found"
  FAIL=1
fi

echo "== Playwright E2E =="
cd "$ROOT"
export QA_JSON_REPORT="$ART/playwright-results.json"
if npx playwright test; then
  :
else
  FAIL=1
fi
unset QA_JSON_REPORT

echo "== k6 (optional; set SKIP_K6=1 to skip) =="
if [[ "${SKIP_K6:-}" == "1" ]]; then
  echo "SKIP_K6=1 — not running k6"
elif command -v k6 &>/dev/null && curl -sf "${BASE_URL:-http://127.0.0.1:5000}/" >/dev/null 2>&1; then
  "$ROOT/scripts/qa/perf-k6.sh" || FAIL=1
else
  echo "Skip k6: install k6 and start the API on port 5000, or set SKIP_K6=1"
fi

echo "== Snyk (optional; needs SNYK_TOKEN) =="
if [[ -n "${SNYK_TOKEN:-}" ]]; then
  "$ROOT/scripts/qa/security-snyk.sh" || true
fi

echo "== Quality dashboard =="
node "$ROOT/scripts/qa/build-dashboard.mjs"

echo "== Done (exit $FAIL) =="
echo "Open $ART/dashboard.html"
exit "$FAIL"
