#!/usr/bin/env bash
# OWASP ZAP baseline scan (Docker). Target must be reachable from the container.
# macOS: use host.docker.internal for the host machine.
#
# Usage:
#   ./scripts/qa/security-zap.sh http://host.docker.internal:5173
#   ./scripts/qa/security-zap.sh http://host.docker.internal:5000
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="${1:-http://host.docker.internal:5173}"
OUT="$ROOT/qa-artifacts/zap"
mkdir -p "$OUT"

echo "Running ZAP baseline against $TARGET (reports under $OUT)"
docker run --rm \
  -v "$OUT:/zap/wrk/:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t "$TARGET" -J zap-report.json -r zap-report.html || {
    echo "ZAP exited non-zero (findings or scan issue). See $OUT/zap-report.html"
    exit 3
  }
