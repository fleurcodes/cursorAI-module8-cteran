/**
 * k6 smoke against the Flask API root (GET /).
 * Prerequisites: backend running on BASE_URL (default http://127.0.0.1:5000).
 *
 *   k6 run perf/k6/api-smoke.js
 *   BASE_URL=http://localhost:5000 k6 run perf/k6/api-smoke.js --summary-export=qa-artifacts/k6-summary.json
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const base = __ENV.BASE_URL || 'http://127.0.0.1:5000';

export default function () {
  const res = http.get(`${base.replace(/\/$/, '')}/`);
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has message': (r) => {
      try {
        const b = r.json();
        return b && b.message != null;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!ok);
  responseTime.add(res.timings.duration);
  sleep(0.3);
}
