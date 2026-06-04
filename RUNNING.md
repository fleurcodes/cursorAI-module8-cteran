# Running the application

The app has two parts: the **Flask API** (default port **5000**) and the **Vite dev server** (default **5173**). In development, Vite proxies `/api` and `/socket.io` to the backend (see `vite.config.ts`), so you usually run both processes and open the Vite URL.

---

## Prerequisites

| Tool | Notes |
|---|---|
| **Node.js** v18+ | [nodejs.org](https://nodejs.org/) — includes **npm** v9+ |
| **Python** 3.9+ | For the Flask backend |

Check versions:

```bash
node --version   # e.g. v20.11.0
npm --version    # e.g. 10.2.4
python3 --version
```

---

## 1. Install frontend dependencies

From the **repository root**:

```bash
npm install
```

---

## 2. Set up the Python backend

```bash
cd backend
python3 -m venv .venv
```

Activate the virtual environment:

- **macOS / Linux:** `source .venv/bin/activate`
- **Windows (cmd):** `.venv\Scripts\activate.bat`
- **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`

Install Python packages:

```bash
pip install -r requirements.txt
```

The API uses **SQLite** at `backend/data.db` by default (created when the app starts). Override with a `DATABASE_URL` environment variable if needed (see `backend/config.py`).

### Optional: Redis (cache + Celery broker)

When `REDIS_URL` is set, Flask-Caching uses **Redis** and Celery defaults to the same broker (see `backend/config.py`). Without it, the API uses in-memory cache and still points Celery at `redis://localhost:6379/0` for a real worker.

From the **repository root**, start Redis with Docker Compose:

```bash
docker compose up -d redis
export REDIS_URL=redis://127.0.0.1:6379/0
export CELERY_BROKER_URL=redis://127.0.0.1:6379/0
export CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

Then start the API as usual. In **production**, set `FLASK_ENV=production` (or `APP_ENV=production`) and provide non-default **`SECRET_KEY`** and **`JWT_SECRET_KEY`**; the app refuses to boot with the development placeholders when production mode is enabled.

---

## 3. Start the API server

With the venv **activated** and your shell in `backend/`:

```bash
python3 app.py
```

You should see the server bind to **port 5000** (Flask-SocketIO). Swagger UI: [http://localhost:5000/apidocs/](http://localhost:5000/apidocs/)

**Alternative from the repo root** (uses `backend/.venv` if present):

```bash
npm run api
```

Keep this terminal open while developing.

---

## 4. Start the Vite dev server

In a **second terminal**, from the **repository root**:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). HMR reloads the UI when you edit `src/`.

---

## 5. Navigate the app (hash routes)

| Page | URL |
|---|---|
| Team dashboard | http://localhost:5173/#/team |
| Customer support | http://localhost:5173/#/support |
| Login | http://localhost:5173/#/login |
| Register | http://localhost:5173/#/register |

**Protected routes:** `#/team` and `#/support` require login. Support features also require a non-`none` **support role** on the account (`customer`, `agent`, or `admin`).

---

## 6. Optional: API base URL (production / custom port)

By default the dev server proxies `/api` to `http://localhost:5000`, so you do **not** need `VITE_API_BASE_URL` for local development.

If you serve the API on another host or port without the Vite proxy, create a `.env` in the project root:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

(Include no trailing slash; the client prepends this to paths like `/api/login`.)

---

## 7. Build for production

```bash
npm run build
```

Output: `dist/`. Serve `dist/` with any static host; configure that host to forward `/api` (and WebSockets if used) to your Flask app, **or** set `VITE_API_BASE_URL` at build time to the public API URL.

---

## 8. Preview the production bundle

```bash
npm run preview
```

Opens a local static server (default [http://localhost:4173](http://localhost:4173)). It does not start Flask — run the API separately if the preview build calls the backend.

---

## 9. Lint

```bash
npm run lint
```

---

## Scripts summary

| Script | Command | Purpose |
|---|---|---|
| `dev` | `npm run dev` | Vite dev server + HMR |
| `api` | `npm run api` | Run `backend/app.py` with `backend/.venv` Python |
| `build` | `npm run build` | `tsc -b` + Vite production build |
| `preview` | `npm run preview` | Serve `dist/` locally |
| `lint` | `npm run lint` | ESLint |
| `test` | `npm test` | Playwright E2E (see **TESTING.md**) |
| `test:ui` | `npm run test:ui` | Playwright UI mode |
| `test:report` | `npm run test:report` | Open last HTML report |

---

## Typical dev workflow

1. Terminal A: `cd backend && source .venv/bin/activate && python3 app.py`
2. Terminal B: `npm run dev`
3. Browser: register or log in, then `#/team` and/or `#/support` depending on roles.
