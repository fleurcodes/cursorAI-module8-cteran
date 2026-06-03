# Exercise 1 — Test matrix & data strategy (Team & Support Portal)

This document satisfies **Exercise 1** (`student_exercises/prompts/exercise_1`): 30+ test cases, categories, automation mapping, and a **test data generation strategy**.

## Test data generation strategy

1. **Playwright route mocks** (`tests/helpers/portalMocks.ts`, `tests/helpers/apiFixtures.ts`) return JSON shapes identical to the Flask API so E2E runs **without** a running backend (`npm test` per [TESTING.md](../../TESTING.md)).
2. **Users** — `defaultRegisteredUser()` plus overrides for `email`, `id`, and `support_role` (`none` | `customer` | `agent` | `admin`). JWT body uses `authSuccessJson()`.
3. **Team data** — `makeSampleProject(assigneeUserId)` builds one `ApiProject` with members and tasks; tests clone or tweak for multi-project cases.
4. **Support data** — `installSupportCenterMocks()` seeds `SupportTicketRow[]`; handlers mutate in-memory state for create/status/assign.
5. **Manual / staging** — Use README demo accounts (`admin@example.com`, `support@example.com`, `Test1234*`) against a real API when validating server-only behavior (rate limits, real JWT expiry, attachment virus scan, etc.).

---

## Test case matrix (35)

| ID | Category | Case | Automation | Notes |
|----|----------|------|--------------|-------|
| TC-01 | Positive | Login with valid credentials reaches team or empty dashboard | `errors.spec.ts`, `registration.spec.ts` | Mocked login/register |
| TC-02 | Positive | Registration success lands on `#/team` with empty or dashboard heading | `registration.spec.ts`, `accessibility.spec.ts` | Accepts `Team Dashboard` **or** `No projects yet` |
| TC-03 | Positive | Team dashboard loads projects, tasks, activity, quick actions | `team-dashboard.spec.ts` | Mocked projects |
| TC-04 | Positive | Change **project status** (on-track → at-risk) persists in mock state | `team-dashboard.spec.ts` | PATCH `/api/projects/:id` |
| TC-05 | Positive | Change **task status** via PATCH `/api/tasks/:id` | `team-dashboard.spec.ts` | |
| TC-06 | Positive | Switching selected **project card** updates task table | `team-dashboard.spec.ts` | Two projects |
| TC-07 | Positive | Customer on `#/support` sees ticket list, no status dropdown | `support-center.spec.ts` | RBAC UI |
| TC-08 | Positive | Agent changes ticket status via combobox | `support-center.spec.ts` | |
| TC-09 | Positive | Admin sees metrics and assigns ticket to agent | `support-center.spec.ts` | |
| TC-10 | Positive | Create ticket then row appears in table | `support-center.spec.ts` | |
| TC-11 | Positive | Refresh reloads ticket list | `support-center.spec.ts` | |
| TC-12 | Negative | Login 401 shows server message | `errors.spec.ts` | |
| TC-13 | Negative | Empty login fields stay on login | `errors.spec.ts` | |
| TC-14 | Negative | Unauthenticated `#/team` shows sign-in prompt | `errors.spec.ts` | |
| TC-15 | Negative | Projects API failure shows empty / error path | `errors.spec.ts` | |
| TC-16 | Negative | Registration 429 then retry succeeds | `errors.spec.ts` | |
| TC-17 | Negative | Ticket status API returns 400; error stays visible | `support-center.spec.ts`, `SupportCenter.tsx` | `preserveError` on `loadList` |
| TC-18 | Negative | Ticket list GET 401 shows message | `support-auth-security.spec.ts` | URL predicate route |
| TC-19 | Negative | Create ticket POST 400 shows validation message | `support-auth-security.spec.ts` | Overlay route |
| TC-20 | Edge | Hash navigation `#/login`, `#/register`, `#/team` | `navigation.spec.ts` | Existing |
| TC-21 | Edge | Multi-step registration validation | `validation.spec.ts` | Existing |
| TC-22 | Edge | Empty projects list (“No projects yet”) | `registration.spec.ts` / mocks | |
| TC-23 | Edge | Pagination query `page=` on tickets (mock returns page 1) | Manual | Mock stub fixed page |
| TC-24 | Security | `#/support` without session — sign-in gate | `support-auth-security.spec.ts` | |
| TC-25 | Security | Logged in, `support_role: none` — support gate | `support-auth-security.spec.ts` | |
| TC-26 | Security | HTML/script-like subject stored; rendered as text; no `dialog` | `support-auth-security.spec.ts` | React escaping |
| TC-27 | Security | JWT / ticket API error surfaces to UI | `support-auth-security.spec.ts` | 401 case |
| TC-28 | Security | RBAC: customer cannot use agent status control | `support-center.spec.ts` | Combobox count 0 |
| TC-29 | Accessibility | Registration labels, ARIA, keyboard | `accessibility.spec.ts` | Existing |
| TC-30 | Accessibility | Support create form: `label` + `htmlFor` + ids | `SupportCenter.tsx` | Improved in this exercise |
| TC-31 | Positive | Navbar Team / Support links | Covered indirectly | Hash routes |
| TC-32 | Negative | Invalid registration / server errors | `registration.spec.ts` | |
| TC-33 | Edge | Concurrent / rapid registration retry | `errors.spec.ts` | |
| TC-34 | Security | SQLi string in description (UI + mock); server validation | Manual | Mock does not simulate SQL |
| TC-35 | Positive | Admin SLA / resolution metrics keys present | `support-center.spec.ts` | Mock metrics object |

---

## Optional: API-only pytest (not in repo by default)

To add **pytest** against a running Flask app: create `backend/tests/` with a live client fixture, mark tests `@pytest.mark.integration`, and document `pytest backend/tests -m integration` in this file when implemented.

---

## Files added or changed for this exercise

| Path | Role |
|------|------|
| `tests/helpers/portalMocks.ts` | Stateful mocks for team + support APIs |
| `tests/team-dashboard.spec.ts` | Team dashboard flows |
| `tests/support-center.spec.ts` | Support RBAC + tickets |
| `tests/support-auth-security.spec.ts` | Gates, 401, XSS-ish subject, API validation |
| `src/pages/SupportCenter.tsx` | Label/input wiring; `loadList({ preserveError })` after status errors |
| `tests/registration.spec.ts`, `tests/accessibility.spec.ts` | Heading assertion aligned with empty-project UX |
