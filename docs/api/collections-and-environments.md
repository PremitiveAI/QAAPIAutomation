# Collections and Environments API

Routers: `collectionRouter` (`/collections`) and `environmentRouter` (`/environment`), both defined in
[`app/routes/collection_routes.py`](../../backend/app/routes/collection_routes.py).

All endpoints require `PK-apiToken`. `{collection_id}` is always the **base64-encoded** form; a plain
integer is rejected. See [overview.md](overview.md).

---

## Summary

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/collections/upload` | Upload and parse a Postman collection |
| GET | `/collections/{collection_id}` | Collection metadata |
| POST | `/collections/{collection_id}/update-name` | Rename |
| POST | `/collections/list` | Paginated, searchable list |
| POST | `/collections/reorder_api` | Reorder endpoints |
| POST | `/environment/{collection_id}/environment/upload` | Upload a Postman environment file |
| GET | `/environment/{collection_id}/environment` | Read environment variables |
| POST | `/environment/{collection_id}/environment/update` | Replace environment variables |

---

## POST `/collections/upload`

Uploads a Postman collection export, parses it, and creates the collection, its endpoints and its
environment variable placeholders in one transaction.

**Content-Type:** `multipart/form-data` · **Field:** `file`

### Validation

1. `upload_collection_controller` — filename must end `.json`, else `Code: 400`.
2. `validate_json_file` — extension, `content_type == "application/json"`, and `json.load()` must
   succeed. Failures raise `HTTPException(400)` with a `{"detail": ...}` body, **not** the envelope.

### Behaviour

- `parse_postman_collection` recurses through nested folders.
- Two files are written under `STORAGE_DIR/collections/{id}/`: `collection_{timestamp}.json` and a
  synthesised `environment_{timestamp}.json`.
- One `tbl_api_endpoints` row per request, `api_order` assigned 1..n in traversal order.
- One `tbl_environments` row per discovered `{{variable}}`.
- `tbl_collections.env_vars` is set to `{var: ""}` for each variable.
- `collection_type` is hard-coded to `"postman"`. Swagger imports are not supported despite the column
  suggesting otherwise.

### Response

```json
{
  "Success": {
    "message": "Collection uploaded successfully",
    "data": {
      "id": "NQ==",
      "name": "My API Collection",
      "collection_type": "postman",
      "collection_path": "storage/collections/5/collection_20260211_070552.json",
      "env_path": "storage/collections/5/environment_20260211_070552.json",
      "env_variables": { "base_url": "", "token": "" },
      "total_apis": 12,
      "apis": [
        {
          "id": 101, "api_order": 1, "name": "Login", "method": "POST",
          "url": "{{base_url}}/auth/login",
          "headers": { "Content-Type": "application/json" },
          "query_params": null,
          "request_body": { "mode": "raw", "raw": { "username": "{{user}}" } },
          "response_body": { "token": "..." }
        }
      ]
    }
  },
  "Code": 0, "Error": null
}
```

`apis[].id` is a plain integer; the collection `id` is encoded.

> Only bodies detected as `body_type == "json"` are normalised and stored. A `raw` body that is not JSON
> (XML, plain text) yields `request_body: null` and will not be sent during a run.

---

## GET `/collections/{collection_id}`

```json
{
  "Success": { "message": "Collection fetched successfully",
    "data": { "id": "NQ==", "name": "My API Collection", "collection_type": "postman",
              "collection_path": "storage/...", "env_path": "storage/..." } },
  "Code": 0, "Error": null
}
```

Errors: `Code: 400` invalid ID format · `Code: 404` not found.

Not used by the frontend — the workbench loads environment and API list instead.

---

## POST `/collections/{collection_id}/update-name`

**Body** (`CollectionNameUpdate`): `{ "name": "New name" }` — required, no length or content constraint.

```json
{ "Success": { "message": "Collection name updated successfully",
               "data": { "id": "NQ==", "name": "New name" } },
  "Code": 0, "Error": null }
```

If the collection does not exist this raises `HTTPException(404)` — the only endpoint in this group that
does not return the envelope on a missing record.

Used by `/uploadeCollection` only.

---

## POST `/collections/list`

**Body** (`CollectionListRequest`), all optional:

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `search` | string | `""` | `ILIKE %search%` on `name` |
| `filter` | string \| null | `null` | **Accepted and ignored** |
| `startDate` | string \| null | `null` | ISO-8601 on `createdAt`; unparseable values ignored; `"string"` skipped |
| `endDate` | string \| null | `null` | as above |
| `sort` | string | `"createdAt"` | Unknown names fall back to `createdAt` |
| `order` | string | `"DESC"` | |
| `limit` | int | `10` | |
| `offset` | int | `0` | |

```json
{
  "Success": { "message": "Collection list fetched successfully",
    "data": { "total": 67,
      "collections": [ { "id": "NQ==", "name": "My API Collection",
                         "createdAt": "11-Feb-2026 07:05:52", "total_apis": 12 } ] } },
  "Code": 0, "Error": null
}
```

An empty result is an **error**, not an empty list:

```json
{ "Success": null, "Code": 404, "Error": { "message": "No collections found" } }
```

`total` is the count **after** filters and is used for pagination. The service loads every endpoint of
every returned collection to compute `total_apis` — an N+1 query pattern that is noticeable at large
`limit` values.

---

## POST `/collections/reorder_api`

**Body** (`ReorderByArrayRequest`):

```json
{ "collection_id": "NQ==", "api_ids": [103, 101, 102] }
```

Array position determines the new `api_order`: position 0 → `api_order = 1`, and so on.

```json
{ "Success": { "message": "API orders updated successfully",
    "data": { "collection_id": "NQ==",
              "updated": [ { "api_id": 103, "order_id": 1 },
                           { "api_id": 101, "order_id": 2 },
                           { "api_id": 102, "order_id": 3 } ] } },
  "Code": 0, "Error": null }
```

Errors: `Code: 4001` when any supplied ID is missing (the message lists them) · `Code: 500` on a database
failure, with a rollback.

> The lookup is `ApiEndpoint.id.in_(api_ids)` **without** a `collection_id` filter, so IDs belonging to a
> different collection are accepted and reordered. `collection_id` is only used to build the response.

---

## POST `/environment/{collection_id}/environment/upload`

Uploads a Postman environment export. **Content-Type:** `multipart/form-data` · **Field:** `file`

Only entries with `"enabled": true` are imported:

```python
for item in env_json.get("values", []):
    if item.get("enabled"):
        env_vars[item["key"]] = item.get("value")
```

This **replaces** `env_vars` entirely — variables absent from the file are removed, including any values
written by earlier test runs.

```json
{ "Success": { "message": "Environment uploaded successfully",
    "data": { "id": "NQ==", "name": "My API Collection",
              "env_path": "storage/collections/5/environment_20260211_071234.json",
              "env_variables": { "base_url": "https://api.example.com", "token": "" } } },
  "Code": 0, "Error": null }
```

Errors: `Code: 404` collection not found · `Code: 400` non-`.json` file.

---

## GET `/environment/{collection_id}/environment`

```json
{ "Success": { "message": "Environment fetch successfully",
    "data": { "collection_id": "NQ==", "collection_name": "My API Collection",
              "env_path": "storage/collections/5/environment_20260211_070552.json",
              "environment_variables": { "base_url": "https://api.example.com", "token": "eyJ..." } } },
  "Code": 0, "Error": null }
```

Values reflect the **current** state of `tbl_collections.env_vars`, including anything a post-request
script wrote during the last run. This is how an auth token captured at login becomes visible in the UI.

---

## POST `/environment/{collection_id}/environment/update`

**Body** (`EnvironmentUpdate`): `{ "variables": { "base_url": "https://api.example.com", "token": "" } }`

Typed as `Dict[str, str]`, so non-string values are rejected by Pydantic.

**This is a full replacement, not a merge:**

```python
collection.env_vars = payload.variables
```

Any key omitted from the payload is deleted. To change one variable, send the complete set.

```json
{ "Success": { "message": "Environment updated successfully",
    "data": { "collection_id": "NQ==", "collection_name": "My API Collection",
              "environment_variables": { "base_url": "https://api.example.com", "token": "" } } },
  "Code": 0, "Error": null }
```

---

## Where environment variables actually live

Three storage locations exist; only one is read at runtime.

| Location | Written by | Read by |
| -------- | ---------- | ------- |
| `tbl_collections.env_vars` (JSON) | upload, update, upload-env, **and post-request scripts** | **The test engine — this is the live source** |
| `tbl_environments` rows | collection upload only | **Nothing** |
| `storage/.../environment_*.json` | collection upload, env upload | Nothing — archival only |

`tbl_environments` is populated at upload and never queried again. Treat `tbl_collections.env_vars` as
the single source of truth.
