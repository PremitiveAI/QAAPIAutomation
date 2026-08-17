# Code Audit — Confirmed Issues

Every item below was verified by reading the source. Nothing here is speculative. Each entry cites the
file and, where useful, the line. Issues are grouped by category and ordered by severity within each
group.

**Scope of verification:** 100% of backend Python source and 100% of frontend TypeScript source was
read. The application was **not executed**, and the live PostgreSQL schema was **not inspected** — no
database dump or migration history exists in the repository. Runtime-behaviour items are therefore
verified by code reading rather than by reproduction, and are marked accordingly.

**Total: 36 confirmed issues — 34 open, 2 resolved** (issue 4, the empty root README; issue 21, the
`.gitignore` rule that excluded `app/config/env.py`).

| Category | Count |
| -------- | ----: |
| [Setup and dependencies](#setup-and-dependencies) | 2 |
| [Security](#security) | 5 |
| [Correctness](#correctness) | 12 |
| [Broken references](#broken-references) | 3 |
| [Data model](#data-model) | 2 |
| [Documentation](#documentation) | 4 |
| [Dead and duplicated code](#dead-and-duplicated-code) | 5 |
| [Contract mismatches](#contract-mismatches) | 3 |

---

## Setup and dependencies

### 1. `requirements.txt` is UTF-16 encoded

- **Evidence:** `file backend/requirements.txt` → `Unicode text, UTF-16, little-endian, with CRLF line
  terminators`. First bytes are `ff fe 23 00`.
- **Impact:** `pip install -r requirements.txt` — the command documented in `backend/readme.md` — cannot
  parse the file. Setup fails at step one for every new developer.
- **Recommendation:** Re-save as UTF-8 without BOM.

### 2. Three imported packages are missing from `requirements.txt`

- **Evidence:** Import scan across `backend/app/` yields `apscheduler`, `requests` and `PIL`, none of
  which appear in `requirements.txt`. `apscheduler` is imported by
  [`app/scheduler/scheduler.py`](backend/app/scheduler/scheduler.py), `requests` by
  [`app/services/test_case_service.py`](backend/app/services/test_case_service.py), `PIL` by
  [`app/utils/kyc_document_parser.py`](backend/app/utils/kyc_document_parser.py).
- **Impact:** After a clean install the application crashes on import.
- **Recommendation:** Add `apscheduler`, `requests` and `pillow` with pinned versions.

---

## Security

### 36. `/storage` is served publicly, with no token check

- **Evidence:** [`app/middlewares/auth_middleware.py:19-20`](backend/app/middlewares/auth_middleware.py)
  waves through any path beginning `/storage` **before** the token is validated:
  ```python
  if request.url.path.startswith("/storage"):
      return await call_next(request)
  ```
  [`app/main.py:42`](backend/app/main.py) then serves that directory:
  `app.mount("/storage", StaticFiles(directory="storage"), name="storage")`.
- **Impact:** Anyone who can reach the backend can download, with **no credential at all**: every
  uploaded Postman collection, every environment file (which hold live credentials for the systems under
  test), every test report (whose `environment` block contains tokens captured during runs), and every
  uploaded KYC document. Paths are highly guessable — `/storage/collections/{small integer}/...` — and the
  document path is protected only by a hard-coded constant directory name
  (`storage/U-98WZ41BUTTOM/{project_id}/`), so obscurity provides no real protection.
- **Recommendation:** Remove the `/storage` exemption and serve files through an authenticated handler,
  or block `/storage` at the reverse proxy. Until then, do not expose the backend port beyond localhost.

### 5. Database URL including the password is printed to stdout

- **Evidence:** [`app/database/connection.py:32`](backend/app/database/connection.py) —
  `print("Final DB URL =======> ", SQLALCHEMY_DATABASE_URL)`, executed at import time.
- **Impact:** The database password is written to the console and to any process-manager log on every
  start.
- **Recommendation:** Remove the statement, or log only host, port and database name.

### 6. Full request and response bodies are written to logs

- **Evidence:** [`app/middlewares/request_logger.py:56-66`](backend/app/middlewares/request_logger.py)
  logs `request_body` and `response_body` to `logs/requests.log`. Masking in
  [`app/utils/crypto.py`](backend/app/utils/crypto.py) covers only `password`, `otp`,
  `panaadhaar_number` and `pan_number`, and only for top-level JSON keys.
- **Impact:** Bearer tokens, API keys, session tokens and any PII inside nested objects are stored in
  plaintext. This platform tests other systems, so those logs contain third-party credentials.
- **Recommendation:** Log metadata only by default; make body logging opt-in and header-aware.

### 7. User-supplied JavaScript is executed via `js2py`

- **Evidence:** [`app/utils/universal_runner.py`](backend/app/utils/universal_runner.py) —
  `context.execute(js_code)` on script text supplied through the API.
- **Impact:** `js2py` is not a security sandbox. Arbitrary script content runs inside the API process.
- **Recommendation:** Treat script authorship as a privileged operation, or move execution to an
  isolated worker with a real sandbox.

### 8. `encrypt_simple_id` is base64, not encryption

- **Evidence:** [`app/utils/crypto.py:60-62`](backend/app/utils/crypto.py) —
  `base64.urlsafe_b64encode(str(id_value).encode())`.
- **Impact:** IDs described in code comments as "encrypted" are trivially reversible and enumerable.
  Combined with the absence of per-user authorization, any caller with the shared token can read any
  record.
- **Recommendation:** Do not treat these IDs as an access control mechanism; document them as
  obfuscation only.

---

## Correctness

### 9. All error responses return HTTP 200

- **Evidence:** [`app/utils/response.py`](backend/app/utils/response.py) — `error_response` returns
  `JSONResponse(status_code=200, ...)`; `throw_error_response` raises `HTTPException(status_code=200)`.
- **Impact:** Load balancers, uptime monitors, retry logic and generic HTTP clients cannot distinguish
  success from failure. Frontend code must check `Code !== 0` everywhere, and several pages do this
  inconsistently.
- **Recommendation:** Map error codes to real HTTP status codes while keeping the envelope shape.

### 10. Scheduler search references a non-existent column

- **Evidence:** [`app/repositories/scheduler_repo.py:96`](backend/app/repositories/scheduler_repo.py) —
  `SchedulerJob.name.ilike(...)`. The model defines `job_name`, not `name`
  ([`app/models/tbl_scheduler_jobs.py`](backend/app/models/tbl_scheduler_jobs.py)).
- **Impact:** `AttributeError` whenever `POST /scheduler/list` is called with a non-empty `search`.
  Currently masked because the frontend always sends `search: ""`.
- **Recommendation:** Change to `SchedulerJob.job_name`.

### 11. `decrypt_simple_id` returns a tuple that is used as a scalar

- **Evidence:** `decrypt_simple_id` returns `(value, error)`
  ([`app/utils/crypto.py:64`](backend/app/utils/crypto.py)), but
  [`app/repositories/scheduler_repo.py:107`](backend/app/repositories/scheduler_repo.py) does
  `decoded_id = decrypt_simple_id(payload.collection_id)` and then filters
  `SchedulerJob.collection_id == decoded_id`.
- **Impact:** Filtering schedulers by collection compares an integer column against a tuple.
- **Recommendation:** Unpack both return values, as every other call site does.

### 12. Missing null check before dereferencing a report row

- **Evidence:**
  [`app/controllers/test_case_controller.py:416-419`](backend/app/controllers/test_case_controller.py) —
  the result of `.first()` is used as `test.test_report_file` without checking for `None`.
- **Impact:** `GET /report/details/{report_id}/api/{api_id}` raises a 500 when no matching row exists.
- **Recommendation:** Return a 404-style error response when the query yields nothing.

### 13. Project update writes attributes that are not columns

- **Evidence:** [`app/services/project_service.py:144-145`](backend/app/services/project_service.py) sets
  `obj.imageId` and `obj.imagePath`. [`Projects`](backend/app/models/tbl_projects.py) defines neither.
- **Impact:** Values are attached to the instance and silently discarded on commit.
- **Recommendation:** Remove the two assignments.

### 30. File handles opened for multipart tests are never closed

- **Evidence:**
  [`app/services/test_case_service.py:319-327`](backend/app/services/test_case_service.py) — `open(file_path, "rb")`
  inside the `files.append(...)` call, with no corresponding close.
- **Impact:** File-descriptor leak proportional to the number of file-upload scenarios executed.
- **Recommendation:** Collect handles and close them in a `finally` block.

### 31. Scenario request bodies are silently dropped on the collection-detail page

- **Evidence:** `getScenarioRequestInput` differs between the two workbench pages.
  [`collectionDetails/[collectionId]/page.tsx:1758-1786`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx)
  requires `scenario.request.mode` and otherwise falls through to `{mode:"json", requestBody:{}}`.
  [`uploadeCollection/page.tsx:961-993`](frontend/app/(auth)/uploadeCollection/page.tsx) handles the same
  shape by wrapping it as `{mode:"raw", raw: request}`.
- **Impact:** A scenario whose `request` is a plain object without a `mode` key — a shape the LLM
  regularly returns — loads with an empty body editor on `/collectionDetails`, but correctly on
  `/uploadeCollection`. Saving from that state persists the empty body.
- **Recommendation:** Extract one shared implementation and use the `uploadeCollection` behaviour.

### 32. A shadowed `buildScriptObject` strips script comments on one save path

- **Evidence:**
  [`collectionDetails/[collectionId]/page.tsx:920-933`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx)
  defines a local `buildScriptObject` inside `buildApiPayload` that filters out lines starting with `//`
  and never returns `null`. The component-level version at lines 1796-1826 preserves comments and returns
  `null` for placeholder-only scripts.
- **Impact:** Saving through **Save API** strips all comments from pre/post-request scripts; saving through
  **Save Scenarios** preserves them. The same script produces two different stored values.
- **Recommendation:** Delete the local definition so the component-level one applies.

### 33. A hard-coded environment variable name is stripped from displayed URLs

- **Evidence:**
  [`collectionDetails/[collectionId]/page.tsx:1282`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx) —
  `path: api.url.replace("{{env_base_url}}", "")` during bootstrap, while `fetchSingleApi` at line 1503
  sets `path: data.url` unmodified.
- **Impact:** The URL shown in the sidebar list differs from the URL shown after selecting the API. The
  name `env_base_url` is also assumed rather than read from the collection.
- **Recommendation:** Remove the replacement and render the stored URL consistently.

### 34. Query-parameter edits do not mark the request dirty on the collection-detail page

- **Evidence:** [`uploadeCollection/page.tsx:474`](frontend/app/(auth)/uploadeCollection/page.tsx) calls
  `setIsRequestDirty(true)` in the params effect; the equivalent effect at
  [`collectionDetails/[collectionId]/page.tsx:1081-1098`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx)
  does not.
- **Impact:** Editing query parameters on `/collectionDetails` produces no unsaved-changes warning, and
  the edits are lost when the user navigates away or selects another API.
- **Recommendation:** Set the dirty flag in both places.

### 14. `tbl_environments.createdAt` is declared twice

- **Evidence:** [`app/models/tbl_environments.py:14` and `:20`](backend/app/models/tbl_environments.py).
- **Impact:** The second declaration wins; the intent of the first is lost. Ambiguous model definition.
- **Recommendation:** Delete the duplicate.

### 15. `Collection.encrypted_id` is a method, not a property

- **Evidence:** [`app/models/tbl_collections.py:43-46`](backend/app/models/tbl_collections.py) — the
  `@property` decorator is inside the comment line `# 🔒 Encrypted ID property @property`.
- **Impact:** `collection.encrypted_id` evaluates to a bound method. Currently harmless because nothing
  reads it.
- **Recommendation:** Move the decorator onto its own line, or delete the unused member.

---

## Broken references

### 16. Frontend calls a scheduler-reports endpoint that does not exist

- **Evidence:**
  [`app/api/scheduler_report/[id]/reports/route.ts`](frontend/app/api/scheduler_report/[id]/reports/route.ts)
  proxies to `${API_URL}scheduler/{id}/reports`. `schedulerRouter` in
  [`app/routes/collection_routes.py`](backend/app/routes/collection_routes.py) exposes only `/create`,
  `/list` and `/delete/{scheduler_id}`.
- **Impact:** `/schedulerReport/[id]` can never load data.
- **Recommendation:** Implement the endpoint or remove the page.

### 17. Legal-AI routes call endpoints that do not exist

- **Evidence:** [`app/api/legalAi/category/list/route.ts`](frontend/app/api/legalAi/category/list/route.ts)
  and [`add/route.ts`](frontend/app/api/legalAi/category/add/route.ts) proxy to `master/category/list` and
  `master/category/save`. No `master` router exists in the backend.
- **Impact:** The Legal-AI category pages are non-functional. See
  [docs/features/legal-ai-categories.md](docs/features/legal-ai-categories.md).
- **Recommendation:** Remove, or implement the backend module.

### 18. `DashboardLayout` posts to a non-existent `/api/logout`

- **Evidence:**
  [`app/(main)/dashboard/DashboardLayout.tsx:92`](frontend/app/(main)/dashboard/DashboardLayout.tsx). No
  `app/api/logout/route.ts` exists.
- **Impact:** The logout handler always takes its error branch. Currently latent — the button that calls
  it is commented out.
- **Recommendation:** Remove the handler along with the rest of the unused auth UI.

---

## Data model

### 20. No migration tooling

- **Evidence:** [`app/database/connection.py:85-88`](backend/app/database/connection.py) —
  `Base.metadata.create_all(bind=engine)` at startup. No Alembic directory, no `versions/`, no migration
  scripts anywhere in the repository.
- **Impact:** `create_all` creates missing tables but never alters existing ones. Any column added to a
  model after a table exists is silently absent in the database.
- **Recommendation:** Introduce Alembic and baseline the current schema.

### 21. `.gitignore` excluded a source directory — ✅ RESOLVED

- **Evidence:** The root [`.gitignore`](.gitignore) contained bare `config/`, `tests/` and `scripts/`
  entries, which matched `backend/app/config/` at any depth.
- **Impact:** [`app/config/env.py`](backend/app/config/env.py) — the dotenv loader every backend module
  imports via `from app.config.env import env` — was excluded from version control. A fresh clone failed
  with `ModuleNotFoundError: No module named 'app.config.env'`.
- **Status:** **Resolved.** The three patterns are now anchored to the repository root (`/config/`,
  `/scripts/`, `/tests/`) and `env.py` is tracked. Verified that `backend/.env`, `backend/storage/` and
  `backend/logs/` remain ignored.

---

## Documentation

### 3. The backend readme describes a different product

- **Evidence:** [`backend/readme.md:5`](backend/readme.md) — *"A FastAPI-based application with AI-powered
  computer vision for fashion item detection, image processing, and vector-based similarity search using
  CLIP embeddings, and Qdrant vector database."*
- **Impact:** The first document a backend developer opens describes software that is not in this
  repository. Its setup commands, however, are accurate and are the source for this project's install
  steps.
- **Recommendation:** Replace the description and feature list; keep the install section.

### 4. The root README was a single line

- **Evidence:** Before this documentation effort, `README.md` contained only `# QAAPIAutomation`.
- **Impact:** No entry point for the project.
- **Status:** **Resolved** by the current documentation set.

### 27. Frontend README contains an invalid command and unused keys

- **Evidence:** [`frontend/README.md`](frontend/README.md) instructs `npm -i` (not a valid npm command;
  the correct form is `npm i`) and lists `NEXT_PUBLIC_OLA_MAPS_API_KEY`, `OLA_MAPS_API_KEY`,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY`, none of which are read by any source file.
- **Impact:** Setup instructions fail as written, and developers provision keys that are never used.
- **Recommendation:** Fix the command and reduce the key list to `NEXT_PUBLIC_API_URL` and `API_TOKEN`.

### 28. `run-dev.bat` opens the wrong port

- **Evidence:** [`frontend/run-dev.bat:16-18`](frontend/run-dev.bat) sets `PORT=3001` as a batch variable
  and then runs `npm run dev` without passing it, before opening `http://localhost:3001`.
- **Impact:** The browser opens a port nothing is listening on; the dev server is on 3000.
- **Recommendation:** Either pass the port to `next dev` or open 3000.

### 26. A personal name is embedded in the global error message

- **Evidence:** [`app/middlewares/exception_handler.py:37`](backend/app/middlewares/exception_handler.py) —
  `"message": "Rajesh Internal server error"`.
- **Impact:** A debug string is returned to end users on every unhandled exception.
- **Recommendation:** Change to a neutral message.

---

## Dead and duplicated code

### 22. The entire authentication stack is unreachable

- **Evidence:** [`app/routes/login_routes.py`](backend/app/routes/login_routes.py) is fully commented out
  and is never imported by [`app/main.py`](backend/app/main.py).
  [`app/repositories/auth_repository.py`](backend/app/repositories/auth_repository.py) imports
  `app.models.users_model`, **which does not exist**. `UserSessionVerifyMiddleware` and `verify_session`
  in [`app/middlewares/auth_middleware.py`](backend/app/middlewares/auth_middleware.py) both reference an
  `auth` variable that is never assigned.
- **Impact:** The repository appears to have authentication; it does not. Importing `auth_repository`
  would raise `ImportError`; calling `verify_session` would raise `NameError`.
- **Recommendation:** Remove, or complete and wire it in.

### 23. Home and Dashboard belong to a different product

- **Evidence:** [`app/(main)/home/page.tsx`](frontend/app/(main)/home/page.tsx) renders the heading
  "SMART CLOTH FINDER". [`app/(main)/dashboard/page.tsx`](frontend/app/(main)/dashboard/page.tsx) shows
  hard-coded product/store statistics and links to `/product-list`, `/store-list`, `/uploade` and
  `/history` — none of which exist.
- **Impact:** `next.config.ts` redirects `/` to `/home`, so this is the **first screen every user sees**.
  Four navigation targets 404.
- **Recommendation:** Replace with a real landing page, or redirect `/` to `/collections`.

### 24. The two workbench pages are a verbatim fork

- **Evidence:**
  [`collectionDetails/[collectionId]/page.tsx`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx)
  (3,146 lines) and [`uploadeCollection/page.tsx`](frontend/app/(auth)/uploadeCollection/page.tsx)
  (2,973 lines) duplicate `hydrateRequestBody`, `extractParamsFromUrl`, `extractQueryFromSource`,
  `buildUrlWithParams`, `buildScriptObject`, `buildApiPayload`, `handleSaveApiRequest`,
  `handleSaveSelectedScenarios`, `executeRun`, `saveApiOrder`, `handleApiReorder`, the Monaco setup and
  the injected `pm.d.ts` block.
- **Impact:** 6,119 lines — 44% of the frontend — where every change must be made twice. Issues 31, 32 and
  34 are direct consequences: the copies have already drifted.
- **Recommendation:** Extract a shared `<ApiWorkbench>` component and shared helper modules.

### 25. The scheduler uses a diverged copy of the execution engine

- **Evidence:**
  [`app/services/test_case_service_scheduler.py`](backend/app/services/test_case_service_scheduler.py) is a
  synchronous near-copy of [`app/services/test_case_service.py`](backend/app/services/test_case_service.py)
  that omits pre/post-request script execution entirely.
- **Impact:** A collection that passes when run manually can fail when run on a schedule, because scripts
  that generate auth headers or checksums never execute.
- **Recommendation:** Share one engine between both paths.

### 19. Case-sensitive import mismatch

- **Evidence:** [`app/(main)/home/page.tsx:4`](frontend/app/(main)/home/page.tsx) imports
  `"@/app/components/Button"`; the file is `button.tsx`.
- **Impact:** Builds succeed on Windows and macOS (case-insensitive filesystems) and **fail on Linux** —
  including most CI runners and container builds.
- **Recommendation:** Correct the import to `button`.

---

## Contract mismatches

### 35. The script editor advertises a `pm.*` API the runtime does not implement

- **Evidence:** The injected type definitions and completion provider
  ([`collectionDetails/[collectionId]/page.tsx:19-59` and `:574-616`](frontend/app/(auth)/collectionDetails/[collectionId]/page.tsx),
  duplicated in `uploadeCollection`) declare `pm.test`, `pm.expect`, `pm.sendRequest`,
  `pm.variables.get/set`, `pm.response.status`, `pm.response.headers`, `pm.response.responseTime`,
  `pm.request.url` and `pm.request.method`. The executor
  ([`app/utils/universal_runner.py:53-170`](backend/app/utils/universal_runner.py)) implements **none** of
  them. Conversely the runtime provides `pm.request.headers.add/upsert/all`, `pm.variables.replaceIn`,
  `postman.setEnvironmentVariable` and `CryptoJS.SHA256`, none of which are advertised.
- **Impact:** **The highest-impact issue in this list.** `pm.test(...)` autocompletes, type-checks cleanly
  and then throws at execution time. Users writing scripts are actively misled by the editor, and by
  Postman experience generally.
- **Recommendation:** Align the type definitions with
  [docs/features/pre-post-request-scripts.md](docs/features/pre-post-request-scripts.md), which documents
  the actually supported surface.

### 29. The LLM prompt advertises validation operators the validator does not implement

- **Evidence:** [`app/utils/test_case_llm.py:393`](backend/app/utils/test_case_llm.py) instructs Gemini
  that `neq`, `lt`, `not_contains` and `regex` are available. `validate_response` in
  [`app/services/test_case_service.py:88-120`](backend/app/services/test_case_service.py) implements only
  `exists`, `eq`, `type` (array only), `lte`, `gte`, `gt` and `contains`.
- **Impact:** Generated assertions using the unsupported operators fall through every branch and are
  recorded as `passed: false` with an empty message — indistinguishable from a genuine failure.
- **Recommendation:** Either implement the missing operators or remove them from the prompt.

### 3b. Swagger documentation is effectively empty

- **Evidence:** [`app/main.py`](backend/app/main.py) constructs `FastAPI()` with no title, version or
  description. No route declares a `response_model`, a `summary` or a `description`.
- **Impact:** `/docs` lists paths but describes neither the `{Success, Code, Error}` envelope nor any
  response shape, so it cannot serve as the API reference.
- **Recommendation:** Add `response_model`s, or treat [docs/api/](docs/api/) as the authoritative
  reference (the approach taken here).

---

## Items explicitly checked and found to be non-issues

- `/api/saveapi` appears in a comment in `collectionDetails/[collectionId]/page.tsx:3057`, not in a
  `fetch` call. The real call is `/api/collections/{collectionId}/saveapi`, which exists.
- The absence of CORS middleware is **correct** for this architecture — the browser only ever calls
  same-origin Next.js route handlers.
- `PK-apiToken` is read from a non-`NEXT_PUBLIC_` environment variable and injected server-side, so the
  shared token is **not** exposed to the browser. This part of the design is sound.
