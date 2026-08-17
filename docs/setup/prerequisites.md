# Prerequisites

Everything you need before running either application.

## Runtimes

| Requirement | Version | Source of the requirement |
| ----------- | ------- | ------------------------- |
| Python | **3.10 or 3.11** | [`backend/readme.md:12`](../../backend/readme.md) |
| Node.js | **v24.12.0** | [`frontend/README.md`](../../frontend/README.md) links the v24.12.0 installer |
| npm | bundled with Node | Only `package-lock.json` is present — no yarn/pnpm/bun lockfile |
| PostgreSQL | 12+ | Driver is `psycopg2`; `postgresql+psycopg2://` URL in [`connection.py`](../../backend/app/database/connection.py) |

Verify:

```bash
python --version     # expect 3.10.x or 3.11.x
node -v              # expect v24.x
npm -v
psql --version
```

> The Python version bound is real, not cosmetic. `requirements.txt` pins
> `sentence-transformers==2.7.0` and `scipy==1.13.1`, and the README's PyTorch step pins
> `torch==2.9.1` — combinations that will not resolve cleanly on much newer or older interpreters.

## Services

| Service | Required | Notes |
| ------- | -------- | ----- |
| PostgreSQL | **Yes** | Must be running before the backend starts — `test_connection()` executes at import time |
| Redis | No | Not used anywhere in the repository |
| Celery / RabbitMQ / any broker | No | Scheduling is in-process via APScheduler |
| Qdrant / vector database | No | `VECTOR_DB_DIR` exists in `.env` but no code reads it |

## Accounts and credentials

| Credential | Required | Used by |
| ---------- | -------- | ------- |
| **Google Gemini API key** | **Yes** | [`test_case_llm.py`](../../backend/app/utils/test_case_llm.py) and [`kyc_document_parser.py`](../../backend/app/utils/kyc_document_parser.py) both `raise Exception("❌ GOOGLE_API_KEY not found")` at **import time** |
| PostgreSQL username/password | Yes | Database connection |

The Gemini key is not optional. Both modules are imported transitively from `app.main`, so the backend
will not start without a value. Obtain a key from [Google AI Studio](https://aistudio.google.com/).

## Disk

Test reports are written as one JSON file per API per run under `STORAGE_DIR`. The repository already
contains ~240 such files from prior runs. A collection with 20 endpoints run hourly produces 480 files a
day — plan for growth, and note that nothing in the codebase prunes them.

## Ports

| Port | Used by | Configurable |
| ---: | ------- | ------------ |
| 5432 | PostgreSQL | `DB_PORT` |
| 8000 | FastAPI backend | `--port` argument to uvicorn |
| 3000 | Next.js frontend | `PORT` env var or `next dev -p` |

> `API_PORT=5004` appears in `backend/.env` but **no code reads it**. The port comes solely from the
> uvicorn command line. Use **8000**, which is what `BASE_URL` and `backend/readme.md` assume.

## Platform notes

Development on this project has been Windows-based (`.bat` helper scripts, `venv\Scripts\activate`
instructions). Two portability issues will bite on Linux:

1. [`app/(main)/home/page.tsx`](../../frontend/app/(main)/home/page.tsx) imports
   `"@/app/components/Button"` while the file is `button.tsx`. Case-insensitive filesystems tolerate
   this; Linux does not. See [AUDIT.md](../../AUDIT.md) issue 19.
2. `app.mount("/storage", StaticFiles(directory="storage"))` uses a relative path, so the backend must be
   launched from the `backend/` directory on any platform.

## Next steps

1. [Database setup](database-setup.md)
2. [Backend setup](backend-setup.md)
3. [Frontend setup](frontend-setup.md)
4. [Local development workflow](local-development.md)
