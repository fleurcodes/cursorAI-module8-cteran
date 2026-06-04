# CursorAI Module 7 — Team & Support Portal

A full-stack demo: **React + TypeScript + Vite** on the front end and a **Flask** API with JWT authentication, team project/task features, and a **customer support** area (tickets, agents, admin metrics). The UI uses Tailwind CSS and hash-based routing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript 5.x, Vite 8, Tailwind CSS 4 |
| API | Flask 2.x, SQLAlchemy, Flask-JWT-Extended, Marshmallow, Flasgger (Swagger), Flask-SocketIO |
| Data | SQLite by default (`backend/data.db`; override with `DATABASE_URL`) |
| Testing | Playwright 1.59 |
| Linting | ESLint 10 + typescript-eslint |

---

## Major Features

### Authentication
- **Registration** — Account creation with validation (name, email, password, optional support role).
- **Login** — JWT session stored for API calls; hash routes like `#/login` and `#/team`.
- **Protected areas** — Team dashboard and support flows require a signed-in user with the right roles where applicable.

#### Predefined reviewer accounts (demo / course review)

When the Flask API starts, it ensures the following users exist in the database (they are only inserted if missing). On **`#/login`**, each account has a **Sign in** button so reviewers can authenticate without using registration or the API manually.

| Email | Full name | Password | Team role | Support role |
| --- | --- | --- | --- | --- |
| `admin@example.com` | Admin Smith | `Test1234*` | manager | admin |
| `support@example.com` | Support Ashlyn | `Test1234*` | manager | agent |

These credentials are for **local and classroom review only**; do not use them in production or on the public internet.

<img width="701" height="748" alt="image" src="https://github.com/user-attachments/assets/71b282bb-258e-4239-b049-e971070d46af" />
<img width="635" height="885" alt="image" src="https://github.com/user-attachments/assets/b486c748-6abc-45a0-a836-806d1b08ce06" />

### Team dashboard (`#/team`)
- **Projects** — Select a project, see progress and task metrics.
- **Tasks** — Table of project tasks (assignee, **task status** with inline updates, priority). “Your” rows are highlighted.
- **Project status** — Set overall project health (on track, at risk, delayed, completed) from the project tasks card header.
- **Team** — Members, quick actions (new task, add member, report, meeting), activity feed.
- **API** — Projects, tasks, members, notifications, team summary (`/api/projects`, `/api/tasks`, etc.).

<img width="1127" height="880" alt="image" src="https://github.com/user-attachments/assets/581f1fba-dcad-4983-8889-ff65752b6546" />

### Customer support (`#/support`)
- **Tickets** — List and create tickets; **agents** and **admins** change status via a dropdown (valid transitions enforced by the API).
- **Admin** — Dashboard metrics (totals, open / in progress / resolved / closed, SLA, resolution time), assign tickets to agents.
- **Roles** — `support_role`: `none` (no portal), `customer`, `agent`, `admin` (set at registration or via admin user API).

---

## Project structure

```
├── backend/                 # Flask app (API + Swagger at /apidocs/)
│   ├── app.py
│   ├── config.py
│   ├── models.py
│   ├── resources/           # Blueprints (auth, projects, tasks, support, …)
│   ├── services/
│   ├── requirements.txt
│   └── data.db              # Created on first run (SQLite)
├── src/
│   ├── App.tsx              # Hash routing (#/team, #/support, …)
│   ├── pages/
│   ├── components/
│   ├── contexts/            # AuthContext
│   ├── services/            # teamDashboardApi, supportApi, authService
│   └── types/
├── tests/                   # Playwright E2E
├── vite.config.ts           # Dev proxy: /api → http://localhost:5000
└── playwright.config.ts
```

---

## Quick start

See **[RUNNING.md](RUNNING.md)** for prerequisites, Python venv, starting the API and the Vite dev server, and optional environment variables.

## Testing

See **[TESTING.md](TESTING.md)** for Playwright commands and reports.

## QA automation (Exercise 4)

See **[QA.md](QA.md)** for the full QA suite: master script (`npm run qa:all`), Page Object Model layout, ESLint/Pylint, k6, ZAP, Snyk, and the HTML quality dashboard.
