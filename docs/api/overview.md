# API Overview

Conventions that apply to every endpoint. Read this before the individual references.

**Base URL:** `http://127.0.0.1:8000/` in local development (`BASE_URL` in `backend/.env`).

> Swagger UI at `/docs` lists paths but declares no response models, summaries or descriptions —
> `FastAPI()` is constructed without metadata. These documents are the authoritative reference.
> See [AUDIT.md](../../AUDIT.md) issue 3b.

---

## Authentication

Every endpoint except `/`, `/docs`, `/redoc`, `/openapi.json` and anything under `/storage` requires:

```
PK-apiToken: <value of API_TOKEN from backend/.env>
```

This is a **single shared application token**, not a user credential. There are no users, roles,
sessions or per-record authorization — any caller holding the token can read and modify every record.
See [../security/authentication-and-authorization.md](../security/authentication-and-authorization.md).

### Headers

| Header | Required | Default | Effect |
| ------ | -------- | ------- | ------ |
| `PK-apiToken` | **Yes** | — | Rejected with `5001` if absent, `5002` if wrong |
| `PK-country` | No | `IN` | Sets `request.state.country`; `dialing_code` becomes `1` for `CA`, else `91` |
| `PK-timezone` | No | `Asia/Kolkata` | Sets `request.state.timezone` |
| `PK-role` | No | `User` | Declared in Swagger, **never read for any decision** |
| `PK-deviceid` | No | — | Declared in Swagger, never read |
| `PK-sessionToken` | No | — | Declared on session routes, all of which are disabled |

The Next.js BFF layer sends `PK-apiToken`, `PK-role`, `PK-country` and `PK-timezone` on every call.

---

## Response envelope

Every endpoint returns the same three-key structure.

**Success**

```json
{
  "Success": { "message": "Collection list fetched successfully", "data": { } },
  "Code": 0,
  "Error": null
}
```

**Error**

```json
{
  "Success": null,
  "Code": 4000,
  "Error": { "message": "Collection with ID abc not found" }
}
```

### Errors are returned with HTTP 200

This is the single most important convention in the API. `error_response()` in
[`app/utils/response.py`](../../backend/app/utils/response.py) returns
`JSONResponse(status_code=200, ...)`.

```js
// ❌ Wrong — this branch is almost never taken
if (!res.ok) handleError();

// ✅ Correct
const json = await res.json();
if (json.Code !== 0) handleError(json.Error.message);
```

Load balancers, uptime monitors and generic retry logic cannot distinguish success from failure without
parsing the body. Tracked as [AUDIT.md](../../AUDIT.md) issue 9.

### Exceptions to the envelope

Four paths return a real non-200 status:

| Status | Source | Shape |
| -----: | ------ | ----- |
| 400 | `RequestValidationError` handler in `main.py` | Envelope with `Code: 1`, first error message only |
| 422 | `GlobalExceptionMiddleware` | Envelope with `Code: 422` and a `details` array |
| 500 | `GlobalExceptionMiddleware` | Envelope with `Code: 5000` |
| 401 | `JWTError` handler | Envelope with `Code: 4010`. No code path raises it |

Additionally, `validate_json_file()` and `POST /project/execute-and-save/{id}` raise FastAPI
`HTTPException`s, producing the default `{"detail": "..."}` shape rather than the envelope.

### `Success` may be an empty object

`success_response` omits falsy fields:

```python
if message: success_content["message"] = message
if data:    success_content["data"] = data
```

An empty list or `{}` is falsy, so `"Success": {}` is possible. Never assume `Success.data` exists.

---

## Identifier encoding

Collection IDs are base64-encoded in transit; other IDs are plain integers.

```python
encrypt_simple_id(5)      # "NQ=="
decrypt_simple_id("NQ==") # (5, None)
decrypt_simple_id("5")    # (None, <error: use encrypted id>)
```

`decrypt_simple_id` **explicitly rejects plain digit strings**, so passing a raw integer where an encoded
ID is expected returns:

```json
{ "Success": null, "Code": 400, "Error": { "message": "Invalid collection_id format. Please use encrypted id." } }
```

| Identifier | Form | Endpoints |
| ---------- | ---- | --------- |
| `collection_id` | **Encoded** | `/collections/*`, `/environment/*`, `/api/*`, `/api-test/run/*` |
| `api_id` | Plain integer | `/api/{cid}/apis/{api_id}`, `/report/details/{rid}/api/{api_id}` |
| `report_id` | Plain integer | `/report/details/*` |
| `scheduler_id` | Plain integer | `/scheduler/delete/*` |
| `project_id`, `document_id` | Plain integer | `/project/*`, `/document/*` |

This is **obfuscation, not access control** — base64 is trivially reversible and IDs remain enumerable.

---

## List endpoints

Six endpoints accept a common list payload. Every field is optional.

```json
{
  "search":    "",
  "sort":      "createdAt",
  "order":     "DESC",
  "limit":     10,
  "offset":    0,
  "startDate": null,
  "endDate":   null,
  "filter":    null
}
```

| Field | Behaviour |
| ----- | --------- |
| `search` | Case-insensitive `ILIKE %value%` on the module's name column |
| `sort` | Column name, resolved via `getattr(Model, sort, Model.createdAt)` — an unknown name silently falls back to `createdAt` |
| `order` | `"DESC"` or anything else (treated as ascending) |
| `limit` / `offset` | SQL `LIMIT` / `OFFSET`. Defaults vary: 10 for collections/projects/documents, 5 for reports/schedulers |
| `startDate` / `endDate` | ISO-8601, collections only. Unparseable values are ignored silently, and the literal string `"string"` is skipped explicitly |

Responses report totals inconsistently — `total` for collections and schedulers, `count` for reports,
projects and documents. Per-endpoint shapes are documented in each reference.

---

## Endpoint groups

| Group | Prefix | Count | Reference |
| ----- | ------ | ----: | --------- |
| Collection Management | `/collections` | 5 | [collections-and-environments.md](collections-and-environments.md) |
| Environment Management | `/environment` | 3 | [collections-and-environments.md](collections-and-environments.md) |
| APIs Management | `/api` | 3 | [apis-and-test-cases.md](apis-and-test-cases.md) |
| Test Case Management | `/api-test` | 3 | [apis-and-test-cases.md](apis-and-test-cases.md) |
| Report Management | `/report` | 3 | [reports.md](reports.md) |
| Scheduler Management | `/scheduler` | 3 | [scheduler.md](scheduler.md) |
| Project Management | `/project` | 5 | [projects-and-documents.md](projects-and-documents.md) |
| Document Management | `/document` | 5 | [projects-and-documents.md](projects-and-documents.md) |
| Root | `/` | 1 | Returns `{"message": "FastAPI MVC Running"}` |

**Total: 31 endpoints.**

---

## Content types

| Situation | Content-Type |
| --------- | ------------ |
| Most requests | `application/json` |
| `POST /collections/upload` | `multipart/form-data`, field `file` |
| `POST /environment/{cid}/environment/upload` | `multipart/form-data`, field `file` |
| `POST /document/upload` | `multipart/form-data`, field `files` (repeatable) + `project_id` query parameter |
| All responses | `application/json` |

---

## Timestamps

Stored in UTC (`datetime.utcnow`), returned as IST-formatted strings via model properties:

```python
self.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S")   # "11-Feb-2026 07:05:52"
```

`IST` is a hard-coded `timezone(timedelta(hours=5, minutes=30))`. The `TIMEZONE` and `DATE_FORMAT`
environment variables are **not** consulted. Responses carry no timezone marker, so clients must know the
offset out of band.

---

## No CORS

The backend registers no CORS middleware and needs none — the browser only ever calls same-origin
Next.js route handlers. Calling FastAPI directly from a browser on another origin will fail; call it
server-side or from a tool like curl or Postman.

---

## Rate limiting, versioning, pagination metadata

None implemented. There is no rate limiter, no `/v1` prefix (the unused `API_VERSION` variable
notwithstanding), and no `Link` or cursor-based pagination — only `limit`/`offset` with a total count.
