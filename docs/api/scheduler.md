# Scheduler API

Router: `schedulerRouter` (`/scheduler`), implemented in
[`scheduler_controller.py`](../../backend/app/controllers/scheduler_controller.py) and
[`scheduler_repo.py`](../../backend/app/repositories/scheduler_repo.py).

Behaviour of the scheduler itself is documented in [../features/scheduler.md](../features/scheduler.md).

---

## Summary

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/scheduler/create` | Create a job and register it with APScheduler |
| POST | `/scheduler/list` | Paginated job list |
| DELETE | `/scheduler/delete/{scheduler_id}` | Soft-delete and unregister |

Note the ID asymmetry: **create takes a plain integer `collection_id`**, while list filters by an
**encoded** one. This is inconsistent with every other endpoint group, where collection IDs are always
encoded.

---

## POST `/scheduler/create`

**Request** (`SchedulerCreateReq`):

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `job_name` | string | — | **Required.** Slugified into `job_id` |
| `job_type` | `"cron"` \| `"interval"` | — | **Required** |
| `cron_year` | string | `"*"` | e.g. `2026` |
| `cron_month` | string | `"*"` | e.g. `1-12` |
| `cron_day` | string | `"*"` | e.g. `1-31` |
| `cron_week` | string | `"*"` | e.g. `1-53` |
| `cron_day_of_week` | string | `"*"` | e.g. `mon,tue,wed` |
| `cron_hour` | string | `"*"` | e.g. `0-23` |
| `cron_minute` | string | `"*"` | e.g. `0-59` |
| `cron_second` | string | `"*"` | e.g. `0-59` |
| `interval_seconds` | int ≥ 0 | `0` | |
| `interval_minutes` | int ≥ 0 | `0` | |
| `interval_hours` | int ≥ 0 | `0` | |
| `collection_id` | int | — | **Required. Plain integer** |
| `timezone` | string | `"Asia/Kolkata"` | Stored, and passed to cron triggers |

A validator coerces `None`, `""` and the string `"null"` to `"*"` on every cron field.

### Examples

Every day at 02:30:

```json
{ "job_name": "Nightly regression", "job_type": "cron",
  "cron_hour": "2", "cron_minute": "30", "cron_second": "0",
  "collection_id": 5, "timezone": "Asia/Kolkata" }
```

Every 15 minutes:

```json
{ "job_name": "Health check", "job_type": "interval",
  "interval_minutes": 15, "collection_id": 5 }
```

> **Cron fields left at `"*"` fire every unit.** Because all eight default to `"*"`, a cron job that sets
> only `cron_hour` will fire **every second** of that hour — `job_manager` filters out falsy values, but
> `"*"` is truthy and is passed straight to APScheduler. Always pin `cron_minute` and `cron_second`.

### Behaviour

1. Verify the collection exists and `status = 1` (`Code: 4000` otherwise).
2. Insert into `tbl_scheduler_jobs`. A `before_insert` event generates
   `job_id = "{slugified_job_name}_{next_id}"`.
3. `load_jobs_from_db([job])` registers the trigger with APScheduler immediately — no restart needed.

```json
{
  "Success": { "message": "scheduler added successfully",
    "data": { "id": 7, "job_id": "nightly_regression_7", "job_name": "Nightly regression",
      "job_type": "cron",
      "cron": { "year": "*", "month": "*", "day": "*", "week": "*",
                "day_of_week": "*", "hour": "2", "minute": "30", "second": "0" },
      "interval": { "seconds": 0, "minutes": 0, "hours": 0 },
      "payload": null, "collection_id": "NQ==", "status": true,
      "timezone": "Asia/Kolkata", "created_at": "11-Feb-2026 07:05:52" } },
  "Code": 0, "Error": null
}
```

`collection_id` comes back **encoded** even though it was sent as a plain integer.

The `payload` column exists and is always `null` — `load_jobs_from_db` constructs
`{"collection_id": job.collection_id}` itself and ignores the column.

---

## POST `/scheduler/list`

**Request** (`SchedulerListReq`):

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `search` | string | `""` | ⚠️ **crashes when non-empty** — see below |
| `collection_id` | string | `0` | **Encoded** collection ID; ⚠️ currently broken |
| `sort` | string | `"createdAt"` | |
| `order` | string | `"DESC"` | |
| `limit` | int | `5` | |
| `offset` | int | `0` | |

Only jobs with `status = True` and `deletedAt IS NULL` are returned.

```json
{
  "Success": { "message": "scheduler list fetched successfully",
    "data": { "limit": 5, "offset": 0, "total": 3,
      "schedulers": [ { "id": 7, "job_id": "nightly_regression_7", "job_name": "Nightly regression",
                        "job_type": "cron", "cron": { }, "interval": { },
                        "payload": null, "collection_id": "NQ==", "status": true,
                        "timezone": "Asia/Kolkata", "created_at": "11-Feb-2026 07:05:52" } ] } },
  "Code": 0, "Error": null
}
```

An empty result is `Code: 4000`, "No scheduler found".

### Two confirmed defects

**`search` raises `AttributeError`.** The filter references `SchedulerJob.name`, but the model defines
`job_name`:

```python
query = query.filter(SchedulerJob.name.ilike(f"%{payload.search}%"))   # no such attribute
```

Any non-empty `search` returns HTTP 500. The frontend always sends `""`, which is why this has not
surfaced. [AUDIT.md](../../AUDIT.md) issue 10.

**`collection_id` filtering is broken.** `decrypt_simple_id` returns a `(value, error)` tuple, but the
repository uses the return value directly as a scalar:

```python
decoded_id = decrypt_simple_id(payload.collection_id)      # -> (5, None)
query = query.filter(SchedulerJob.collection_id == decoded_id)
```

The comparison is against a tuple. [AUDIT.md](../../AUDIT.md) issue 11.

As a side effect the controller also calls `list_jobs()`, which prints the live APScheduler job list to
the backend console — useful for debugging, and the only visibility into registered jobs.

---

## DELETE `/scheduler/delete/{scheduler_id}`

`scheduler_id` is the plain-integer primary key (`id`), **not** the string `job_id`.

Behaviour:

1. Find the job where `deletedAt IS NULL` (`Code: 4000` if absent).
2. Soft delete: `status = False`, `deletedAt = utcnow()`.
3. `remove_job_from_scheduler(job.job_id)` unregisters it from APScheduler. Failures are swallowed and
   return `False`; the endpoint reports success regardless.

```json
{ "Success": { "message": "Job deleted successfully", "data": { "job_id": "nightly_regression_7" } },
  "Code": 0, "Error": null }
```

---

## Endpoints that do not exist

| Called by | Expects | Status |
| --------- | ------- | ------ |
| `/schedulerReport/[id]` page → `GET /api/scheduler_report/{id}/reports` → `GET /scheduler/{id}/reports` | Reports for a scheduler | **Not implemented** |

The frontend page and its BFF handler exist and are wired up, but the backend route was never written, so
the page can never load data. [AUDIT.md](../../AUDIT.md) issue 16.

There is also **no update endpoint** — a schedule can only be created and deleted. To change a cadence,
delete and recreate.

There is currently **no way to see which runs came from a schedule**: `tbl_test_reports` has no column
linking a run to a `scheduler_job`, so scheduled and manual runs are indistinguishable in
`POST /report/list`.
