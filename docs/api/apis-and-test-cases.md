# APIs and Test Cases API

Routers: `apiRouter` (`/api`) and `testRouter` (`/api-test`), defined in
[`app/routes/collection_routes.py`](../../backend/app/routes/collection_routes.py).

`{collection_id}` is base64-encoded; `api_id` and `apiId` are plain integers.

---

## Summary

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/{collection_id}/apis` | List endpoints in a collection |
| GET | `/api/{collection_id}/apis/{api_id}` | Full detail for one endpoint |
| POST | `/api/{collection_id}/apis` | Update one endpoint |
| POST | `/api-test/generation` | Generate test scenarios with Gemini |
| POST | `/api-test/save` | Persist test scenarios |
| GET | `/api-test/run/{collection_id}` | Execute the whole collection |

---

## GET `/api/{collection_id}/apis`

Ordered by `api_order ASC, updatedAt DESC`.

```json
{
  "Success": { "message": "API list fetched successfully",
    "data": [
      { "id": 101, "api_order": 1, "name": "Login", "method": "POST",
        "url": "{{base_url}}/auth/login",
        "headers": { "Content-Type": "application/json" },
        "query_params": null,
        "request_body": { "mode": "raw", "raw": { "username": "{{user}}" } },
        "response_body": { "token": "..." } } ] },
  "Code": 0, "Error": null
}
```

An empty collection returns `Code: 404`, "No APIs found for collection id …" — an error, not an empty
array. The list omits `pre_request_script`, `post_request_script`, `test_scenario` and `body_type`; fetch
a single endpoint for those.

> This endpoint returns **all** endpoints regardless of `status`, while a test run selects only
> `status = 1`. A soft-deleted endpoint therefore appears in the UI but is skipped when running.

---

## GET `/api/{collection_id}/apis/{api_id}`

Adds the fields the workbench needs:

```json
{
  "Success": { "message": "API fetched successfully",
    "data": {
      "id": 101, "collection_id": "NQ==", "api_order": 1,
      "name": "Login", "method": "POST", "url": "{{base_url}}/auth/login",
      "headers": { "Content-Type": "application/json" },
      "query_params": null,
      "request_body": { "mode": "raw", "raw": { "username": "{{user}}" } },
      "response_body": { "token": "..." },
      "pre_request_script": { "listen": "prerequest", "script": { "exec": ["pm.environment.set('ts', Date.now());"] } },
      "post_request_script": { "listen": "test", "script": { "exec": ["pm.environment.set('token', pm.response.json().token);"] } },
      "test_scenario": [ { "scenario_name": "Valid login", "scenario_details": "…",
                           "query_params": {}, "request": {},
                           "response": [ { "type": "status_code", "expected": 200 } ] } ],
      "createdAt": "11-Feb-2026 07:05:52"
    } },
  "Code": 0, "Error": null
}
```

Ownership is enforced — an `api_id` from another collection returns `Code: 404`.

> `body_type` is **not** included in this response even though it is stored, so the workbench re-derives
> the editor mode from the shape of `request_body` and `query_params`. See
> [../features/api-editor.md](../features/api-editor.md).

---

## POST `/api/{collection_id}/apis`

Updates one endpoint. Validated by `SaveAPIReq` in
[`app/schemas/api_schema.py`](../../backend/app/schemas/api_schema.py) — the strictest schema in the
codebase.

### Request

```json
{
  "apiId": 101,
  "name": "Login",
  "url": "{{base_url}}/auth/login",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "query_params": { "mode": "query", "query": [ { "key": "verbose", "value": "1" } ] },
  "request_body": { "mode": "raw", "raw": { "username": "{{user}}" } },
  "pre_request_script": { "listen": "prerequest", "script": { "exec": ["// js"] } },
  "post_request_script": { "listen": "test", "script": { "exec": ["// js"] } },
  "test_scenario": []
}
```

Only `apiId` is mandatory; every other field is optional and omitted fields are left unchanged.

### Body validation

`request_body` is a discriminated union on `mode`:

| `mode` | Rules |
| ------ | ----- |
| `raw` | `raw` must be a **non-empty JSON object**. Strings, arrays and `{}` are rejected |
| `urlencoded` | `urlencoded` must be a non-empty list; every `key` non-empty; each item's `type` is `"text"` |
| `formdata` | `formdata` mandatory and non-empty; every `key` non-empty. A `text` item **requires `value` and must not carry `src`**; a `file` item **requires `src` (list of paths) and must not carry `value`** |

Cross-field rule:

```python
if self.method in {"GET", "DELETE"} and self.request_body:
    raise ValueError(f"HTTP method '{self.method}' does not support request body")
```

`query_params` requires `mode: "query"` with a non-empty `query` array of non-empty keys.
`pre_request_script.listen` must be `"prerequest"`; `post_request_script.listen` must be `"test"`.

Validation failures return **HTTP 400** with only the first message:

```json
{ "Success": null, "Code": 1, "Error": { "message": "raw body cannot be empty" } }
```

### Server-side allow-list

```python
ALLOWED_FIELDS = {"name", "method", "url", "headers", "query_params", "request_body",
                  "pre_request_script", "post_request_script", "test_scenario"}
```

`None` values are skipped. If nothing remains, the call fails with `"No fields provided for update"`.

The response echoes the persisted values. `Code: 4000` if `apiId` does not exist.

---

## POST `/api-test/generation`

Calls Google Gemini to propose test scenarios. **Does not persist anything.**

**Request** (`generationTestCateReq`): `{ "apiId": 101, "comment": "Cover valid login, wrong password, and a missing username" }`

Both fields are required. `comment` is free text passed to the model as the client description.

```json
{
  "Success": { "message": "fetched successfully",
    "data": {
      "apiId": 101, "name": "Login", "url": "{{base_url}}/auth/login", "method": "POST",
      "body_type": "json",
      "headers": { }, "query_params": { }, "request_body": { }, "response_body": { },
      "has_env_vars": true,
      "test_scenarios": {
        "test_scenario": [
          { "scenario_name": "Valid login",
            "scenario_details": "Verify a successful login returns a token",
            "query_params": {},
            "request": { "mode": "raw", "raw": { "username": "{{user}}" } },
            "response": [ { "type": "status_code", "expected": 200 },
                          { "type": "response_time_lt", "expected": 500 },
                          { "type": "json_validate", "path": "data.token", "operator": "exists" } ] } ] } } },
  "Code": 0, "Error": null
}
```

Note the double nesting: `data.test_scenarios.test_scenario`. The frontend reads
`data?.Success?.data?.test_scenarios?.test_scenario`.

Failure modes:

- `Code: 4000` if `apiId` does not exist.
- If Gemini returns unparseable output, `generate_test_cases` returns `{"test_scenario": []}` — a
  **successful** response with an empty array, not an error.
- Network or quota failures from the Gemini client propagate to the global handler as HTTP 500.

Validation-rule semantics and the operator support gap are documented in
[../features/ai-test-generation.md](../features/ai-test-generation.md).

---

## POST `/api-test/save`

**Request** (`saveTestCateReq`): `{ "apiId": 101, "testCase": [ … ] }`

`testCase` is typed `List[Dict]` — **the scenario contents are not validated**. Whatever you send is
written verbatim to `tbl_api_endpoints.test_scenario`, replacing the previous array. Sending `[]` clears
all scenarios, which is how the workbench's reset button works.

```json
{ "Success": { "message": "fetched successfully",
               "data": { "apiId": 101, "updated_data": [ … ] } },
  "Code": 0, "Error": null }
```

Because there is no schema here, a malformed scenario is accepted at save time and only fails during a
run — where a missing `scenario_name` raises `KeyError` and is recorded as an ERROR result.

---

## GET `/api-test/run/{collection_id}`

Executes every active endpoint in the collection, in `api_order`, and returns aggregate results. This is
a **synchronous** call — it does not return until every scenario of every endpoint has finished.

### Behaviour

1. Decode `collection_id`; load the collection (`Code: 4000` if missing).
2. Select endpoints `WHERE collection_id = … AND status = 1 ORDER BY api_order ASC`.
3. Insert a `tbl_test_reports` header row.
4. For each endpoint, run every scenario (or a synthesised default asserting `status_code == 200`).
5. Bulk-insert one `tbl_api_test_reports` row per endpoint.
6. Update the header row with the totals.

```json
{
  "Success": { "message": "Test case run successfully",
    "data": { "report_id": 42, "collection_id": "NQ==", "collection_name": "My API Collection",
              "total_apis": 12, "total_tests": 36, "total_passed": 30,
              "total_failed": 5, "total_errors": 1, "total_execution_time": 18432.11 } },
  "Code": 0, "Error": null
}
```

`total_execution_time` is wall-clock milliseconds for the whole run.

### Practical notes

- **Duration is unbounded.** Each request has a 10-second timeout, so a 50-endpoint collection with three
  scenarios each can take minutes. There is no progress reporting, no cancellation and no async job — the
  browser holds the connection open. The Next.js BFF `fetch` has no explicit timeout, but platform
  defaults may cut it off before the backend finishes.
- **The run mutates state.** Post-request scripts write back to `tbl_collections.env_vars`.
- **`total_apis` counts endpoints that produced a report**, which can be lower than the number selected
  if `execute_tests` returned nothing for some.

Engine detail: [../features/test-execution-engine.md](../features/test-execution-engine.md).
