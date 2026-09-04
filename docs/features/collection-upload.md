# Feature — Collection Upload

## Overview

Ingests a Postman collection export and turns it into the application's working data: a collection
record, one row per API request, and a set of environment-variable placeholders discovered by scanning
the collection for `{{variable}}` syntax.

**Status:** Implemented.

## Business purpose

This is the entry point to the entire product. Everything downstream — editing, AI generation, execution,
reporting, scheduling — operates on data created here. QA teams already maintain Postman collections, so
importing one avoids re-specifying the API surface by hand.

## User flow

1. Navigate to **Collection → Upload Collection** (`/uploadeCollection`).
2. Drag a `.json` export onto the drop zone, or click to browse.
3. The API list populates on the left; the collection name appears in the header and can be renamed
   inline.
4. The environment panel lists every discovered variable with an empty value.
5. Fill in values, or upload a Postman environment export to populate them in bulk.

## Frontend flow

```
User drops file
  → handleUpload(file)                     uploadeCollection/page.tsx:903
  → resetAllState()
  → FormData.append("file", file)
  → POST /api/collectionsUpload            (multipart, no Content-Type header set — the browser sets the boundary)
  → route handler adds PK-apiToken, forwards to POST /collections/upload
  → response: json.Success.data
      setCollectionName(collection.name)
      setCollectionId(collection.id)       encoded id, used for every later call
      setEnvRows(Object.entries(collection.env_variables))
      setApiList(collection.apis.map(...)) each marked isLoaded: false
  → showToast("Collection uploaded successfully")
```

`apiList` entries are deliberately shallow. Full detail is fetched lazily by `fetchSingleApi` when an
endpoint is selected — see [api-editor.md](api-editor.md).

## Backend flow

```
POST /collections/upload
  → upload_collection_controller           extension check
  → upload_collection_service
      → validate_json_file(file)           extension + MIME + json.load()
      → parse_postman_collection(data)     → (name, apis[], env_vars[])
      → INSERT tbl_collections             commit + refresh + flush
      → save_collection_file()             storage/collections/{id}/collection_{ts}.json
      → build environment JSON             storage/collections/{id}/environment_{ts}.json
      → UPDATE collection paths, env_vars = {var: ""}
      → INSERT tbl_environments            one row per variable
      → INSERT tbl_api_endpoints           one row per request, api_order = 1..n
  → success_response("Collection uploaded successfully", {...})
```

### Parsing

[`parse_postman_collection`](../../backend/app/utils/collection_parser.py) walks the item tree
recursively, descending into folders:

```python
def walk(items):
    for item in items:
        if "item" in item:      # a folder
            walk(item["item"])
            continue
        req = item.get("request", {})
        ...
```

Folder structure is **flattened** — nesting is not preserved, only traversal order, which becomes
`api_order`.

Per request:

| Field | Extraction |
| ----- | ---------- |
| `url` | `request.url.raw` if `url` is an object, else the raw value |
| `query_params` | `request.url.query` → `{"mode": "query", "query": [...]}` |
| `headers` | `request.header[]` flattened to `{key: value}` |
| `body_type` | `detect_body_type(req)` |
| `request_body` | See below |
| `response_body` | `item.response[0].body`, JSON-parsed if possible, else the raw string |

### Body type detection

```python
def detect_body_type(req):
    body = req.get("body")
    if not body:
        return "query" if req.get("url", {}).get("query") else None
    mode = body.get("mode")
    if mode == "formdata":   return "formdata"
    if mode == "urlencoded": return "urlencoded"
    if mode == "raw":
        return "json" if body.get("options", {}).get("raw", {}).get("language") == "json" else "raw"
    if mode == "graphql":    return "graphql"
    return None
```

Only `json`, `formdata` and `urlencoded` produce a stored `request_body`:

```python
if body and body_type == "json":
    request_body = {"mode": "raw", "raw": normalize_postman_raw_json(raw_body)}
elif body and body.get("mode") in ["formdata", "urlencoded"]:
    request_body = body
```

> **A `raw` body that is not JSON — XML, plain text, GraphQL — is detected but never stored.**
> `request_body` stays `null` and nothing will be sent for that endpoint at run time. This is the most
> common surprise when importing a mixed collection.

### Raw JSON normalisation

Postman raw bodies are not valid JSON: they may contain `//` comments and bare `{{variables}}`.

```python
raw = re.sub(r'//.*$', '', raw, flags=re.MULTILINE)       # strip comments
raw = re.sub(r'{{\s*([\w\-]+)\s*}}', r'"{{\1}}"', raw)     # quote variables
return json.loads(raw)                                     # None on failure
```

Quoting the placeholder makes the document parse while preserving the token for substitution at run
time. If parsing still fails, `request_body.raw` becomes `null`.

### Variable discovery

```python
ENV_REGEX = re.compile(r"\{\{(.*?)\}\}")
```

Applied to the raw URL, every header value and the raw body, collected into a set. The result becomes
`tbl_collections.env_vars = {var: "" for var in env_vars}`.

> Variables that appear **only** inside a `formdata` or `urlencoded` body are not discovered, because
> `extract_env_vars` is called on the raw body string only for the `raw` path. They still substitute
> correctly at run time — they just do not appear in the environment panel for the user to fill in.

## API details

`POST /collections/upload` — full request and response documentation in
[../api/collections-and-environments.md](../api/collections-and-environments.md#post-collectionsupload).

## Validation

| Layer | Check | Failure |
| ----- | ----- | ------- |
| Controller | Filename ends `.json` | `Code: 400`, "Only JSON files are allowed" |
| `validate_json_file` | Extension | `HTTPException(400)` |
| `validate_json_file` | `content_type == "application/json"` | `HTTPException(400)` |
| `validate_json_file` | `json.load()` succeeds | `HTTPException(400)` |

There is **no Postman schema validation**. Any JSON document is accepted. A file without an `item` array
creates a collection named `"Unnamed Collection"` with zero endpoints and no error.

The MIME check can reject legitimate files: some browsers and OS configurations send `text/json` or
`application/octet-stream` for `.json` uploads, which fails with "Invalid content type".

## Database interaction

| Table | Operation |
| ----- | --------- |
| `tbl_collections` | INSERT, then UPDATE with the storage paths and `env_vars` |
| `tbl_environments` | INSERT one row per variable (**never read afterwards**) |
| `tbl_api_endpoints` | INSERT one row per request |

## Filesystem interaction

```
STORAGE_DIR/collections/{collection_id}/
├── collection_{YYYYMMDD_HHMMSS}.json      the uploaded file, byte for byte
└── environment_{YYYYMMDD_HHMMSS}.json     a synthesised Postman-format environment
```

Filenames are timestamped, so re-uploading accumulates files rather than overwriting. Only the paths in
`tbl_collections` are updated to point at the newest.

The synthesised environment file has the standard Postman shape:

```json
{ "name": "My API Collection Environment",
  "values": [ { "key": "base_url", "value": "", "enabled": true } ] }
```

## Authentication

`PK-apiToken` only. Any holder of the token can upload, and uploads are not attributed to anyone —
`createdBy` is left null.

## Error handling

| Situation | Result |
| --------- | ------ |
| Non-`.json` filename | `Code: 400` |
| Wrong MIME type | HTTP 400, `{"detail": ...}` |
| Malformed JSON | HTTP 400, `{"detail": ...}` |
| Valid JSON, not a Postman collection | **Success** — an empty collection is created |
| Backend unreachable | Frontend toast, "Backend not reachable. Please try again later." |

The frontend distinguishes `res.status >= 500` ("Backend not reachable") from other failures ("Invalid
collection file").

## Dependencies

- `python-multipart` for multipart parsing
- [`collection_parser.py`](../../backend/app/utils/collection_parser.py),
  [`env_extractor.py`](../../backend/app/utils/env_extractor.py),
  [`file_validation.py`](../../backend/app/utils/file_validation.py),
  [`storage_helper.py`](../../backend/app/utils/storage_helper.py)

## Known limitations

1. **Postman only.** `collection_type` is hard-coded to `"postman"`; there is no Swagger/OpenAPI importer
   despite the column implying one.
2. **Non-JSON raw bodies are dropped.**
3. **Folder hierarchy is flattened** into a single ordered list.
4. **Only the first saved example response is imported** — `item.response[0]`.
5. **No duplicate detection.** Re-uploading the same collection creates a second, independent record.
6. **Collection-level scripts are ignored.** Only request-level `event` blocks are read, and only through
   the API editor — the parser itself does not extract `pre_request_script` or `post_request_script` at
   all, so scripts present in the export are **not imported**. They must be re-entered in the workbench.
7. **No file-size limit**, and the file is read fully into memory twice (once for validation, once for
   storage).
8. `save_test_case_file()` in `storage_helper.py` is an unused duplicate of `save_collection_file()`.
