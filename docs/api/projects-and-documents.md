# Projects and Documents API

Routers: `projectRouter` (`/project`) and `documentRouter` (`/document`), defined in
[`app/routes/project_routes.py`](../../backend/app/routes/project_routes.py).

These endpoints implement a document-rules and KYC-extraction workflow that is **functionally independent
of the API-testing product**. They are fully implemented and reachable, but the navigation entries that
lead to them are commented out in `DashboardLayout`. See
[../features/projects.md](../features/projects.md) and
[../features/documents-kyc.md](../features/documents-kyc.md).

All IDs here are **plain integers**.

---

## Summary

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/project/save` | Create or update a project |
| POST | `/project/list` | Paginated project list |
| GET | `/project/details/{id}` | One project |
| DELETE | `/project/delete/{id}` | Soft delete |
| POST | `/project/execute-and-save/{collection_id}` | Ad-hoc JS execution — undocumented utility |
| POST | `/document/save` | Create or update a document rule set |
| POST | `/document/list` | Documents for a project |
| GET | `/document/details/{id}` | One document |
| DELETE | `/document/delete/{id}` | Soft delete |
| POST | `/document/upload` | Upload files, OCR and extract against the rules |

---

## POST `/project/save`

Create and update share one endpoint: sending `id` updates, omitting it creates.

**Request** (`projetcCreateReq` — the misspelling is in the source):

```json
{ "id": null, "name": "Payments API", "description": "Regression suite for payments" }
```

`createdBy` and `updatedBy` are accepted but ignored — the controller hard-codes `admin_id = 1`.

```json
{
  "Success": { "message": "Created successfully",
    "data": { "id": 3, "name": "Payments API", "description": "Regression suite for payments",
              "createdAt": "11-Feb-2026 07:05:52", "updatedAt": "11-Feb-2026 07:05:52", "status": 1,
              "total_docs": 0, "pending_docs": 0, "uploaded_docs": 0 } },
  "Code": 0, "Error": null
}
```

The three document counts are computed on every project response:

| Field | Definition |
| ----- | ---------- |
| `total_docs` | Documents with `status = 1` and `deletedAt IS NULL` |
| `pending_docs` | …of those, with `file_path` null or empty |
| `uploaded_docs` | …of those, with a non-empty `file_path` |

Errors: `Code: 4030` "Name is required" · `Code: 4040` "Record not found" on update.

> The update path also assigns `obj.imageId` and `obj.imagePath`, which are **not columns** on `Projects`.
> The values are attached to the instance and silently discarded. [AUDIT.md](../../AUDIT.md) issue 13.

---

## POST `/project/list`

**Request** (`UserListReq`): `search`, `filter`, `startDate`, `endDate`, `sort`, `order`, `limit` (10),
`offset` (0). Only `search`, `limit`, `offset` and `order` are honoured; sorting is always by `id`.

```json
{ "Success": { "message": "Project list fetched successfully",
               "data": { "count": 3, "list": [ /* project objects with doc counts */ ] } },
  "Code": 0, "Error": null }
```

Each entry triggers three additional count queries, so a large `limit` is expensive.

> The frontend BFF handler `app/api/projects/project-list/route.ts` reads
> `data?.Success?.data?.totalRecords`, but the backend returns `count`. The page's total is therefore
> always `0` while the list itself renders correctly.

---

## GET `/project/details/{id}`

Returns one project with document counts. Only `status = 1` rows are visible, so a soft-deleted project
returns `Code: 4040`.

## DELETE `/project/delete/{id}`

Soft delete: `status = -1`, `deletedAt = utcnow()`, `updatedBy = 1`. Returns
`{"Success": {"message": "Deleted successfully"}, "Code": 0, "Error": null}`.

Documents belonging to the project are **not** cascaded — `tbl_documents.project_id` has its foreign key
commented out. They remain with `status = 1` and are orphaned.

---

## POST `/project/execute-and-save/{collection_id}`

An ad-hoc utility that executes JavaScript against a collection's environment and persists the result.
It is not part of any UI flow and is the only endpoint that breaks the response envelope.

**Headers:** `Api-Id: <int>` (required, in addition to `PK-apiToken`)
**Body:** an arbitrary object containing `script.exec` as an array of JS lines.

```json
{ "script": { "exec": ["pm.environment.set('token', 'abc');"] } }
```

Behaviour: loads the collection and endpoint, merges `env_vars` with `current_api_id`, `db_header` and
`db_body`, runs `UniversalJSExecutor`, then writes any modified `db_header`/`db_body` back to the endpoint
and the remaining variables back to the collection.

```json
{ "status": "Success - Read and Updated",
  "updated_collection_env": { }, "updated_endpoint": { "id": 101, "headers": { }, "body": { } },
  "js_result": { } }
```

Missing records raise `HTTPException(404)` with `{"detail": "..."}`, not the envelope.

> This endpoint writes directly to collection and endpoint records with no validation beyond existence.
> Treat it as a debugging tool, not a public API.

---

## POST `/document/save`

**Request** (`documentCreateReq`):

```json
{ "id": null, "project_id": 3, "name": "PAN Card",
  "rules": [ { "rule": "PAN number must be present", "mandatory": true },
             { "rule": "Name must match the employee record", "mandatory": false } ] }
```

`rules` is `List[RuleItem]` where each item is `{rule: str, mandatory: bool}` — this is the one part of
the document API with real schema validation.

```json
{ "Success": { "message": "Created successfully",
    "data": { "id": 11, "name": "PAN Card",
      "rules": [ { "rule": "PAN number must be present", "mandatory": true } ],
      "rulesCount": 1, "result": null, "file_path": null,
      "createdAt": "11-Feb-2026 07:05:52", "updatedAt": "11-Feb-2026 07:05:52",
      "status": 1, "project_id": 3 } },
  "Code": 0, "Error": null }
```

Errors: `Code: 4040` "Project id requred" (sic) when `project_id` is falsy, or the project does not
exist · `Code: 4030` "Name is required".

`file_path` is returned through the `file_path_url` property, which prefixes `BASE_URL`:

```python
return base_url + self.file_path.lstrip("/")
```

`BASE_URL` must therefore end with `/`, or document URLs are malformed.

---

## POST `/document/list`

**Request** (`documentListReq`): `search`, `project_id`, `sort`, `order`, `limit` (10), `offset` (0).

`project_id` is required — a falsy value returns `Code: 4040` "Project id requred".

```json
{ "Success": { "message": "List fetched successfully",
               "data": { "count": 4, "list": [ /* document objects */ ] } },
  "Code": 0, "Error": null }
```

## GET `/document/details/{id}` · DELETE `/document/delete/{id}`

Standard single-record fetch and soft delete, mirroring the project endpoints. `Code: 4040` when absent.

---

## POST `/document/upload`

Uploads one or more files, runs OCR, and extracts values against the rule sets already defined for the
project.

**Content-Type:** `multipart/form-data`
**Field:** `files` (repeatable)
**Query parameter:** `project_id` (int, defaults to `1`)

### Behaviour

1. Reject empty uploads (`Code: 4002`).
2. Verify the project exists (`Code: 4040`).
3. Load all `status = 1` documents for the project; if none, `Code: 4040` "documents rules not found".
4. For each file: save to `storage/{userId}/{project_id}/{sanitised_filename}`, run
   `ocr_extract_text()`, then `extract_details(text, document_rules)`.
5. Update the matched document row with `file_path` and `result`.

```json
{
  "Success": { "message": "Files uploaded successfully",
    "data": { "uploaded": 2, "failed": 0,
      "results": [ { "details": { "id": 11, "name": "PAN Card", "result": { },
                                  "file_path": "http://127.0.0.1:8000/storage/..." },
                     "filename": "pan.pdf", "message": "File uploaded successfully." } ],
      "errors": [] } },
  "Code": 0, "Error": null
}
```

A file that produces no match returns `details: null` and the message
`"Upload failed. Mandatory fields are missing or invalid."` — still inside a successful response.
Exceptions per file are collected into `errors[]` without aborting the batch.

### `userId` is hard-coded

```python
userId = "U-98WZ41BUTTOM"   # request.state.userId
```

Every upload from every caller lands in `storage/U-98WZ41BUTTOM/{project_id}/`. The commented-out
alternative shows the intent — a per-user path — but there is no authentication to supply a user ID. See
[../security/authentication-and-authorization.md](../security/authentication-and-authorization.md).

Filenames are sanitised with `re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)`, which strips directory
components and traversal sequences. Two uploads with the same filename **overwrite** each other, since no
timestamp is added — unlike collection storage.

Processing is synchronous: each file is OCR'd through Gemini Vision before the response returns, so a
multi-file, multi-page batch can take a long time.
