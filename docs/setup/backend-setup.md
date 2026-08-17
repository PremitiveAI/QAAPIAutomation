# Backend Setup

Every command below is either taken directly from [`backend/readme.md`](../../backend/readme.md) or
derived from the source, and is labelled with its origin. Where the repository's own command does not
work as written, the documented command is shown first and the workaround immediately after.

## Step 1 — Navigate to the backend

```bash
cd backend
```

## Step 2 — Check the Python version

```bash
python --version
```

Must report **3.10.x or 3.11.x** (`backend/readme.md:12`).

## Step 3 — Create a virtual environment

```bash
python -m venv venv
```

## Step 4 — Activate it

**Windows**

```bash
.\venv\Scripts\activate
```

**macOS / Linux**

```bash
source venv/bin/activate
```

## Step 5 — Upgrade pip and install PyTorch

```bash
python -m pip install --upgrade pip
pip install torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu
```

PyTorch is installed separately and before the requirements file, from the CPU-only index. For GPU
builds, use the command from [pytorch.org](https://pytorch.org/get-started/locally/) instead.

> PyTorch is pulled in transitively by `sentence-transformers`, which is listed in `requirements.txt` but
> is **not imported by any module in `backend/app/`**. The install is required only because the
> requirements file demands it.

## Step 6 — Install dependencies

The command documented in the repository:

```bash
pip install -r requirements.txt
```

### ⚠️ This currently fails — two problems

**Problem 1 — the file is UTF-16 encoded.** `requirements.txt` begins with a `ff fe` byte-order mark and
pip cannot parse it. Convert it to UTF-8 first:

```powershell
# Windows PowerShell — run from backend/
Get-Content requirements.txt | Set-Content -Encoding utf8 requirements.utf8.txt
pip install -r requirements.utf8.txt
```

```bash
# macOS / Linux — run from backend/
iconv -f UTF-16 -t UTF-8 requirements.txt > requirements.utf8.txt
pip install -r requirements.utf8.txt
```

**Problem 2 — three imported packages are missing from the file.** `apscheduler`, `requests` and
`Pillow` are imported by the application but not declared:

```bash
pip install apscheduler requests pillow
```

Without these the backend raises `ModuleNotFoundError` on startup. Both problems are catalogued as
[AUDIT.md](../../AUDIT.md) issues 1 and 2; fixing the file itself resolves them permanently.

### What the file declares

| Group | Packages |
| ----- | -------- |
| Core API | `fastapi`, `uvicorn[standard]`, `orjson`, `python-dotenv`, `numpy`, `python-multipart` |
| ML / embeddings | `langchain`, `langchain-google-genai`, `torch`, `transformers`, `sentence-transformers==2.7.0`, `scipy==1.13.1` |
| Database | `sqlalchemy==2.0.31`, `psycopg2-binary==2.9.9` |
| Documents | `pypdf==4.2.0`, `pymupdf`, `python-docx` |
| Security | `cryptography`, `python-jose[cryptography]`, `passlib[bcrypt]` |
| Utilities | `tqdm==4.66.4`, `js2py` |

Of these, `orjson`, `numpy`, `sentence-transformers`, `scipy`, `transformers`, `pypdf`, `tqdm` and
`passlib`'s bcrypt backend are not imported by any module under `app/`.

## Step 7 — Configure environment variables

Create `backend/.env`. It is not committed — `.gitignore` excludes `.env*`.

```ini
# ---- Database ----
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_qa_automation
DB_USERNAME=postgres
DB_PASSWORD=<your-password>

# ---- Security ----
API_TOKEN=<choose-a-long-random-string>
TOKEN_SECRET=<choose-a-long-random-string>

# ---- AI ----
GOOGLE_API_KEY=<your-gemini-key>
GOOGLE_AI_MODEL=gemini-2.0-flash

# ---- Storage ----
STORAGE_DIR=storage
BASE_URL=http://127.0.0.1:8000/
```

All ten of the first block are read by the code. `GOOGLE_AI_MODEL` is optional and defaults to
`gemini-2.0-flash`. The full inventory, including variables present in `.env` but never read, is in
[environment-variables.md](environment-variables.md).

`API_TOKEN` must match the value you put in `frontend/.env.local`.

## Step 8 — Configure the database

Create an empty database; the application creates its own tables.

```bash
createdb ai_qa_automation
```

See [database-setup.md](database-setup.md) for detail and for the migration caveat.

## Step 9 — Migrations

**None required, and none available.** There is no Alembic configuration in the repository. Tables are
created at startup by `Base.metadata.create_all()`.

This creates *missing tables* only. It never adds a column to an existing table — if you change a model
after the table exists, apply the DDL by hand.

## Step 10 — Seed data

**Not verified from the current implementation.** No seed scripts, fixtures or bootstrap data exist. The
application starts with empty tables and is populated by uploading a collection through the UI.

## Step 11 — Start the server

**Development** (`backend/readme.md:73`):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production** (`backend/readme.md:81`):

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Run from the `backend/` directory — `StaticFiles(directory="storage")` resolves relative to the working
directory.

Expected startup output:

```
Final DB URL =======>  postgresql+psycopg2://...
✅ Database connected successfully! PostgreSQL version: ...
✅ All tables created successfully!
INFO:     Uvicorn running on http://0.0.0.0:8000
```

> The first line prints your database password to the console. This is
> [AUDIT.md](../../AUDIT.md) issue 5 — be aware of it before sharing logs or screen output.

## Step 12 — Background workers

**None to start.** APScheduler runs inside the FastAPI process and is started by the second
`@app.on_event("startup")` handler. There is no Celery worker, no Redis and no separate process.

## Step 13 — Run tests

**Not verified from the current implementation.** No test suite, no pytest configuration, no test runner.
See [../testing/testing-status.md](../testing/testing-status.md).

> Do not run a bare `pytest` in `backend/`. Because pytest collects files matching `test_*.py`, it would
> attempt to import `test_case_controller.py`, `test_case_service.py`, `test_case_service_scheduler.py`,
> `test_service.py` and `test_case_llm.py` — application modules, not tests.

## Step 14 — Lint, format, type-check

**Not verified from the current implementation.** No `ruff`, `flake8`, `black`, `isort` or `mypy`
configuration exists, and none of these tools are in `requirements.txt`.

## Step 15 — Verify

```bash
curl http://localhost:8000/
# {"message":"FastAPI MVC Running"}
```

```bash
curl -H "PK-apiToken: <your-token>" \
     -H "Content-Type: application/json" \
     -d '{"search":"","sort":"createdAt","order":"DESC","limit":10,"offset":0}' \
     http://localhost:8000/collections/list
```

An empty database returns `{"Success":null,"Code":404,"Error":{"message":"No collections found"}}` —
with HTTP status **200**. That is expected; see [../api/overview.md](../api/overview.md).

Swagger UI: <http://localhost:8000/docs>

## Command reference

| Purpose | Command | Required | Verified from |
| ------- | ------- | -------- | ------------- |
| Python version | `python --version` | Yes | `backend/readme.md:12` |
| Create venv | `python -m venv venv` | Yes | `backend/readme.md:27` |
| Activate (Windows) | `.\venv\Scripts\activate` | Yes | `backend/readme.md:35` |
| Activate (macOS/Linux) | `source venv/bin/activate` | Yes | `backend/readme.md:41` |
| Upgrade pip | `python -m pip install --upgrade pip` | Yes | `backend/readme.md:47` |
| Install PyTorch | `pip install torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu` | Yes | `backend/readme.md:55` |
| Install dependencies | `pip install -r requirements.txt` | Yes | `backend/readme.md:63` — **needs the UTF-8 workaround** |
| Install missing packages | `pip install apscheduler requests pillow` | Yes | Derived from import analysis |
| Migrations | — | — | None exist |
| Seed data | — | — | Not verified from the current implementation |
| Run (dev) | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | Yes | `backend/readme.md:73` |
| Run (prod) | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | Yes | `backend/readme.md:81` |
| Run worker | — | — | Not applicable — scheduler is in-process |
| Run tests | — | — | Not verified from the current implementation |
| Lint / format / type-check | — | — | Not verified from the current implementation |
| Freeze dependencies | `pip freeze > requirements.txt` | Optional | `backend/readme.md:113` |
| Deactivate venv | `deactivate` | Optional | `backend/readme.md:121` |
