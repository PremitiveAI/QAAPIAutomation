# Backend Architecture

FastAPI application in [`backend/app/`](../../backend/app/), organised in an MVC-with-services layout.

## Directory layout

```
backend/app/
├── main.py               FastAPI instance, middleware, routers, startup hooks
├── config/env.py         dotenv loader + env() getter + update_env_variable()
├── database/connection.py engine, SessionLocal, Base, get_db, slow-query listener
├── docs/swagger_headers.py Header dependencies shown in Swagger
├── middlewares/          auth, exception, jwt_error, request_logger
├── routes/               APIRouter definitions
├── controllers/          request handling, ID decoding, response shaping
├── services/             business logic
├── repositories/         data access (scheduler only; others query inline)
├── models/               8 SQLAlchemy models
├── schemas/              Pydantic request models
├── scheduler/            APScheduler wiring
├── utils/                15 helpers
└── core/prompts.py       vision prompts — unused
```

## Layering

The intended chain is `route → controller → service → repository → model`. In practice the layers are
applied unevenly, and this is worth knowing before you go looking for a repository that does not exist:

| Module | Route | Controller | Service | Repository |
| ------ | :---: | :--------: | :-----: | :--------: |
| Collections | ✅ | ✅ | ✅ | ✗ — services query models directly |
| Environments | ✅ | ✅ | ✅ | ✗ |
| APIs | ✅ | ✅ | ✗ — controller queries directly | ✗ |
| Test cases | ✅ | ✅ | ✅ | ✗ |
| Reports | ✅ | ✅ | ✗ — controller queries directly | ✗ |
| Scheduler | ✅ | ✅ | ✗ | ✅ [`scheduler_repo.py`](../../backend/app/repositories/scheduler_repo.py) |
| Projects | ✅ | ✅ | ✅ | ✗ |
| Documents | ✅ | ✅ | ✅ | ✗ |

One endpoint bypasses the chain entirely: `POST /project/execute-and-save/{collection_id}` is implemented
inline in [`app/routes/project_routes.py:121-188`](../../backend/app/routes/project_routes.py) and is the
only endpoint that raises `HTTPException` directly rather than returning the standard envelope.

## Entry point

[`app/main.py`](../../backend/app/main.py):

```python
app = FastAPI()

app.add_middleware(request_logger.RequestLoggingMiddleware)
app.add_middleware(auth_middleware.UserApiVerifyMiddleware)
exception_handler.register_exception_handlers(app)
jwt_error_handler.register_jwt_error_handler(app)

app.include_router(projectRouter)      # /project
app.include_router(documentRouter)     # /document
app.include_router(collectionRouter)   # /collections
app.include_router(environmentRouter)  # /environment
app.include_router(apiRouter)          # /api
app.include_router(testRouter)         # /api-test
app.include_router(resultRouter)       # /report
app.include_router(schedulerRouter)    # /scheduler

@app.on_event("startup")
def startup_event(): create_all_tables()

@app.on_event("startup")
def start(): start_scheduler()

app.mount("/storage", StaticFiles(directory="storage"), name="storage")
```

Notes:

- `FastAPI()` is constructed with **no title, version or description**, so `/docs` is untitled.
- `login_routes` exists but is **not imported** — see
  [authentication-and-authorization.md](../security/authentication-and-authorization.md).
- Two separate `@app.on_event("startup")` handlers are registered; both run. `on_event` is deprecated in
  current FastAPI in favour of lifespan handlers.
- `StaticFiles(directory="storage")` uses a **relative path**, so the backend must be started from the
  `backend/` directory.
- Roughly 190 lines of commented-out experiments (a BeautifulSoup form filler, a Playwright auto-filler)
  follow the active code.

## Middleware

### `UserApiVerifyMiddleware`

[`app/middlewares/auth_middleware.py`](../../backend/app/middlewares/auth_middleware.py). The only
enforced access control in the system.

```python
if request.url.path.startswith("/storage"):  return await call_next(request)
if request.url.path in ALLOWED_PATHS:        return await call_next(request)

api_token = request.headers.get("PK-apiToken")
if not api_token:                    return error_response("API Token required", code=5001)
if api_token != env('API_TOKEN'):    return error_response("Invalid API Token", code=5002)

request.state.country      = request.headers.get("PK-country",  env("DEFAULT_COUNTRY", "IN"))
request.state.timezone     = request.headers.get("PK-timezone", env("DEFAULT_TZ", "Asia/Kolkata"))
request.state.dialing_code = 1 if request.state.country == "CA" else 91
request.state.base_url     = str(request.base_url).rstrip("/")
```

`UserSessionVerifyMiddleware` and `verify_session` also live in this file but are never registered and
reference an unassigned `auth` variable.

### `RequestLoggingMiddleware`

[`app/middlewares/request_logger.py`](../../backend/app/middlewares/request_logger.py). Reads the request
body, rebuilds the request so downstream handlers can read it again, consumes the response body iterator,
rebuilds the response, then writes a single JSON line to `logs/requests.log` containing method, path,
status, duration, client IP, request body and response body.

Bodies are passed through `mask_sensitive()`, which only replaces top-level JSON keys named `password`,
`otp`, `panaadhaar_number` or `pan_number`. See [AUDIT.md](../../AUDIT.md) issue 6.

### `GlobalExceptionMiddleware`

[`app/middlewares/exception_handler.py`](../../backend/app/middlewares/exception_handler.py). Catches
`RequestValidationError` → HTTP 422, and any other exception → HTTP 500 with `Code: 5000`. Logs the full
traceback to `logs/errors.log`.

### JWT handler

[`app/middlewares/jwt_error_handler.py`](../../backend/app/middlewares/jwt_error_handler.py) registers an
exception handler for `jose.JWTError` returning HTTP 401 / `Code: 4010`. No code path currently raises it.

## Response envelope

[`app/utils/response.py`](../../backend/app/utils/response.py) defines three helpers:

```python
success_response(message=None, data=None, code=0)   # HTTP 200
error_response(message="Error", code=5000)          # HTTP 200  ← note
throw_error_response(message, code=5000)            # raises HTTPException(status_code=200)
```

```json
{ "Success": { "message": "...", "data": {} }, "Code": 0,    "Error": null }
{ "Success": null,                             "Code": 4000, "Error": { "message": "..." } }
```

`success_response` omits `message` and `data` from the payload when they are falsy, so an empty result
yields `"Success": {}`. Frontend code must not assume `Success.data` exists.

The only responses that are **not** HTTP 200 are the 422 and 500 produced by the exception middleware,
the 400 from the `RequestValidationError` handler in `main.py`, the 401 from the JWT handler, and the
raw `HTTPException`s raised by `validate_json_file` and `execute-and-save`.

## Validation

Two layers:

1. **Pydantic**, in [`app/schemas/`](../../backend/app/schemas/). The richest is
   [`api_schema.py`](../../backend/app/schemas/api_schema.py), which uses a discriminated union on `mode`
   to validate request bodies as `raw`, `urlencoded` or `formdata`, with `model_validator`s enforcing
   per-mode rules (e.g. a `file` item must carry `src` and must not carry `value`). `SaveAPIReq` also
   rejects a body on `GET` or `DELETE`.
2. **Manual checks** in controllers and services — file extension and MIME checks in
   [`file_validation.py`](../../backend/app/utils/file_validation.py), existence checks before updates,
   and ID-format checks via `decrypt_simple_id`.

A Pydantic failure is intercepted by the handler in `main.py` and returned as HTTP 400 with only the
**first** error message:

```json
{ "Success": null, "Code": 1, "Error": { "message": "field required" } }
```

## ID encoding

[`app/utils/crypto.py`](../../backend/app/utils/crypto.py) provides:

| Function | Behaviour |
| -------- | --------- |
| `encrypt_simple_id(id)` | `base64.urlsafe_b64encode(str(id))` — obfuscation, not encryption |
| `decrypt_simple_id(enc, field)` | returns `(value, None)` or `(None, error_response)`; **rejects plain digits**, forcing callers to use the encoded form |
| `encrypt_data(dict)` / `decrypt_data(token)` | Fernet, keyed from `TOKEN_SECRET`. Unused by active paths |

Collection IDs are encoded; API IDs, report IDs, project IDs and document IDs are plain integers. This
asymmetry is why `/report/details/{report_id}` takes an `int` while `/api-test/run/{collection_id}` takes
a string.

## Database layer

[`app/database/connection.py`](../../backend/app/database/connection.py):

- Builds the URL as `postgresql+psycopg2://…`, URL-quoting the password.
- `create_engine(..., pool_pre_ping=True)`.
- `test_connection()` runs at **import time** and prints a ✅/❌ line.
- `auto_import_models()` walks `app.models` with `pkgutil` so every model registers on `Base` without an
  explicit import list.
- `create_all_tables()` calls `Base.metadata.create_all(bind=engine)` — creates missing tables, never
  alters existing ones.
- Two SQLAlchemy event listeners time every cursor execution and log anything over **300 ms** to
  `logs/slow_queries.log`.
- `get_db()` is the FastAPI dependency, yielding a session and closing it in `finally`.

## Logging

[`app/utils/logger.py`](../../backend/app/utils/logger.py) returns a named logger writing to
`logs/{name}.log` with a `TimedRotatingFileHandler` rotating at midnight, `backupCount=1`, and
`propagate = False` so nothing reaches the console.

| Logger | File | Written by |
| ------ | ---- | ---------- |
| `requests` | `logs/requests.log` | `RequestLoggingMiddleware` |
| `errors` | `logs/errors.log` | `GlobalExceptionMiddleware` |
| `slow_queries` | `logs/slow_queries.log` | the SQLAlchemy listeners |
| `app.scheduler.scheduler` | `logs/app.scheduler.scheduler.log` | scheduler startup |

Much of the runtime diagnostics elsewhere uses bare `print()` rather than a logger.

## Background processing

There is one background mechanism: APScheduler, running inside the FastAPI process.

```python
jobstores = {"default": SQLAlchemyJobStore(engine=engine)}
executors = {"default": ThreadPoolExecutor(max_workers=10)}
job_defaults = {"coalesce": True, "max_instances": 1, "misfire_grace_time": 30}
scheduler = BackgroundScheduler(..., timezone="Asia/Kolkata")
```

The job store shares the application's PostgreSQL engine, so APScheduler creates and manages its own
`apscheduler_jobs` table alongside the application tables. See
[../features/scheduler.md](../features/scheduler.md).

## External integrations

| Integration | Module | Notes |
| ----------- | ------ | ----- |
| Google Gemini (text) | [`test_case_llm.py`](../../backend/app/utils/test_case_llm.py) | Test-scenario generation. Raises at import if `GOOGLE_API_KEY` is unset |
| Google Gemini (vision) | [`kyc_document_parser.py`](../../backend/app/utils/kyc_document_parser.py) | OCR for scanned pages and images |
| Target systems under test | [`test_case_service.py`](../../backend/app/services/test_case_service.py) | `requests.request(...)` with a hard-coded 10-second timeout |

Both Gemini modules also construct a `GoogleGenerativeAIEmbeddings` client that is never used.
