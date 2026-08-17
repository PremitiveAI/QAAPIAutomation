# Error Codes

The `Code` field is the **only reliable success/failure signal** — almost every response carries HTTP
200. `Code: 0` means success; anything else is a failure.

There is no central error-code registry in the source; the table below was assembled by tracing every
`error_response(...)`, `throw_error_response(...)` and `JSONResponse(...)` call in the backend.

---

## Complete code table

| Code | HTTP | Meaning | Raised by |
| ---: | ---: | ------- | --------- |
| `0` | 200 | Success | `success_response()` |
| `1` | 400 | Request validation failed (first Pydantic error only) | `RequestValidationError` handler in [`main.py`](../../backend/app/main.py) |
| `400` | 200 | Invalid encoded ID, or a file/type rejection | `decrypt_simple_id()`, `upload_environment_service()` |
| `404` | 200 | Resource not found | Collection, API list, environment lookups |
| `422` | 422 | Validation error with a `details` array | [`GlobalExceptionMiddleware`](../../backend/app/middlewares/exception_handler.py) |
| `500` | 200 | Handled internal failure (bad JSON in a report file, reorder failure) | Report and reorder handlers |
| `4000` | 200 | Business-rule failure — record missing or operation not possible | Test, report and scheduler controllers |
| `4001` | 200 | Some supplied API IDs were not found in the collection | `reorder_by_array_service()` |
| `4002` | 200 | No files uploaded | `POST /document/upload` |
| `4010` | 401 | Invalid or expired token | [`jwt_error_handler.py`](../../backend/app/middlewares/jwt_error_handler.py) — **no code path raises it** |
| `4030` | 200 | Name is required | `ProjectService`, `DocumentService` |
| `4040` | 200 | Record not found | `ProjectService`, `DocumentService`, `DocumentController` |
| `5000` | 500 | Unhandled server error | `GlobalExceptionMiddleware` |
| `5001` | 200 | `PK-apiToken` header missing | [`UserApiVerifyMiddleware`](../../backend/app/middlewares/auth_middleware.py) |
| `5002` | 200 | `PK-apiToken` incorrect | `UserApiVerifyMiddleware` |
| `5003` | — | Invalid or expired session | Defined in disabled session code — **unreachable** |
| `5004` | — | Session token mismatch | Defined in disabled session code — **unreachable** |
| `5010` | — | Account blocked by admin | Defined in disabled session code — **unreachable** |
| `5011` | — | Device blocked by admin | Defined in disabled session code — **unreachable** |

Codes `5003`, `5004`, `5010` and `5011` appear in `auth_middleware.py` inside `UserSessionVerifyMiddleware`
and `verify_session`, neither of which is registered. They can never be returned. See
[../security/authentication-and-authorization.md](../security/authentication-and-authorization.md).

---

## Numbering is not systematic

Be aware before writing client logic:

- **HTTP status codes are reused as application codes.** `400`, `404`, `422` and `500` appear as `Code`
  values alongside the `4xxx`/`5xxx` scheme.
- **`404` and `4040` both mean "not found"**, in different modules. Collections use `404`; projects and
  documents use `4040`.
- **`500` appears as a `Code` on HTTP-200 responses** (handled failures) and as a real HTTP status
  (unhandled exceptions, where `Code` is `5000`).
- **`5000` is both the default parameter of `error_response()`** and the unhandled-exception code, so an
  `error_response("...")` call that omits `code=` is indistinguishable from a crash.

Match on the pair `(Code, message)` when precision matters, and treat any non-zero `Code` as a failure.

---

## Worked examples

**Missing token**

```json
{ "Success": null, "Code": 5001, "Error": { "message": "API Token required" } }
```

**Wrong token** — the most common setup mistake:

```json
{ "Success": null, "Code": 5002, "Error": { "message": "Invalid API Token" } }
```

**Plain integer where an encoded ID is required**

```json
{ "Success": null, "Code": 400,
  "Error": { "message": "Invalid collection_id format. Please use encrypted id." } }
```

**Empty result treated as an error** — note that an empty list is a `404`, not an empty success:

```json
{ "Success": null, "Code": 404, "Error": { "message": "No collections found" } }
```

```json
{ "Success": null, "Code": 404, "Error": { "message": "No APIs found for collection id TQ==" } }
```

**Pydantic rejection** (HTTP 400, only the first error):

```json
{ "Success": null, "Code": 1, "Error": { "message": "Field required" } }
```

**Unhandled exception** (HTTP 500):

```json
{ "Success": null, "Code": 5000, "Error": { "message": "Rajesh Internal server error" } }
```

> The message string is a debug artefact left in
> [`exception_handler.py:37`](../../backend/app/middlewares/exception_handler.py). It is returned to end
> users. See [AUDIT.md](../../AUDIT.md) issue 26.

---

## Recommended client handling

```ts
type Envelope<T> = {
  Success: { message?: string; data?: T } | null;
  Code: number;
  Error: { message: string } | null;
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  // Real transport/server failures still surface here (500, 400, 422)
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const body: Envelope<T> = await res.json();

  // The important check: everything else arrives as HTTP 200
  if (body.Code !== 0) throw new Error(body.Error?.message ?? `Code ${body.Code}`);

  return body.Success?.data as T;   // may be undefined — Success can be {}
}
```

Treat "empty result" codes (`404` on list endpoints) as a normal empty state rather than an error, if
your UI distinguishes the two.
