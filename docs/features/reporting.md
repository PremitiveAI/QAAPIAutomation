# Feature — Reporting

## Overview

Three levels of visibility into test runs: a list of all runs, a breakdown of one run by endpoint, and
the full per-scenario detail for a single endpoint within that run.

**Status:** Implemented (read-only — there is no delete).

## Business purpose

Execution without evidence is not testing. Reports answer *what ran*, *what broke*, *what the server
actually returned* and *how long it took* — the artefacts a QA process needs.

## User flow

1. **Report** in the sidebar → `/report`, an infinite-scrolling list of runs.
2. Click a run → `/test_result/{reportId}`, one row per endpoint with pass/fail counts.
3. Click an endpoint → per-scenario detail: every validation, the request sent, the response received.

A run also lands here directly: `executeRun()` redirects to `/test_result/{report_id}` on completion.

## Three tiers

| Tier | Endpoint | Source | Contains |
| ---- | -------- | ------ | -------- |
| Run list | `POST /report/list` | `tbl_test_reports` | Collection name, totals, duration, timestamp |
| Run detail | `GET /report/details/{rid}` | `tbl_test_reports` ⋈ `tbl_api_test_reports` ⋈ `tbl_api_endpoints` | Per-endpoint counts, name, method, URL |
| Endpoint detail | `GET /report/details/{rid}/api/{aid}` | **JSON file on disk** | Per-scenario validations, request, response, environment |

The split matters operationally: the database holds counts, the filesystem holds evidence. See
[Storage](#storage).

## Frontend flow

```
/report
  → POST /api/reportList { search:"", sort:"createdAt", order:"DESC", limit:10, offset }
  → json.Code !== 0 → toast; else append json.Success.data.result
  → infinite scroll increments offset by LIMIT

/test_result/[reportId]
  → GET /api/reportDetails/{reportId}                     → report header + per-endpoint rows
  → on endpoint click:
      GET /api/reportDetails/{reportId}/api/{apiId}       → full scenario detail
```

`/report` is one of the few pages that checks `json?.Code !== 0` rather than only `res.ok` — the correct
pattern given that errors arrive with HTTP 200.

## Backend flow

All three handlers live in
[`TestCaseController`](../../backend/app/controllers/test_case_controller.py) and query models directly —
there is no report service or repository layer.

```
get_report_list      → filter status=1 → optional ILIKE on collection_name → sort → offset/limit → count
get_report_details   → SELECT report → JOIN ApiTestReports ⋈ ApiEndpoint on apiId → format
get_api_test_report  → SELECT report, endpoint, api-test row → os.path.exists → open → json.load → merge
```

## API details

Full request/response documentation: [../api/reports.md](../api/reports.md).

## Report metrics

| Field | Meaning |
| ----- | ------- |
| `total_apis` | Endpoints that produced a report row |
| `total_tests` | Scenarios executed across all endpoints |
| `total_passed` | Scenarios where every validation passed |
| `total_failed` | Scenarios with at least one failed validation |
| `total_errors` | Scenarios where the request itself raised |
| `total_execution_time` | Wall-clock milliseconds for the whole run |

`total_tests = total_passed + total_failed + total_errors`. Note that `total_apis` counts endpoints that
*reported*, which can be fewer than the endpoints selected for the run.

At the endpoint level the same metrics appear as `test_total`, `test_passed`, `test_failed`,
`test_errors`.

## Per-scenario detail

```json
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
      "passed": true, "message": "Status: 200 (expected 200)" }
  ],
  "overall_result": "PASS",
  "response_body": { "data": { "token": "eyJ..." } },
  "timestamp": "2026-02-11 07:05:53"
}
```

`input_request` is the **raw** scenario request as stored — before `{{variable}}` substitution — while
`input_headers` is the **processed** version, after substitution. The two are inconsistent, which matters
when debugging a substitution problem: the body you see is not the body that was sent.

An `ERROR` entry replaces `actual_status`, `response_time_ms`, `validations` and `response_body` with a
single `error_message`.

## Storage

```
STORAGE_DIR/collections/{collection_id}/test_report/{api_id}/report_{YYYYMMDD_HHMMSS}.json
```

`tbl_api_test_reports.test_report_file` stores the path as written at run time.

| Consequence | Detail |
| ----------- | ------ |
| Paths are absolute-ish and stored, not derived | Moving `STORAGE_DIR` breaks every historical report |
| Nothing prunes them | ~240 files already exist in the repository |
| Database-only backups lose all detail | Back up `storage/` with PostgreSQL |
| Files are `indent=4` JSON | Directly readable when debugging |

## Database interaction

| Table | Operation |
| ----- | --------- |
| `tbl_test_reports` | SELECT (list, detail) |
| `tbl_api_test_reports` | SELECT (detail) |
| `tbl_api_endpoints` | JOIN for name/URL/method/body_type |

Reporting performs **no writes**.

## Authentication

`PK-apiToken` only. Any token holder can read every report of every collection — including the
`environment` block, which contains live credentials captured during the run.

## Error handling

| Situation | Result |
| --------- | ------ |
| Report not found | `Code: 4000` |
| Endpoint not found | `Code: 4000` |
| Report file missing on disk | `Code: 404`, "File not found at …" |
| Report file is malformed JSON | `Code: 500`, "The file contains invalid JSON formatting" |
| **Valid report, `api_id` not part of that run** | **HTTP 500** — `AttributeError`. [AUDIT.md](../../AUDIT.md) issue 12 |

## Dependencies

None beyond the standard library — `os.path` and `json` for file access.

## Known limitations

1. **`count` on `/report/list` ignores the search filter.** It is the unfiltered total, so paginating a
   filtered list over-pages. [../api/reports.md](../api/reports.md#post-reportlist).

2. **No delete.** `status`, `deletedBy` and `deletedAt` exist on both report tables but no endpoint sets
   them. The delete buttons in `/report` mutate local state only; the rows return on refresh.

3. **A 500 instead of a 404** for a mismatched `api_id`.

4. **Reports contain live secrets** in the `environment` block.

5. **Hard-deleting an endpoint destroys its history.** The join is an inner join and the FK cascades, so
   historical rows vanish while the parent run keeps counting them.

6. **No aggregation across runs** — no trend charts, no pass-rate over time, no flakiness detection. Each
   run is an island. (`recharts` is installed but unused for reports.)

7. **No export.** No CSV, JUnit XML or HTML output, so results cannot feed a CI pipeline.

8. **Scheduled and manual runs are indistinguishable** — `tbl_test_reports` has no link to
   `tbl_scheduler_jobs`.

9. **`/schedulerReport/[id]` cannot load**, because `GET /scheduler/{id}/reports` does not exist.
   [AUDIT.md](../../AUDIT.md) issue 16.

10. **`input_request` is pre-substitution while `input_headers` is post-substitution**, which obscures
    exactly the class of bug reports are most often used to diagnose.
