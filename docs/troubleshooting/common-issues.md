# Troubleshooting

Symptom → cause → fix, for failures that are supported by the repository. Nothing here is invented.

---

## Setup

### `pip install -r requirements.txt` fails to parse the file

**Cause.** `requirements.txt` is saved as UTF-16 with a byte-order mark; pip expects UTF-8.

**Fix.**

```powershell
Get-Content requirements.txt | Set-Content -Encoding utf8 requirements.utf8.txt
pip install -r requirements.utf8.txt
```

```bash
iconv -f UTF-16 -t UTF-8 requirements.txt > requirements.utf8.txt
pip install -r requirements.utf8.txt
```

[AUDIT.md](../../AUDIT.md) issue 1.

### `ModuleNotFoundError: No module named 'apscheduler'` (or `requests`, or `PIL`)

**Cause.** All three are imported but absent from `requirements.txt`.

**Fix.** `pip install apscheduler requests pillow`. [AUDIT.md](../../AUDIT.md) issue 2.

### PyTorch takes forever, or fails to resolve

**Cause.** `requirements.txt` pins `sentence-transformers==2.7.0`, which drags in PyTorch. Installing it
from PyPI pulls large GPU wheels.

**Fix.** Install the CPU build first, exactly as `backend/readme.md` instructs:

```bash
pip install torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu
```

Note that **nothing under `app/` imports `sentence-transformers` or `torch`** — the requirement is
vestigial.

### `npm -i` is not a command

**Cause.** A typo in `frontend/README.md`.

**Fix.** `npm i`. [AUDIT.md](../../AUDIT.md) issue 27.

### Python or Node version mismatch

**Symptom.** Dependency resolution failures, or `SyntaxError` in library code.

**Cause.** The project targets **Python 3.10/3.11** and **Node v24.12.0**.

**Fix.** `python --version` / `node -v`. Recreate the virtual environment with a supported interpreter —
mixing interpreters inside one `venv/` produces confusing import errors.

### The build fails on Linux but works on Windows/macOS

**Cause.** `app/(main)/home/page.tsx` imports `"@/app/components/Button"`; the file is `button.tsx`.
Case-insensitive filesystems tolerate the mismatch.

**Fix.** Change the import to `button`. [AUDIT.md](../../AUDIT.md) issue 19.

---

## Backend startup

### `AttributeError: 'NoneType' object has no attribute 'strip'` at startup

**Cause.** `GOOGLE_API_KEY` is missing from `backend/.env`.
`env("GOOGLE_API_KEY").strip()` runs at **import time**.

**Fix.** Add the key. It is mandatory even if you never use AI generation — the module is imported
transitively from `app.main`.

### `Exception: ❌ GOOGLE_API_KEY not found`

**Cause.** The variable exists but is empty.

### `TypeError` from `quote_plus` at startup

**Cause.** `DB_PASSWORD` is missing. `urllib.parse.quote_plus(None)` raises.

**Fix.** Set `DB_PASSWORD`, even to an empty string in a trust-auth setup.

### `❌ Database connection failed: ...`

**Cause.** PostgreSQL unreachable, wrong credentials, or the database does not exist.

**Fix.**

```bash
psql -h localhost -p 5432 -U postgres -d ai_qa_automation -c "SELECT 1;"
```

Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`.

> `CONNECT_TIMEOUT` and `SSLMODE` in `.env` are **not read** — they are not passed to `create_engine`. To
> require SSL you must add `connect_args={"sslmode": "require"}` in
> [`connection.py`](../../backend/app/database/connection.py).

### `RuntimeError: Directory 'storage' does not exist`

**Cause.** `app.mount("/storage", StaticFiles(directory="storage"))` uses a **relative** path.

**Fix.** Start uvicorn from the `backend/` directory, not the repository root.

### `[Errno 10048] / address already in use` on port 8000

**Fix.** Use another port and keep the frontend in sync:

```bash
uvicorn app.main:app --reload --port 8001
# then in frontend/.env.local
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/
```

### Migration errors

There are none to hit — no migration tool is configured. The related failure is the opposite: **a column
you added to a model does not exist in the database**, because `create_all()` never alters existing
tables. Apply the DDL manually, or drop the table and let it be recreated.
[AUDIT.md](../../AUDIT.md) issue 20.

---

## Frontend ↔ backend connectivity

### Every page is empty; the backend has data

**Cause 1 — missing trailing slash.** 28 of the 30 route handlers concatenate directly, so
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` produces `http://127.0.0.1:8000collections/list`.

**Fix.** `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/` — **with** the slash. Restart the dev server;
Next.js reads environment variables at boot.

**Cause 2 — token mismatch.** The backend returns `Code: 5002` with **HTTP 200**, so pages that only
check `res.ok` show an empty state rather than an error.

**Fix.** Confirm `API_TOKEN` is byte-identical in `backend/.env` and `frontend/.env.local`. Verify
directly:

```bash
curl -H "PK-apiToken: <token>" -H "Content-Type: application/json" \
     -d '{"limit":10,"offset":0}' http://localhost:8000/collections/list
```

### `Code: 5001 — API Token required`

**Cause.** `API_TOKEN` is unset in `frontend/.env.local`, so `utils/api.ts` falls back to `""` and the
header is sent empty.

### Browser requests go straight to `:8000`

**Cause.** Something bypassed the BFF layer. All page code must call relative `/api/...` paths.

**Why it matters.** Direct browser calls fail — there is no CORS middleware — and would expose the shared
token if a page ever attached it client-side.

### CORS errors

**Cause.** You are calling FastAPI directly from a browser on another origin. The backend registers no
CORS middleware, by design.

**Fix.** Route through the Next.js handlers. For scripted access, call the backend server-side or from
curl/Postman, where CORS does not apply.

### `run-dev.bat` opens a blank page at :3001

**Cause.** The script sets `PORT=3001` as a batch variable but never passes it to `next dev`.

**Fix.** Browse to <http://localhost:3000>. [AUDIT.md](../../AUDIT.md) issue 28.

---

## Using the application

### Upload rejected: "Invalid content type"

**Cause.** `validate_json_file` requires `content_type == "application/json"`. Some browsers send
`text/json` or `application/octet-stream` for `.json` files.

**Fix.** Re-save or re-export the file so the browser reports the correct type.

### A collection uploads but has zero APIs

**Cause.** The file parsed as JSON but has no `item` array. Any JSON document is accepted; a non-Postman
file yields `"Unnamed Collection"` with no endpoints and no error.

**Fix.** Export from Postman as **Collection v2.1**.

### An endpoint has no request body after import

**Cause.** Only `body_type == "json"` bodies are stored. A `raw` body that is XML, plain text or GraphQL
is detected but **not** persisted.

**Fix.** Enter the body manually in the workbench.

### Pre/post-request scripts from Postman are missing

**Cause.** `parse_postman_collection` never reads request-level `event` blocks — scripts are not
imported at all.

**Fix.** Re-enter them in the **scripts** tab.

### `Invalid collection_id format. Please use encrypted id.`

**Cause.** A plain integer was passed where a base64-encoded collection ID is required.
`decrypt_simple_id` explicitly rejects digit strings.

**Fix.** Use the `id` returned by the API (e.g. `NQ==`), not the database integer.

### Test run: everything returns 404 or connection errors

**Cause.** Environment variables are unfilled. Unresolved `{{variables}}` are sent **literally**, so the
request goes to `https://{{base_url}}/users`.

**Fix.** Fill every variable in the environment panel. The run dialog warns about this before starting.

### One variable never substitutes

**Cause.** The pattern is `\{\{(\w+)\}\}`, and `\w` excludes hyphens. `{{api-key}}` can never match.

**Fix.** Rename the variable to use underscores.

### A file-upload test passes without uploading anything

**Cause.** Paths must be **absolute and exist on the backend host**. A file picked in the browser is
recorded by name only. A missing file logs a warning and the request proceeds without it.

**Fix.** Use an absolute server-side path, and check the backend console for
`⚠️ Warning: File not found or invalid path`.

### `pm.test is not defined` / `pm.expect is not defined`

**Cause.** The editor's autocomplete advertises a larger API than the runtime implements.

**Fix.** Use the supported subset in
[../features/pre-post-request-scripts.md](../features/pre-post-request-scripts.md). Assertions belong in
the scenario's `response` array, not in scripts. [AUDIT.md](../../AUDIT.md) issue 35.

### A script silently has no effect

**Cause.** Script failures are caught, printed to the backend console, and the request proceeds
unmodified. Nothing appears in the report.

**Fix.** Watch the backend console for `Error executing pre script:` and `🖥️ [JS Console]:` output.
Remember ES5 only — arrow functions and template literals will not parse.

### An assertion always fails with an empty message

**Cause.** The operator is one of `neq`, `lt`, `not_contains` or `regex`. The LLM prompt advertises them;
`validate_response` does not implement them, so they fall through every branch.

**Fix.** Rewrite using `eq`, `gt`, `gte`, `lte`, `contains`, `exists` or `type`.
[AUDIT.md](../../AUDIT.md) issue 29.

### Saved request changes disappear

**Cause.** The save button dispatches to **one** endpoint. If scenarios are dirty, only scenarios are
saved and request edits are dropped.

**Fix.** Save the request first, then edit scenarios. On `/collectionDetails`, note that query-param edits
never set the dirty flag at all. [AUDIT.md](../../AUDIT.md) issue 34.

### A scenario's request body is empty in the editor but populated in the database

**Cause.** On `/collectionDetails`, a scenario whose `request` lacks a `mode` key hydrates to an empty
body. `/uploadeCollection` handles the same data correctly.

**Fix.** Open the collection through `/uploadeCollection`, or re-save the scenario with a `mode` key.
[AUDIT.md](../../AUDIT.md) issue 31.

### A test run changed my environment variables

**Working as designed.** Post-request scripts write back to `tbl_collections.env_vars`. A captured token
persists into subsequent runs. See
[../features/pre-post-request-scripts.md](../features/pre-post-request-scripts.md).

---

## Scheduler

### A scheduled run fails while the manual run passes

**Cause.** The scheduler uses a separate engine that **does not execute pre/post-request scripts**. Any
collection relying on a script-generated auth header or checksum will fail.

**Fix.** No workaround exists short of removing the script dependency.
[AUDIT.md](../../AUDIT.md) issue 25.

### A cron job fires far too often

**Cause.** All eight cron fields default to `"*"`, and `"*"` is truthy so it is not filtered out. Setting
only `cron_hour` fires **every second** of that hour.

**Fix.** Always pin `cron_minute` and `cron_second`.

### `POST /scheduler/list` returns HTTP 500

**Cause.** A non-empty `search` value. The filter references `SchedulerJob.name`; the column is
`job_name`.

**Fix.** Send `search: ""`. [AUDIT.md](../../AUDIT.md) issue 10.

### Filtering schedulers by collection returns nothing

**Cause.** `decrypt_simple_id` returns a tuple that is compared against an integer column.

**Fix.** Omit `collection_id`. [AUDIT.md](../../AUDIT.md) issue 11.

### `/schedulerReport/[id]` is permanently empty

**Cause.** `GET /scheduler/{id}/reports` was never implemented.

**Fix.** Use `/report` instead. [AUDIT.md](../../AUDIT.md) issue 16.

### Jobs vanished after a restart

**Cause.** Application code does not reload jobs from `tbl_scheduler_jobs` — persistence relies entirely
on APScheduler's own store. If the two registries have diverged, a job can be listed by the API and never
fire.

**Fix.** Delete and recreate the schedule, which re-registers it.

---

## Reports

### HTTP 500 opening a per-API report

**Cause.** The `api_id` was not part of that run. The query result is dereferenced without a null check.

**Fix.** Use an `api_id` from `GET /report/details/{report_id}`. [AUDIT.md](../../AUDIT.md) issue 12.

### `File not found at ...`

**Cause.** `test_report_file` stores the path recorded at run time. Moving `STORAGE_DIR` or the project
breaks historical reports.

**Fix.** Restore `storage/` to its original location. Back up `storage/` alongside PostgreSQL — a
database-only backup loses all report detail.

### Pagination over-pages on a filtered report list

**Cause.** `count` is the **unfiltered** total. See [../api/reports.md](../api/reports.md).

### Deleted reports come back

**Cause.** There is no delete endpoint. The buttons mutate local state only.

---

## Diagnostics

| File | Contents |
| ---- | -------- |
| `backend/logs/errors.log` | Unhandled exceptions with tracebacks |
| `backend/logs/requests.log` | Every request and response, one JSON object per line |
| `backend/logs/slow_queries.log` | Statements over 300 ms, with parameters |
| `backend/logs/app.scheduler.scheduler.log` | Scheduler startup |
| Backend console | `print()` output from the engine, JS executor and scheduler |

Loggers set `propagate = False`, so **file logs never appear in the console and console output never
reaches the files**. Check both.

> `requests.log` masks only four top-level keys (`password`, `otp`, `panaadhaar_number`, `pan_number`).
> Bearer tokens and nested PII are stored in plaintext, and startup prints the database password. Treat
> these files as sensitive. [AUDIT.md](../../AUDIT.md) issues 5 and 6.
