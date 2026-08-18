# Local Development

Startup order, ports, verification and the day-to-day workflow.

## Startup order

```
PostgreSQL (5432)
      ↓  must be reachable before the backend imports
Backend  (8000)   — APScheduler starts in-process
      ↓
Frontend (3000)
```

Order matters at one point only: **PostgreSQL must be up before the backend starts.**
[`connection.py`](../../backend/app/database/connection.py) runs `test_connection()` at import time.
The frontend starts fine without the backend — pages simply render empty and show "Backend not
reachable" toasts.

| Component | Technology | Port | Command | Depends on |
| --------- | ---------- | ---: | ------- | ---------- |
| Database | PostgreSQL | 5432 | external service | — |
| Backend | FastAPI / uvicorn | 8000 | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | PostgreSQL |
| Scheduler | APScheduler | in-process | starts automatically with the backend | Backend, PostgreSQL |
| Frontend | Next.js | 3000 | `npm run dev` | Backend |

There is **no Redis, no Celery, no broker and no separate worker** to start.

## Two terminals

**Terminal 1 — backend**

```bash
cd backend
.\venv\Scripts\activate          # source venv/bin/activate on macOS/Linux
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Open <http://localhost:3000>.

## Health and verification

### Backend

| Check | How | Expected |
| ----- | --- | -------- |
| Process is up | `curl http://localhost:8000/` | `{"message":"FastAPI MVC Running"}` |
| Database connected | Read the startup console | `✅ Database connected successfully! PostgreSQL version: …` |
| Tables created | Startup console | `✅ All tables created successfully!` |
| Token accepted | `curl -H "PK-apiToken: <token>" -H "Content-Type: application/json" -d '{"limit":10,"offset":0}' http://localhost:8000/collections/list` | `Code: 0`, or `Code: 404` "No collections found" on an empty database |
| Token rejected | Same call without the header | `Code: 5001`, "API Token required" |
| Swagger | <http://localhost:8000/docs> | Eight tag groups |

> `GET /` is the only endpoint resembling a health check. It does **not** touch the database, so it
> returns 200 even when PostgreSQL is down. There is no readiness endpoint.

### Frontend

| Check | How | Expected |
| ----- | --- | -------- |
| Server is up | <http://localhost:3000> | Redirects to `/home` |
| Backend connectivity | Open `/collections` | Collections list, or "No more collections" |
| BFF is in use | Browser Network tab | Calls go to `localhost:3000/api/...`, never to `:8000` |
| Token stays server-side | Inspect request headers in the browser | No `PK-apiToken` visible |
| Login | — | **Not applicable — there is no login.** See [../security/authentication-and-authorization.md](../security/authentication-and-authorization.md) |

### Scheduler

| Check | How | Expected |
| ----- | --- | -------- |
| Scheduler started | `logs/app.scheduler.scheduler.log` | `✅ Scheduler started` |
| Jobs registered | `POST /scheduler/list` — the handler calls `list_jobs()` | Backend console prints `joblist =======================> [...]` |
| Job store exists | `\dt` in psql | `apscheduler_jobs` table present |
| A job executed | Backend console | `🚀 Scheduler Job Executing...` then `✅ Executed scheduler for collection: <id>` |
| Run was recorded | `POST /report/list` | A new row for the collection |

There is no queue to inspect and no worker health endpoint — job state lives in `apscheduler_jobs` and in
the process's memory.

## First end-to-end smoke test

1. Go to `/uploadeCollection`.
2. Upload a Postman v2.1 collection export. The API list populates on the left.
3. Open the environment panel. Any `{{variable}}` found during parsing appears with an empty value —
   fill in at least `base_url` or equivalent.
4. Select an API. Check the Body tab hydrated into the right editor (JSON, params, urlencoded or
   form-data).
5. Type a description in the comment box and generate scenarios. Gemini returns a `test_scenario` array.
6. Tick the scenarios you want and save.
7. Click **Run**. You are redirected to `/test_result/{report_id}`.
8. Confirm a new JSON file exists under `backend/storage/collections/{id}/test_report/{apiId}/`.

If step 5 fails, check `GOOGLE_API_KEY`. If step 7 produces all-errors, the target system is probably
unreachable from the backend host, or environment variables are unfilled.

## Working on the backend

`--reload` watches for changes. Two caveats:

- **Module-level side effects re-run on every reload:** the database connection test, the Gemini client
  construction and the Fernet key derivation all happen at import time.
- **The scheduler restarts on every reload.** Jobs are re-registered from the `SQLAlchemyJobStore`.
  Frequent reloads while a job is executing can produce confusing log output.

### Where to look when something breaks

| File | Contents |
| ---- | -------- |
| `logs/errors.log` | Unhandled exceptions with full tracebacks |
| `logs/requests.log` | Every request and response, one JSON object per line |
| `logs/slow_queries.log` | Statements over 300 ms, with bound parameters |
| `logs/app.scheduler.scheduler.log` | Scheduler startup |
| console | `print()` diagnostics from the test engine, JS executor and scheduler |

Loggers set `propagate = False`, so **file logs never appear in the console** and console `print()`
output never reaches the files. Check both.

## Working on the frontend

Fast Refresh handles most edits. Note:

- Changes to `.env.local` require a **full restart** — Next.js reads environment variables at boot.
- Route handlers under `app/api/` are server code; edits take effect on the next request.
- Editing either workbench page means checking whether the same change is needed in the other. See
  [AUDIT.md](../../AUDIT.md) issue 24.

## Ports in use

| Symptom | Fix |
| ------- | --- |
| `[Errno 10048]` / `address already in use` on 8000 | `uvicorn app.main:app --reload --port 8001`, then update `NEXT_PUBLIC_API_URL` to match |
| Port 3000 taken | `npm run dev -- -p 3001` |

If you move the backend port, `NEXT_PUBLIC_API_URL` must move with it — and keep the trailing slash.

## Resetting local state

**Clear collections and runs, keep the schema:**

```sql
TRUNCATE tbl_api_test_reports, tbl_test_reports, tbl_api_endpoints,
         tbl_environments, tbl_scheduler_jobs, tbl_collections RESTART IDENTITY CASCADE;
```

**Clear stored files:**

```bash
rm -rf backend/storage/collections/*
```

Do both together. Truncating the database while leaving `storage/` behind orphans hundreds of report
files; clearing `storage/` while keeping the rows makes `GET /report/details/{rid}/api/{aid}` return
"File not found".

**Full reset:** drop and recreate the database, then restart the backend so `create_all()` rebuilds the
schema.

## Things that will surprise you

| Behaviour | Why |
| --------- | --- |
| Errors arrive with HTTP 200 | By design — check the `Code` field. See [../api/overview.md](../api/overview.md) |
| Collection IDs in URLs are base64 | `encrypt_simple_id`. Passing a plain integer is **rejected** |
| Running tests modifies stored environment variables | Post-request scripts write back to `tbl_collections.env_vars` |
| Scheduled runs behave differently from manual runs | The scheduler path skips pre/post-request scripts. [AUDIT.md](../../AUDIT.md) issue 25 |
| `pm.test()` autocompletes but fails at runtime | The editor advertises more than the executor implements. [../features/pre-post-request-scripts.md](../features/pre-post-request-scripts.md) |
| Adding a model column has no effect on the database | No migrations; `create_all` only creates missing tables |
