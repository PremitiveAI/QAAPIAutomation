# Feature — API Editor (Workbench)

## Overview

The browser-based editor for a single API request: URL, method, headers, body (JSON / query params /
url-encoded / form-data), pre- and post-request scripts, and the test scenarios attached to it. This is
where users spend most of their time.

**Status:** Implemented. Duplicated across two pages — see [Known limitations](#known-limitations).

## Business purpose

An imported collection is rarely runnable as-is: URLs need environment variables, headers need auth,
bodies need realistic values. The workbench makes those edits without leaving the tool and without
round-tripping through Postman.

## User flow

1. Open `/collectionDetails/{collectionId}` (existing collection) or `/uploadeCollection` (just
   uploaded).
2. Pick an API from the left sidebar. Details load lazily.
3. Edit across five tabs: **header · body · testCases · response · scripts**.
4. Drag rows in the sidebar to change execution order; **Save Order** persists it.
5. **Save** writes either the request or the scenarios — never both.

## Frontend flow

```
select API
  → fetchSingleApi(api)
  → GET /api/collections/{cid}/apis/{apiId}
  → determine realMode:
        data.request_body.mode          if present
        else "query"                    if query_params.mode === "query"
        else "query"                    if url contains "?"
        else "raw"
  → hydrateRequestBody(realMode, request_body, url, query_params)
  → set requestType + populate the matching editor state
  → load pre/post scripts (guarded by isLoadingScriptsRef)
  → if test_scenario[] non-empty → selectFirstScenario() and switch to the testCases tab
```

### Body hydration

`hydrateRequestBody` maps stored shape → editor:

| Stored | `requestType` | Editor |
| ------ | ------------- | ------ |
| `{mode:"raw", raw:{…}}` | `json` | Monaco JSON editor |
| `{mode:"raw", raw:null}` **and** query params exist | `params` | Key/value table |
| `{mode:"query"}` or a URL containing `?` | `params` | Key/value table |
| `{mode:"urlencoded", urlencoded:[…]}` | `urlencoded` | Key/value table |
| `{mode:"formdata", formdata:[…]}` | `formData` | Key/value/type table with file rows |
| anything else, no params | `json` | Empty JSON editor |

Query parameters are extracted **independently of the body**, from `query_params.query`, a bare array, or
by parsing the URL's query string — so a POST with both a body and query params hydrates correctly.

### Saving

`buildApiPayload()` reverses the mapping:

```
requestType "params"     → query_params only, no request_body
requestType "json"       → { mode: "raw", raw: JSON.parse(editor) }
requestType "formData"   → { mode: "formdata", formdata: [{key,type,value|src}] }
requestType "urlencoded" → { mode: "urlencoded", urlencoded: [{key,value}] }
```

Query params are always sent when present, taken from `paramsData` on the params tab or re-parsed from
the URL otherwise.

### Two independent dirty flags

| Flag | Set by | Saved by |
| ---- | ------ | -------- |
| `isRequestDirty` | URL, headers, body, params, scripts | `POST /api/collections/{cid}/saveapi` |
| `hasUnsavedScenarios` | Scenario generation or edits | `POST /api/savetest` |

```ts
if (hasUnsavedScenarios && scenarios.length > 0) { await handleSaveSelectedScenarios(); return; }
if (isRequestDirty && !hasUnsavedScenarios)      { await handleSaveApiRequest();       return; }
```

The two endpoints are **mutually exclusive** — scenarios win. Editing the request *and* the scenarios in
one sitting saves only the scenarios; the request changes are silently discarded.

`isLoadingScriptsRef` suppresses the dirty flag while scripts are loaded programmatically, using a
`setTimeout(..., 0)` to clear the guard after React flushes the state updates.

### URL ⇄ params synchronisation

Two effects keep the URL and the params table in agreement:

- Editing params rebuilds the URL query string (guarded by `isUserEditingParamsRef` so hydration does not
  trigger it).
- Switching **away** from the params tab strips the query string from the URL entirely.

The second behaviour is destructive and easy to trip over: moving from params to JSON removes `?a=b` from
the URL.

### Reordering

`@dnd-kit` sortable rows call `arrayMove` and set `isOrderDirty`. **Save Order** posts the resulting ID
array to `POST /api/reorder`; array position becomes `api_order`.

## Backend flow

```
GET  /api/{cid}/apis/{api_id}   →  get_single_api_controller → get_single_api_service
POST /api/{cid}/apis            →  APIController.save_api → update_api_details
POST /collections/reorder_api   →  reorder_by_array_controller → reorder_by_array_service
```

`save_api` filters the payload through an allow-list and skips `None` values:

```python
ALLOWED_FIELDS = {"name", "method", "url", "headers", "query_params", "request_body",
                  "pre_request_script", "post_request_script", "test_scenario"}
```

If nothing survives filtering, the call fails with `"No fields provided for update"`.

## API details

- [`GET /api/{cid}/apis`](../api/apis-and-test-cases.md#get-apicollection_idapis)
- [`GET /api/{cid}/apis/{api_id}`](../api/apis-and-test-cases.md#get-apicollection_idapisapi_id)
- [`POST /api/{cid}/apis`](../api/apis-and-test-cases.md#post-apicollection_idapis)
- [`POST /collections/reorder_api`](../api/collections-and-environments.md#post-collectionsreorder_api)

## Validation

**Client:** `safeParseJSON` never throws — it returns a fallback — while `validateJson` produces the
inline error message shown under the editor. Monaco provides JavaScript syntax and semantic diagnostics
for the script tabs, surfaced in a collapsible error list.

**Server:** `SaveAPIReq` is the strictest schema in the codebase — a discriminated union on `mode` with
per-mode `model_validator`s, plus a cross-field rule rejecting a body on `GET` or `DELETE`. Full rules in
[../api/apis-and-test-cases.md](../api/apis-and-test-cases.md#body-validation).

Note the asymmetry: **saving a request is strictly validated; saving scenarios is not validated at all**
(`testCase: List[Dict]`).

## Database interaction

| Table | Operation |
| ----- | --------- |
| `tbl_api_endpoints` | SELECT on load; UPDATE on save; UPDATE `api_order` on reorder |

## Authentication

`PK-apiToken` only. Any token holder can edit any endpoint in any collection. `createdBy`/`updatedBy`
are never populated for endpoints, so edits are unattributed.

## Error handling

| Situation | Result |
| --------- | ------ |
| API not in this collection | `Code: 404` |
| Invalid JSON in the body editor | Inline error; save proceeds with the parsed fallback |
| Schema rejection | HTTP 400, `Code: 1`, **first error message only** |
| No updatable fields | `Code: 5000`, "No fields provided for update" |
| Backend unreachable | Toast, "Backend not reachable" |
| Reorder with unknown IDs | `Code: 4001` listing them |

## Dependencies

`@monaco-editor/react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, and the local
`DynamicTableEditor`, `JsonTextEditor`, `ConfirmModal`, `InfoTooltip`, `Loader` components.

## Known limitations

1. **The page exists twice.** `/collectionDetails/[collectionId]` (3,146 lines) and
   `/uploadeCollection` (2,973 lines) are a verbatim fork — 44% of the frontend. Every change must be
   made in both. [AUDIT.md](../../AUDIT.md) issue 24.

2. **The forks have drifted.** Three confirmed behavioural differences:
   - `getScenarioRequestInput` differs, so a scenario whose `request` lacks a `mode` key loads with an
     **empty body editor** on `/collectionDetails` but correctly on `/uploadeCollection`.
     [AUDIT.md](../../AUDIT.md) issue 31.
   - A shadowed `buildScriptObject` inside `buildApiPayload` **strips `//` comments** on the Save-API
     path only. [AUDIT.md](../../AUDIT.md) issue 32.
   - Query-param edits do not set the dirty flag on `/collectionDetails`, so those edits are lost on
     navigation. [AUDIT.md](../../AUDIT.md) issue 34.

3. **`body_type` is stored but not returned** by `GET /api/{cid}/apis/{api_id}`, so the editor
   re-derives the mode from the payload shape instead of trusting the stored value.

4. **Form-data file paths are text, not uploads.** Selecting a file records only its *name*; the
   execution engine later resolves it as an **absolute path on the backend host**. A file picked in the
   browser will not be found at run time unless the same absolute path exists server-side. See
   [test-execution-engine.md](test-execution-engine.md).

5. **Switching body type discards the previous editor's contents** — `handleSaveApiRequest` clears the
   non-active editors after a successful save.

6. **Saving the request and the scenarios together is impossible**; scenarios take priority and the
   request edits are dropped.

7. **A hard-coded `{{env_base_url}}`** is stripped from URLs during bootstrap on `/collectionDetails`
   but not by `fetchSingleApi`, so the sidebar and the detail pane can disagree.
   [AUDIT.md](../../AUDIT.md) issue 33.

8. **Reorder is not scoped to the collection** — `ApiEndpoint.id.in_(api_ids)` has no `collection_id`
   filter, so IDs from another collection are accepted and reordered.
