#!/usr/bin/env node
/**
 * Aggregates QA artifact files into a single HTML dashboard (Exercise 4).
 * Reads optional JSON outputs from eslint, pytest-cov, Playwright, k6, Snyk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ART = path.join(ROOT, 'qa-artifacts');

const TARGETS = {
  coveragePct: { label: 'Test coverage (backend lines)', target: '80%+', goal: 80 },
  complexity: { label: 'Max cyclomatic complexity (ESLint/Pylint)', target: '<10', goal: 10 },
  criticalVulns: { label: 'Critical security issues', target: '0', goal: 0 },
  p95Ms: { label: 'API p95 response time', target: '<500ms', goal: 500 },
  errorRate: { label: 'HTTP error rate (k6)', target: '<1%', goal: 0.01 },
};

function readJson(file) {
  try {
    const p = path.join(ART, file);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function eslintSummary(data) {
  if (!Array.isArray(data)) return { errors: null, warnings: null, pass: null };
  let errors = 0;
  let warnings = 0;
  for (const file of data) {
    for (const m of file.messages || []) {
      if (m.severity === 2) errors += 1;
      else if (m.severity === 1) warnings += 1;
    }
  }
  return { errors, warnings, pass: errors === 0 };
}

function pylintSummary(data) {
  if (!Array.isArray(data)) return { errors: null, warnings: null, pass: null };
  let errors = 0;
  let warnings = 0;
  for (const m of data) {
    const t = m.type;
    if (t === 'error') errors += 1;
    else if (t === 'warning' || t === 'refactor' || t === 'convention') warnings += 1;
  }
  return { errors, warnings, pass: errors === 0 };
}

function coverageSummary(data) {
  if (!data?.totals) return { pct: null, pass: null };
  const pct = data.totals.percent_covered ?? null;
  return { pct, pass: pct != null && pct >= TARGETS.coveragePct.goal };
}

function playwrightSummary(data) {
  if (!data?.stats) return { expected: null, unexpected: null, pass: null };
  const { expected = 0, unexpected = 0, flaky = 0 } = data.stats;
  return {
    expected,
    unexpected,
    flaky,
    pass: unexpected === 0,
  };
}

function k6Summary(data) {
  if (!data?.metrics) return { p95: null, failRate: null, pass: null };
  const dur = data.metrics.http_req_duration?.values;
  const failed = data.metrics.http_req_failed?.values;
  const p95 = dur?.['p(95)'] ?? dur?.avg ?? null;
  const failRate = failed?.rate ?? null;
  const pass =
    p95 != null &&
    failRate != null &&
    p95 < TARGETS.p95Ms.goal &&
    failRate < TARGETS.errorRate.goal;
  return { p95, failRate, pass };
}

function snykSummary(data) {
  if (!data) return { critical: null, pass: null };
  const vulns = data.vulnerabilities ?? data.issues ?? [];
  const critical = Array.isArray(vulns) ? vulns.filter((v) => v.severity === 'critical').length : 0;
  return { critical, pass: critical === 0 };
}

function row(metric, actual, status) {
  const st =
    status === true ? 'pass' : status === false ? 'fail' : 'unknown';
  return `<tr><td>${metric}</td><td>${actual}</td><td class="${st}">${st}</td></tr>`;
}

function main() {
  fs.mkdirSync(ART, { recursive: true });

  const eslint = eslintSummary(readJson('eslint.json'));
  const pylint = pylintSummary(readJson('pylint.json'));
  const cov = coverageSummary(readJson('backend-coverage.json'));
  const pw = playwrightSummary(readJson('playwright-results.json'));
  const k6 = k6Summary(readJson('k6-summary.json'));
  const snyk = snykSummary(readJson('snyk.json'));

  const rows = [
    row(
      TARGETS.coveragePct.label,
      cov.pct != null ? `${cov.pct.toFixed(1)}% (target ${TARGETS.coveragePct.target})` : 'n/a — run pytest with cov (see QA.md)',
      cov.pass,
    ),
    row(
      'ESLint (errors / warnings)',
      eslint.errors != null ? `${eslint.errors} / ${eslint.warnings}` : 'n/a',
      eslint.pass,
    ),
    row(
      `Pylint (${TARGETS.complexity.target} complexity enforced in .pylintrc)`,
      pylint.errors != null ? `${pylint.errors} errors, ${pylint.warnings} other messages` : 'n/a',
      pylint.pass,
    ),
    row(
      TARGETS.criticalVulns.label,
      snyk.critical != null ? `${snyk.critical} (target ${TARGETS.criticalVulns.target})` : 'n/a — run scripts/qa/security-snyk.sh',
      snyk.pass,
    ),
    row(
      TARGETS.p95Ms.label,
      k6.p95 != null ? `${k6.p95.toFixed(1)} ms p95 (target ${TARGETS.p95Ms.target})` : 'n/a — run k6 with API up',
      k6.pass,
    ),
    row(
      TARGETS.errorRate.label,
      k6.failRate != null ? `${(k6.failRate * 100).toFixed(2)}% (target ${TARGETS.errorRate.target})` : 'n/a',
      k6.failRate != null ? k6.failRate < TARGETS.errorRate.goal : null,
    ),
    row(
      'Playwright E2E (unexpected failures)',
      pw.expected != null
        ? `${pw.expected} expected, ${pw.unexpected} unexpected, ${pw.flaky} flaky`
        : 'n/a — run full QA suite',
      pw.pass,
    ),
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QA dashboard — CursorAI Module</title>
  <style>
    :root { font-family: system-ui, sans-serif; }
    body { margin: 2rem; background: #0f172a; color: #e2e8f0; }
    h1 { color: #38bdf8; }
    table { border-collapse: collapse; width: 100%; max-width: 56rem; }
    th, td { border: 1px solid #334155; padding: 0.6rem 0.75rem; text-align: left; }
    th { background: #1e293b; }
    tr:nth-child(even) { background: #1e293b55; }
    .pass { color: #4ade80; font-weight: 600; }
    .fail { color: #f87171; font-weight: 600; }
    .unknown { color: #fbbf24; }
    p.note { max-width: 56rem; color: #94a3b8; font-size: 0.9rem; }
    code { background: #1e293b; padding: 0.1rem 0.35rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Quality dashboard</h1>
  <p class="note">Generated from <code>qa-artifacts/</code>. Run <code>bash scripts/qa/run-all.sh</code> or individual tools (see <a href="../QA.md" style="color:#7dd3fc">QA.md</a>).</p>
  <table>
    <thead><tr><th>Metric</th><th>Actual</th><th>Status</th></tr></thead>
    <tbody>
      ${rows.join('\n')}
    </tbody>
  </table>
  <p class="note">OWASP ZAP baseline reports are written under <code>qa-artifacts/zap/</code> when you run <code>scripts/qa/security-zap.sh</code> (not merged into this table).</p>
</body>
</html>`;

  const out = path.join(ART, 'dashboard.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log(`Wrote ${out}`);
}

main();
