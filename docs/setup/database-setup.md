# Database Setup

PostgreSQL is the only datastore. The application creates its own tables at startup.

## Step 1 — Install and start PostgreSQL

PostgreSQL must be running **before** the backend starts.
[`app/database/connection.py`](../../backend/app/database/connection.py) calls `test_connection()` at
**import time**, not inside a startup hook, so an unreachable database produces an error line during
import rather than a clean startup failure.

## Step 2 — Create the database

```bash
createdb ai_qa_automation
```

or

```sql
CREATE DATABASE ai_qa_automation;
```

The name is arbitrary — it just has to match `DB_NAME` in `backend/.env`. `ai_qa_automation` is the value
in the repository's `.env`.

**Do not create any tables.** The application does that.

## Step 3 — Configure the connection

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_qa_automation
DB_USERNAME=postgres
DB_PASSWORD=<your-password>
```

The URL is assembled as:

```python
password = urllib.parse.quote_plus(DB_PASSWORD)
SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USERNAME}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
```

`quote_plus` URL-encodes the password, so `@`, `:`, `/` and `#` in passwords are handled correctly.

`CONNECT_TIMEOUT` and `SSLMODE` exist in `.env` but are **not read** — they are not passed to
`create_engine`, and no `connect_args` are configured. To use SSL you would need to add
`connect_args={"sslmode": "require"}` to the `create_engine` call.

## Step 4 — Let the application create the tables

On the first `uvicorn` start:

```python
@app.on_event("startup")
def startup_event():
    create_all_tables()
```

```python
def create_all_tables():
    auto_import_models()                      # pkgutil-walks app.models
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully!")
```

`auto_import_models()` imports every module under `app/models/` dynamically, so all models register on
`Base` without an explicit import list — adding a new model file is enough.

Expected output:

```
✅ Database connected successfully! PostgreSQL version: PostgreSQL 16.x ...
✅ All tables created successfully!
```

## Step 5 — Verify

```sql
\c ai_qa_automation
\dt
```

Nine tables should exist — eight application tables plus APScheduler's job store:

| Table | Created by |
| ----- | ---------- |
| `tbl_collections` | model |
| `tbl_api_endpoints` | model |
| `tbl_environments` | model |
| `tbl_test_reports` | model |
| `tbl_api_test_reports` | model |
| `tbl_scheduler_jobs` | model |
| `tbl_projects` | model |
| `tbl_documents` | model |
| `apscheduler_jobs` | APScheduler's `SQLAlchemyJobStore`, on the shared engine |

Full column-level detail: [../database/schema.md](../database/schema.md).

## Migrations

**There is no migration tooling in this repository.** No Alembic directory, no `alembic.ini`, no
`versions/`, no SQL migration files.

This has a specific and important consequence:

> `Base.metadata.create_all()` creates **tables that do not exist**. It never alters a table that does
> exist. If you add, rename, remove or retype a column on a model whose table is already present, the
> database is silently left unchanged and the application will fail at query time.

Until Alembic is introduced ([AUDIT.md](../../AUDIT.md) issue 20), schema changes must be applied by
hand:

```sql
ALTER TABLE tbl_api_endpoints ADD COLUMN my_new_column JSONB;
```

In local development the alternative is to drop the affected table and let `create_all` rebuild it — at
the cost of its data.

## Seed data

**Not verified from the current implementation.** There are no seed scripts, fixtures, factories or
bootstrap SQL files. The application starts empty and is populated through the UI by uploading a Postman
collection.

The `backend/storage/` directory in the repository contains ~240 JSON artefacts from prior runs
(67 collections and their reports), but these are **filesystem artefacts only** — the matching database
rows are not included, so they cannot be used to seed a fresh database.

## Backup considerations

State is split across two locations, and a database-only backup is incomplete:

| Location | Contents |
| -------- | -------- |
| PostgreSQL | Collections, endpoints, environments, scheduler jobs, projects, documents, run summaries |
| `STORAGE_DIR` (`backend/storage/`) | Uploaded collection JSON, uploaded environment JSON, **full per-API test reports** |

`tbl_api_test_reports.test_report_file` stores a filesystem path. `GET /report/details/{report_id}/api/{api_id}`
reads that file at request time and returns 404 if it is missing. Losing `storage/` leaves the run
summaries intact but destroys all report detail.

Back up both, together.

## Connection pooling and slow queries

`create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)` — default pool sizing, with pre-ping enabled
so stale connections are detected and recycled rather than surfacing as errors.

Two event listeners time every statement and log anything slower than **300 ms** to
`logs/slow_queries.log`:

```python
if exec_time_ms > 300:
    slow_logger.warning(f"[{exec_time_ms:.2f} ms] SLOW QUERY:\n{statement}\nPARAMS: {parameters}\n")
```

The logged statement includes bound parameters, so this file can contain sensitive values.
