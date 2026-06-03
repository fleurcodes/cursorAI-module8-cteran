# Testing the Application

The app uses **Playwright** for end-to-end (E2E) tests. Tests run against a live Vite dev server (started automatically by Playwright) and exercise the full browser stack across three device profiles: **desktop**, **tablet**, and **mobile**.

**No Flask server is required** for most tests: `/api/register`, `/api/login`, and team dashboard endpoints are **mocked** in the browser so registration and login flows stay deterministic.

---

## Prerequisites

1. Install dependencies (if you haven't already):

   ```bash
   npm install
   ```

2. Install the Playwright browser binaries:

   ```bash
   npx playwright install
   ```

---

## Running Tests

### Run all tests (headless)

```bash
npm test
```

Playwright launches Chromium (desktop), iPad (tablet), and iPhone 14 (mobile). Results are printed to the terminal and an HTML report is generated in `playwright-report/`.

---

### Run tests with the interactive UI

```bash
npm run test:ui
```

Opens the Playwright UI explorer — browse test files, run individual tests, step through actions, and inspect snapshots visually.

---

### Run a single test file

```bash
npx playwright test tests/registration.spec.ts
```

---

### Run tests matching a name pattern

```bash
npx playwright test --grep "Login errors"
```

---

### Run tests on a specific device profile

```bash
npx playwright test --project=chromium-desktop
npx playwright test --project=tablet
npx playwright test --project=mobile
```

---

### Run tests in headed mode (visible browser)

```bash
npx playwright test --headed
```

---

## Test Suites

| File | What it covers |
|---|---|
| `tests/navigation.spec.ts` | Registration wizard steps, back/forward, data persistence, hash routes (`#/login`, `#/register`, `#/team`) |
| `tests/registration.spec.ts` | Successful registration (redirects to `#/team`), API error handling, loading states |
| `tests/validation.spec.ts` | Step 1 & 2 field validation |
| `tests/errors.spec.ts` | Login errors, unauthenticated team gate, dashboard API failure, registration retry |
| `tests/accessibility.spec.ts` | Labels, ARIA, keyboard navigation, focus management, submission announcements |
| `tests/team-dashboard.spec.ts` | Team dashboard with mocked `/api/projects`, `/api/tasks`, `/api/team`, `/api/notifications` (Exercise 1) |
| `tests/support-center.spec.ts` | Customer support portal: RBAC, tickets, admin metrics, assign (Exercise 1) |
| `tests/support-auth-security.spec.ts` | Support sign-in gate, support-role gate, 401 list, injection-like subject, API validation errors (Exercise 1) |
| `student_exercises/deliverables/exercise_1_test_matrix.md` | 35-row test matrix + data strategy (Exercise 1 deliverable) |

---

## Helpers & fixtures

| Path | Purpose |
|---|---|
| `pages/RegistrationPage.ts` | Page object for the multi-step registration form |
| `pages/LoginPage.ts` | Page object for `#/login` |
| `tests/helpers/formHelpers.ts` | Valid sample data and boundary strings |
| `tests/helpers/apiFixtures.ts` | Mock JWT/register responses and empty team-dashboard API payloads |
| `tests/helpers/portalMocks.ts` | Stateful mocks for richer team projects/tasks and support ticket/admin APIs (Exercise 1) |

Successful registration matches the real API: responses include `access_token` and `user` (see `authService.register`). After success, `App.tsx` sends authenticated users from `#/register` to `#/team`, so tests assert the **team dashboard** rather than a static “success” screen.

---

## Viewing the HTML Test Report

After any test run:

```bash
npm run test:report
```

---

## Running Tests in CI

```bash
CI=true npm test
```

Playwright will retry failing tests up to **2 times**, use **1 worker**, and start the dev server at `http://localhost:5173`.

---

## GitHub Actions (Exercise 3)

The repository includes an optimized pipeline (caching, parallel pytest + Playwright shards, security scans, Docker builds with layer cache, optional Slack/Snyk). See **[`student_exercises/deliverables/exercise_3_pipeline.md`](student_exercises/deliverables/exercise_3_pipeline.md)** and the workflow files under `.github/workflows/`.

---

## Configuration Reference

See [`playwright.config.ts`](playwright.config.ts): base URL `http://localhost:5173`, test dir `./tests`, web server `npm run dev`.
