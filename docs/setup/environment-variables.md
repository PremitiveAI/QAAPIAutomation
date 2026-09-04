# Environment Variables

Complete inventory for both applications, established by cross-referencing every `env(...)` call in the
backend and every `process.env` reference in the frontend against the files that declare them.

Neither `.env` file is committed — the root `.gitignore` excludes `.env`, `.env.*` and `*.env` — and no
`.env.example` exists in either application. Both must be created by hand.

**No secret values appear in this document.**

---

## Backend — `backend/.env`

### Required — read by the code

| Variable | Purpose | Read by | Example |
| -------- | ------- | ------- | ------- |
| `DB_HOST` | PostgreSQL host | [`connection.py`](../../backend/app/database/connection.py) | `localhost` |
| `DB_PORT` | PostgreSQL port | `connection.py` | `5432` |
| `DB_NAME` | Database name | `connection.py` | `ai_qa_automation` |
| `DB_USERNAME` | Database user | `connection.py` | `postgres` |
| `DB_PASSWORD` | Database password — URL-quoted before use | `connection.py` | `<secret>` |
| `API_TOKEN` | Shared token compared against `PK-apiToken` on every request | [`auth_middleware.py`](../../backend/app/middlewares/auth_middleware.py), [`swagger_headers.py`](../../backend/app/docs/swagger_headers.py) | `<secret>` |
| `TOKEN_SECRET` | SHA-256 seed for the Fernet key | [`crypto.py`](../../backend/app/utils/crypto.py) | `<secret>` |
| `GOOGLE_API_KEY` | Google Gemini API key | [`test_case_llm.py`](../../backend/app/utils/test_case_llm.py), [`kyc_document_parser.py`](../../backend/app/utils/kyc_document_parser.py) | `<secret>` |
| `STORAGE_DIR` | Root for collection files and test reports | [`storage_helper.py`](../../backend/app/utils/storage_helper.py), [`test_case_service.py`](../../backend/app/services/test_case_service.py) | `storage` |
| `BASE_URL` | Public base URL, prefixed to document file paths | [`tbl_documents.py`](../../backend/app/models/tbl_documents.py) | `http://127.0.0.1:8000/` |

Two of these fail hard when absent:

- **`GOOGLE_API_KEY`** — both Gemini modules run `env("GOOGLE_API_KEY").strip()` at import time, so a
  missing value raises `AttributeError` on `None`, and an empty value raises
  `Exception("❌ GOOGLE_API_KEY not found")`. Either way the backend will not start.
- **`TOKEN_SECRET`** — `crypto.py` derives the Fernet key at import time; `None` raises `AttributeError`.

`DB_PASSWORD` also fails at import: `urllib.parse.quote_plus(None)` raises `TypeError`.

### Optional — read, with defaults

| Variable | Default | Purpose | Read by |
| -------- | ------- | ------- | ------- |
| `GOOGLE_AI_MODEL` | `gemini-2.0-flash` | Gemini model id | `test_case_llm.py`, `kyc_document_parser.py` |
| `DEFAULT_COUNTRY` | `IN` | Fallback for the `PK-country` header | `auth_middleware.py` |
| `DEFAULT_TZ` | `Asia/Kolkata` | Fallback for the `PK-timezone` header | `auth_middleware.py` |

None of the three appear in the repository's `.env`; the defaults always apply unless you add them.

### Present in `.env` but never read

Confirmed by exhaustive search — no `env("…")` call references any of these:

| Variable | Value in `.env` | Status |
| -------- | --------------- | ------ |
| `API_VERSION` | `1.0.0` | Unused. **Purpose not verified from the current implementation.** |
| `ISPRODUCTION` | `false` | Unused — there is no environment switch in the code |
| `API_PORT` | `5004` | **Unused and misleading.** The port comes only from the uvicorn command line. `BASE_URL` and `backend/readme.md` both assume **8000** |
| `TIMEZONE` | `Asia/Kolkata` | Unused. The scheduler hard-codes `timezone="Asia/Kolkata"`; models hard-code an IST `timedelta` |
| `DATE_FORMAT` | `DD-MMM-YYYY HH:mm:ss` | Unused. Models hard-code `"%d-%b-%Y %H:%M:%S"` |
| `DB_DATE_FORMAT` | `YYYY-MM-DD HH:mm:ss` | Unused |
| `DOB_DATE_FORMAT` | `DD-MMM-YYYY` | Unused |
| `DB_DOB_DATE_FORMAT` | `YYYY-MM-DD` | Unused |
| `ENCRYPT_SECRET` | — | Unused. `crypto.py` uses `TOKEN_SECRET` |
| `CONNECT_TIMEOUT` | `10` | Unused — not passed to `create_engine` |
| `SSLMODE` | `prefer` | Unused — no `connect_args` are configured |
| `VECTOR_DB_DIR` | `qdrant_storage` | Unused. No vector database exists in this project |

These are inherited from another codebase. They are harmless, but do not assume changing them has any
effect.

### Minimal working `backend/.env`

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_qa_automation
DB_USERNAME=postgres
DB_PASSWORD=<secret>

API_TOKEN=<secret>
TOKEN_SECRET=<secret>
GOOGLE_API_KEY=<secret>
GOOGLE_AI_MODEL=gemini-2.0-flash

STORAGE_DIR=storage
BASE_URL=http://127.0.0.1:8000/
```

---

## Frontend — `frontend/.env.local`

### Required

| Variable | Purpose | Read by | Example |
| -------- | ------- | ------- | ------- |
| `NEXT_PUBLIC_API_URL` | Backend base URL — **must end with `/`** | [`utils/api.ts`](../../frontend/app/utils/api.ts) | `http://127.0.0.1:8000/` |
| `API_TOKEN` | Sent as `PK-apiToken`; must equal the backend value | `utils/api.ts` | `<secret>` |

**On the trailing slash.** 28 of the 30 route handlers concatenate directly —
`` fetch(`${API_URL}collections/list`) `` — so omitting it yields
`http://127.0.0.1:8000collections/list`. Only `projects/project-list` and `projects/project-delete`
normalise with `.replace(/\/$/, "")`.

**On the missing prefix.** `API_TOKEN` deliberately has no `NEXT_PUBLIC_` prefix. It is imported only by
server-side route handlers, so Next.js excludes it from the client bundle. Adding the prefix would expose
the shared token to every visitor.

`NEXT_PUBLIC_API_URL` *is* prefixed and therefore *is* inlined into the browser bundle — but since it is
only ever used server-side, the practical effect is just that the backend URL is discoverable. That is
not a secret.

### Declared but never consumed

Exported by [`utils/api.ts`](../../frontend/app/utils/api.ts), referenced by no other file:

| Variable | Status |
| -------- | ------ |
| `GOOGLE_CLIENT_ID` | **Purpose not verified from the current implementation** — no OAuth flow exists |
| `GOOGLE_CLIENT_SECRET` | Purpose not verified from the current implementation |
| `GOOGLE_REDIRECT_URI` | Purpose not verified from the current implementation |
| `SESSION_SECRET` | Defaults to `"dev-secret"`. No session handling exists |
| `ISSUER_URL` | Purpose not verified from the current implementation |
| `CLIENT_ID` | Purpose not verified from the current implementation |
| `COOKIE_SECRET` | Read by [`utils/crypto.ts`](../../frontend/app/utils/crypto.ts), which is imported by nothing |

### Listed in `frontend/README.md` but read by nothing

| Variable | Status |
| -------- | ------ |
| `NEXT_PUBLIC_OLA_MAPS_API_KEY` | Not read by any source file |
| `OLA_MAPS_API_KEY` | Not read by any source file |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Not read by any source file |
| `GOOGLE_MAPS_API_KEY` | Not read by any source file |

`olamaps-web-sdk` is installed and `app/layout.tsx` contains a stray Ola Maps stylesheet `<link>` outside
any component — both inherited from another project. Do not provision these keys.

### Minimal working `frontend/.env.local`

```ini
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/
API_TOKEN=<same value as backend API_TOKEN>
```

---

## Cross-application consistency

| Backend | Frontend | Must match |
| ------- | -------- | ---------- |
| `API_TOKEN` | `API_TOKEN` | **Yes** — a mismatch makes every request fail with `Code: 5002`, "Invalid API Token" |
| server port (uvicorn `--port`) | host:port inside `NEXT_PUBLIC_API_URL` | **Yes** |

A mismatched token is the single most common setup failure and is easy to misread, because the backend
returns it with **HTTP 200**. See [../troubleshooting/common-issues.md](../troubleshooting/common-issues.md).

## Runtime mutation of `.env`

[`app/config/env.py`](../../backend/app/config/env.py) exposes `update_env_variable(key, value, env_file=".env")`,
which rewrites the `.env` file in place. **No code calls it** — it exists only with commented-out usage
examples. Be aware it exists before assuming `.env` is read-only at runtime.
