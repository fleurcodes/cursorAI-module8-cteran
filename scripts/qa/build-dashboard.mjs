#!/usr/bin/env node
/**
 * Aggregates QA artifact files into a single HTML quality dashboard (Exercise 4).
 * Reads optional JSON outputs from eslint, pytest-cov, Playwright, k6, Snyk, Pylint.
 * Screenshot-friendly layout (summary cards + detail tables).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ART = path.join(ROOT, 'qa-artifacts');

const TARGETS = {
  linePct: { label: 'Line coverage', target: '≥ 80%', goal: 80 },
  branchPct: { label: 'Branch coverage', target: '≥ 70%', goal: 70 },
  combinedPct: { label: 'Combined (lines + branches)', target: '≥ 80%', goal: 80 },
  eslintErrors: { label: 'ESLint errors', target: '0', goal: 0 },
  criticalVulns: { label: 'Snyk critical', target: '0', goal: 0 },
  p95Ms: { label: 'API p95', target: '< 500 ms', goal: 500 },
  errorRate: { label: 'HTTP error rate (k6)', target: '< 1%', goal: 0.01 },
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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function eslintSummary(data) {
  if (!Array.isArray(data)) return { errors: null, warnings: null, files: null, pass: null };
  let errors = 0;
  let warnings = 0;
  for (const file of data) {
    for (const m of file.messages || []) {
      if (m.severity === 2) errors += 1;
      else if (m.severity === 1) warnings += 1;
    }
  }
  return { errors, warnings, files: data.length, pass: errors === 0 };
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

/** Statement/line %, branch %, and coverage.py combined % (when branch coverage is on). */
function coverageDetail(data) {
  if (!data?.totals) return null;
  const t = data.totals;
  const linePct =
    t.num_statements > 0 ? (100 * (t.num_statements - (t.missing_lines ?? 0))) / t.num_statements : null;
  const branchPct =
    t.num_branches > 0 ? (100 * (t.covered_branches ?? 0)) / t.num_branches : null;
  const combined = typeof t.percent_covered === 'number' ? t.percent_covered : null;
  const linePass = linePct != null && linePct >= TARGETS.linePct.goal;
  const branchPass = branchPct == null || branchPct >= TARGETS.branchPct.goal;
  const combinedPass = combined != null && combined >= TARGETS.combinedPct.goal;
  return {
    linePct,
    branchPct,
    combined,
    linePass,
    branchPass,
    combinedPass,
    pass: linePass && branchPass && combinedPass,
  };
}

function playwrightSummary(data) {
  if (!data?.stats) return { expected: null, unexpected: null, flaky: null, pass: null };
  const { expected = 0, unexpected = 0, flaky = 0 } = data.stats;
  return {
    expected,
    unexpected,
    flaky,
    pass: unexpected === 0,
  };
}

function k6Summary(data) {
  if (!data?.metrics) return { p95: null, failRate: null, pass: null, ran: false };
  const m = data.metrics;
  // k6 --summary-export: trend stats live on the metric object (p(95), avg), not only under .values.
  const durMetric =
    m.http_req_duration || m['http_req_duration{expected_response:true}'];
  const durVals = durMetric?.values;
  const p95 =
    (durVals && (durVals['p(95)'] ?? durVals.avg)) ??
    (durMetric && (durMetric['p(95)'] ?? durMetric.avg)) ??
    null;
  const failedMetric = m.http_req_failed;
  const failedVals = failedMetric?.values;
  let failRate = null;
  if (failedVals && typeof failedVals.rate === 'number') failRate = failedVals.rate;
  else if (typeof failedMetric?.value === 'number') failRate = failedMetric.value;
  const pass =
    p95 != null &&
    failRate != null &&
    p95 < TARGETS.p95Ms.goal &&
    failRate < TARGETS.errorRate.goal;
  return { p95, failRate, pass, ran: true };
}

function snykSummary(data) {
  if (!data) return { critical: null, high: null, total: null, pass: null, ran: false };
  const vulns = data.vulnerabilities ?? data.issues ?? [];
  if (!Array.isArray(vulns)) return { critical: 0, high: 0, total: 0, pass: true, ran: true };
  const critical = vulns.filter((v) => v.severity === 'critical').length;
  const high = vulns.filter((v) => v.severity === 'high').length;
  return {
    critical,
    high,
    total: vulns.length,
    pass: critical === 0,
    ran: true,
  };
}

function badge(kind) {
  if (kind === 'pass') return '<span class="badge badge-pass">PASS</span>';
  if (kind === 'fail') return '<span class="badge badge-fail">FAIL</span>';
  return '<span class="badge badge-muted">Not run</span>';
}

function miniBadge(kind, label) {
  if (kind === 'pass') return `<span class="mini ok">${esc(label)} PASS</span>`;
  if (kind === 'fail') return `<span class="mini bad">${esc(label)} FAIL</span>`;
  return `<span class="mini muted">${esc(label)} Not run</span>`;
}

function overallStatus(checks) {
  const fails = checks.filter((c) => c === false);
  if (fails.length) return { label: 'FAIL', cls: 'overall-fail' };
  return { label: 'PASS', cls: 'overall-pass' };
}

function main() {
  fs.mkdirSync(ART, { recursive: true });

  const eslint = eslintSummary(readJson('eslint.json'));
  const pylint = pylintSummary(readJson('pylint.json'));
  const covData = readJson('backend-coverage.json');
  const cov = coverageDetail(covData);
  const pw = playwrightSummary(readJson('playwright-results.json'));
  const k6 = k6Summary(readJson('k6-summary.json'));
  const snyk = snykSummary(readJson('snyk.json'));

  const covCardPct = cov?.combined ?? cov?.linePct ?? null;
  const covCardLabel = cov?.combined != null ? 'Combined coverage' : 'Line coverage';

  const coveragePass = cov?.pass ?? null;
  const eslintPass = eslint.pass;
  const snykPass = snyk.ran ? snyk.pass : null;
  const k6Pass = k6.ran ? k6.pass : null;
  const pwPass = pw.pass;

  const overall = overallStatus([
    coveragePass,
    eslintPass,
    pylint.pass,
    snykPass,
    k6Pass,
    pwPass,
  ]);

  const generated = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  const subtitle =
    process.env.QA_DASHBOARD_SUBTITLE?.trim() ||
    `ShopUI full-stack · Generated ${generated} · Artifacts: qa-artifacts/`;

  const linePctStr = cov?.linePct != null ? `${cov.linePct.toFixed(2)}%` : '—';
  const branchPctStr = cov?.branchPct != null ? `${cov.branchPct.toFixed(2)}%` : '—';
  const combinedStr = cov?.combined != null ? `${cov.combined.toFixed(2)}%` : '—';

  const covLineStatus = cov ? (cov.linePass ? 'pass' : 'fail') : 'na';
  const covBranchStatus = cov ? (cov.branchPass ? 'pass' : 'fail') : 'na';
  const covCombinedStatus = cov ? (cov.combinedPass ? 'pass' : 'fail') : 'na';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QA Quality Dashboard</title>
  <style>
    :root {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      --bg: #f1f5f9;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --pass: #15803d;
      --pass-bg: #dcfce7;
      --fail: #b91c1c;
      --fail-bg: #fee2e2;
      --warn-bg: #fef9c3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.5rem 3rem;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 1.75rem; }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 0.35rem 0;
    }
    .subtitle { color: var(--muted); font-size: 0.95rem; margin: 0 0 1rem 0; }
    .overall {
      display: inline-block;
      font-size: 1rem;
      font-weight: 700;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
    }
    .overall-pass { background: var(--pass-bg); color: var(--pass); }
    .overall-fail { background: var(--fail-bg); color: var(--fail); }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.1rem 1.25rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    }
    .card h2 {
      margin: 0;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .card .big {
      font-size: 1.85rem;
      font-weight: 700;
      margin: 0.35rem 0 0.5rem;
      letter-spacing: -0.02em;
    }
    .card .sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; }

    .badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-pass { background: var(--pass-bg); color: var(--pass); }
    .badge-fail { background: var(--fail-bg); color: var(--fail); }
    .badge-muted { background: #e2e8f0; color: #475569; }

    .mini { font-size: 0.72rem; font-weight: 600; }
    .mini.ok { color: var(--pass); }
    .mini.bad { color: var(--fail); }
    .mini.muted { color: var(--muted); }

    section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.35rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    }
    section h3 {
      margin: 0 0 0.85rem 0;
      font-size: 1.05rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td {
      text-align: left;
      padding: 0.55rem 0.65rem;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    tr:last-child td { border-bottom: none; }
    td.val { font-variant-numeric: tabular-nums; font-weight: 600; }
    .foot {
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .foot code { background: #e2e8f0; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem; }
    a { color: #0369a1; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>QA Quality Dashboard</h1>
      <p class="subtitle">${esc(subtitle)}</p>
      <span class="overall ${overall.cls}">Overall: ${overall.label}</span>
    </header>

    <div class="cards">
      <div class="card">
        <h2>Test coverage</h2>
        <div class="big">${covCardPct != null ? `${covCardPct.toFixed(2)}%` : '—'}</div>
        ${miniBadge(coveragePass === true ? 'pass' : coveragePass === false ? 'fail' : 'na', covCardLabel)}
        <p class="sub">Backend pytest-cov (see detail below).</p>
      </div>
      <div class="card">
        <h2>Lint errors</h2>
        <div class="big">${eslint.errors != null ? eslint.errors : '—'}</div>
        ${miniBadge(eslintPass === true ? 'pass' : eslintPass === false ? 'fail' : 'na', 'ESLint')}
        <p class="sub">${eslint.warnings != null ? `${eslint.warnings} warnings` : 'Run npm run lint → qa-artifacts/eslint.json'}</p>
      </div>
      <div class="card">
        <h2>Critical vulns</h2>
        <div class="big">${snyk.ran ? snyk.critical : '—'}</div>
        ${miniBadge(snyk.ran ? (snyk.pass ? 'pass' : 'fail') : 'na', 'Snyk critical')}
        <p class="sub">${snyk.ran ? `${snyk.total} issues total` : 'Set SNYK_TOKEN and run qa:all'}</p>
      </div>
      <div class="card">
        <h2>P95 response</h2>
        <div class="big">${k6.ran && k6.p95 != null ? `${k6.p95.toFixed(0)} ms` : '—'}</div>
        ${miniBadge(k6.ran ? (k6.pass ? 'pass' : 'fail') : 'na', 'k6 p95')}
        <p class="sub">${k6.ran ? `Error rate ${(k6.failRate * 100).toFixed(2)}%` : 'Run API + k6 (see QA.md)'}</p>
      </div>
    </div>

    <section>
      <h3>Test coverage ${badge(coveragePass === true ? 'pass' : coveragePass === false ? 'fail' : 'muted')}</h3>
      <table>
        <thead><tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr></thead>
        <tbody>
          <tr>
            <td>Line coverage (statements)</td>
            <td class="val">${esc(linePctStr)}</td>
            <td>${esc(TARGETS.linePct.target)}</td>
            <td>${badge(covLineStatus === 'pass' ? 'pass' : covLineStatus === 'fail' ? 'fail' : 'muted')}</td>
          </tr>
          <tr>
            <td>Branch coverage</td>
            <td class="val">${esc(branchPctStr)}</td>
            <td>${esc(TARGETS.branchPct.target)}</td>
            <td>${badge(covBranchStatus === 'pass' ? 'pass' : covBranchStatus === 'fail' ? 'fail' : 'muted')}</td>
          </tr>
          <tr>
            <td>Combined (lines + branches)</td>
            <td class="val">${esc(combinedStr)}</td>
            <td>${esc(TARGETS.combinedPct.target)}</td>
            <td>${badge(covCombinedStatus === 'pass' ? 'pass' : covCombinedStatus === 'fail' ? 'fail' : 'muted')}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3>Code quality — ESLint ${badge(eslintPass === true ? 'pass' : eslintPass === false ? 'fail' : 'muted')}</h3>
      <table>
        <thead><tr><th>Metric</th><th>Value</th><th>Target</th></tr></thead>
        <tbody>
          <tr><td>Files analyzed</td><td class="val">${eslint.files != null ? eslint.files : '—'}</td><td>—</td></tr>
          <tr><td>Errors</td><td class="val">${eslint.errors != null ? eslint.errors : '—'}</td><td>0</td></tr>
          <tr><td>Warnings</td><td class="val">${eslint.warnings != null ? eslint.warnings : '—'}</td><td>—</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3>Code quality — Pylint ${badge(pylint.pass === true ? 'pass' : pylint.pass === false ? 'fail' : 'muted')}</h3>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Errors</td><td class="val">${pylint.errors != null ? pylint.errors : '—'}</td></tr>
          <tr><td>Other messages (warning / refactor / convention)</td><td class="val">${pylint.warnings != null ? pylint.warnings : '—'}</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3>Security — Snyk ${badge(snyk.ran ? (snyk.pass ? 'pass' : 'fail') : 'muted')}</h3>
      <table>
        <thead><tr><th>Severity</th><th>Count</th><th>Target</th></tr></thead>
        <tbody>
          <tr><td>Critical</td><td class="val">${snyk.ran ? snyk.critical : '—'}</td><td>0</td></tr>
          <tr><td>High</td><td class="val">${snyk.ran ? snyk.high : '—'}</td><td>—</td></tr>
          <tr><td>Total issues</td><td class="val">${snyk.ran ? snyk.total : '—'}</td><td>—</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3>Performance — k6 ${badge(k6.ran ? (k6.pass ? 'pass' : 'fail') : 'muted')}</h3>
      <table>
        <thead><tr><th>Metric</th><th>Value</th><th>Target</th></tr></thead>
        <tbody>
          <tr><td>p95 latency</td><td class="val">${k6.ran && k6.p95 != null ? `${k6.p95.toFixed(1)} ms` : '—'}</td><td>&lt; 500 ms</td></tr>
          <tr><td>HTTP error rate</td><td class="val">${k6.ran && k6.failRate != null ? `${(k6.failRate * 100).toFixed(2)}%` : '—'}</td><td>&lt; 1%</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3>E2E — Playwright ${badge(pwPass === true ? 'pass' : pwPass === false ? 'fail' : 'muted')}</h3>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Expected</td><td class="val">${pw.expected != null ? pw.expected : '—'}</td></tr>
          <tr><td>Unexpected failures</td><td class="val">${pw.unexpected != null ? pw.unexpected : '—'}</td></tr>
          <tr><td>Flaky</td><td class="val">${pw.flaky != null ? pw.flaky : '—'}</td></tr>
        </tbody>
      </table>
    </section>

    <p class="foot">
      Regenerate: <code>npm run qa:all</code> or <code>npm run qa:dashboard</code>.
      Optional subtitle for deliverables: <code>QA_DASHBOARD_SUBTITLE="Module 8 — Your name"</code> <code>npm run qa:dashboard</code>.
      OWASP ZAP: <code>qa-artifacts/zap/</code> when you run <code>npm run qa:zap</code> (not shown above). Full guide: <a href="../QA.md">QA.md</a>.
    </p>
  </div>
</body>
</html>`;

  const out = path.join(ART, 'dashboard.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log(`Wrote ${out}`);
}

main();
