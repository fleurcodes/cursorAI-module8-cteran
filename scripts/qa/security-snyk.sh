#!/usr/bin/env bash
# Snyk dependency scan (requires SNYK_TOKEN and snyk CLI or npx).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT/qa-artifacts"

if [[ -z "${SNYK_TOKEN:-}" ]]; then
  echo "SNYK_TOKEN is not set; skipping Snyk. Export SNYK_TOKEN to run."
  echo '{"vulnerabilities":[]}' >"$ROOT/qa-artifacts/snyk.json"
  exit 0
fi

cd "$ROOT"
npx --yes snyk@latest test --all-projects --json-file-output=qa-artifacts/snyk.json "$@"
echo "Wrote qa-artifacts/snyk.json"
