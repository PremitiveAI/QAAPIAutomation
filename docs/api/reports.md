# Reports API

Router: `resultRouter` (`/report`), defined in
[`app/routes/collection_routes.py`](../../backend/app/routes/collection_routes.py) and implemented in
[`TestCaseController`](../../backend/app/controllers/test_case_controller.py).

`report_id` and `api_id` are **plain integers** here, not encoded — unlike collection IDs.

---

## Summary

| Method | Path | Purpose | Data source |
| ------ | ---- | ------- | ----------- |
| POST | `/report/list` | Paginated list of test runs | `tbl_test_reports` |
| GET | `/report/details/{report_id}` | One run + its per-API rows | `tbl_test_reports` ⋈ `tbl_api_test_reports` ⋈ `tbl_api_endpoints` |
| GET | `/report/details/{report_id}/api/{api_id}` | Full per-scenario results | **JSON file on disk** |

Reports are two-tier: the database holds counts, the filesystem holds detail.

---

## POST `/report/list`

**Request** (`reportListReq`), all optional:

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `search` | string | `""` | `ILIKE %search%` on `collection_name` |
| `sort` | string | `"createdAt"` | Unknown names fall back to `createdAt` |
| `order` | string | `"DESC"` | |
| `limit` | int | **`5`** | Note: not 10 |
| `offset` | int | `0` | |

```json
{
  "Success": { "message": "fetched successfully",
    "data": { "count": 128,
      "result": [
        { "id": 42, "collection_id": "NQ==", "collection_name": "My API Collection",
          "total_apis": 12, "total_tests": 36, "total_passed": 30,
          "total_failed": 5, "total_errors": 1,
          "total_execution_time": 18432.11, "createdAt": "11-Feb-2026 07:05:52" } ] } },
  "Code": 0, "Error": null
}
```

`id` is the `report_id` to pass to the detail endpoints. `collection_id` is returned **encoded** even
though `report_id` is not.

> **`count` ignores the search filter.** It is computed as
> `db.query(TestReports).filter(TestReports.status == 1).count()` — the unfiltered total. When `search`
> is set, `count` overstates the number of matching rows and pagination based on it will over-page.
> The `/collections/list` endpoint does not have this problem.

Unlike the collection and API list endpoints, an empty result here is a **success** with an empty
`result` array, not a `404`.

---

## GET `/report/details/{report_id}`

Run header plus one row per endpoint, joined to `tbl_api_endpoints` for name, URL, method and body type.

```json
{
  "Success": { "message": "fetched successfully",
    "data": {
      "report": {
        "report_id": 42, "collection_id": "NQ==", "collection_name": "My API Collection",
        "total_apis": 12, "total_tests": 36, "total_passed": 30, "total_failed": 5,
        "total_errors": 1, "total_execution_time": 18432.11,
        "createdAt": "11-Feb-2026 07:05:52"
      },
      "result": [
        { "id": 501, "collection_id": "NQ==", "apiId": 101, "apiName": "Login",
          "method": "POST", "url": "{{base_url}}/auth/login", "body_type": "json",
          "test_total": 3, "test_passed": 3, "test_errors": 0, "test_failed": 0,
          "total_execution_time": 842.5, "createdAt": "11-Feb-2026 07:05:53" } ] } },
  "Code": 0, "Error": null
}
```

`Code: 4000` if the report does not exist.

The join is an inner join on `ApiTestReports.apiId == ApiEndpoint.id`, so **if an endpoint is hard-deleted
from the database its historical results disappear from this response**, while the header row keeps
counting them. Soft deletion (`status = -1`) preserves the join.

`report_id` passes through `decrypt_simple_id`, but because the route declares `report_id: int` FastAPI
has already coerced it, and the `isinstance(enc_id, int)` branch returns it unchanged. Plain integers are
therefore correct here — the opposite of the collection endpoints.

---

## GET `/report/details/{report_id}/api/{api_id}`

Returns the complete stored report for one endpoint within one run, **read from disk**.

### Behaviour

1. Load `tbl_test_reports` (`Code: 4000` if missing).
2. Load `tbl_api_endpoints` (`Code: 4000` if missing).
3. Load `tbl_api_test_reports` matching `(test_id, apiId, status=1)`.
4. Verify `test.test_report_file` exists on disk (`Code: 404` if not).
5. Parse the file and merge it into the response.

```json
{
  "Success": { "message": "fetched successfully",
    "data": {
      "id": 501, "collection_id": "NQ==", "apiId": 101, "body_type": "json",
      "environment": { "base_url": "https://api.example.com", "token": "eyJ..." },
      "summary": { "total": 3, "passed": 2, "failed": 1, "errors": 0 },
      "test_results": [
        {
          "test_name": "Valid login",
          "scenario_details": "Verify a successful login returns a token",
          "input_query": null,
          "input_request": { "mode": "raw", "raw": { "username": "demo" } },
          "input_headers": { "Content-Type": "application/json" },
          "actual_status": 200,
          "response_time_ms": 284.31,
          "validations": [
            { "validation": { "type": "status_code", "expected": 200 },
              "passed": true, "message": "Status: 200 (expected 200)" },
            { "validation": { "type": "json_validate", "path": "data.token", "operator": "exists" },
              "passed": true, "message": "data.token: exists" }
          ],
          "overall_result": "PASS",
          "response_body": { "data": { "token": "eyJ..." } },
          "timestamp": "2026-02-11 07:05:53"
        }
      ],
      "execution_time": "2026-02-11 07:05:53",
      "total_execution_time": 842.5
    } },
  "Code": 0, "Error": null
}
```

### `overall_result` values

| Value | Meaning |
| ----- | ------- |
| `PASS` | Every validation passed |
| `FAIL` | The request completed but at least one validation failed |
| `ERROR` | The request itself raised — timeout, DNS failure, connection refused. The entry carries `error_message` instead of `actual_status`, `response_time_ms`, `validations` and `response_body` |

### Two important caveats

**`environment` contains live secrets.** The block is the full `env_vars` map at the end of the run,
including any auth token a post-request script captured. This response is as sensitive as the system
under test.

**A missing row causes a 500.** Step 3 does not check for `None` before step 4 dereferences
`test.test_report_file`, so requesting a valid report with an `api_id` that was not part of that run
raises `AttributeError` → HTTP 500 with `Code: 5000`, rather than a clean not-found. See
[AUDIT.md](../../AUDIT.md) issue 12.

Other failures are handled: invalid JSON in the file returns `Code: 500` "The file contains invalid JSON
formatting"; any other exception returns `Code: 500` with the exception text.

---

## Storage layout

```
storage/collections/{collection_id}/test_report/{api_id}/report_{YYYYMMDD_HHMMSS}.json
```

One file per endpoint per run. `tbl_api_test_reports.test_report_file` stores the path as written at run
time.

Consequences worth planning for:

- **Paths are stored, not derived.** Moving `STORAGE_DIR` or relocating the project breaks every
  historical report; existing rows keep the old path.
- **Nothing prunes these files.** The repository already contains ~240 of them.
- **Database-only backups lose all report detail.** Back up `storage/` alongside PostgreSQL.
- Files are written with `json.dump(..., indent=4)`, so they are human-readable and can be inspected
  directly when debugging a run.

---

## Deletion

**There is no delete endpoint for reports.** `TestReports` and `ApiTestReports` both carry
`status`, `deletedBy` and `deletedAt` columns, but no route sets them. The delete buttons in the
`/report` UI remove rows from local component state only — the data returns on refresh.
