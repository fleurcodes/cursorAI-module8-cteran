#!/usr/bin/env bash
# k6 API smoke (requires k6: https://k6.io/docs/getting-started/installation/)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT/qa-artifacts"

if ! command -v k6 &>/dev/null; then
  echo "k6 not found in PATH; install from https://k6.io/docs/get-started/installation/"
  exit 2
fi

export BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
echo "k6 smoke against BASE_URL=$BASE_URL"
k6 run "$ROOT/perf/k6/api-smoke.js" --summary-export="$ROOT/qa-artifacts/k6-summary.json"
