# Testing Status

## Current state

**This repository contains no automated tests.**

Verified by exhaustive search across the whole repository (excluding `node_modules`):

| Searched for | Found |
| ------------ | ----- |
| `test_*.py`, `*_test.py` as test suites | **None** — see [the naming trap](#the-naming-trap) |
| `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` | **None** |
| `conftest.py`, `pytest.ini`, `tox.ini`, `setup.cfg`, `pyproject.toml` | **None** |
| `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*` | **None** |
| A `test` script in `package.json` | **None** |
| Test packages in `requirements.txt` | **None** — no `pytest`, `httpx`, `unittest2` |
| Test packages in `package.json` | **None** — no Jest, Vitest, Testing Library, Playwright, Cypress |
| CI configuration (`.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`) | **None** |
| `Dockerfile`, `docker-compose.yml`, `Makefile` | **None** |

There is no unit, integration, API, contract, end-to-end, snapshot or load testing of any kind, and no
coverage measurement.

## The naming trap

Five backend files match pytest's default collection pattern but are **application source**, not tests:

| File | What it actually is |
| ---- | ------------------- |
| `app/controllers/test_case_controller.py` | Controller for the test-case feature |
| `app/services/test_case_service.py` | The execution engine |
| `app/services/test_case_service_scheduler.py` | The scheduler's execution engine |
| `app/services/test_service.py` | A thin wrapper around `PostmanScriptEngine` |
| `app/utils/test_case_llm.py` | The Gemini prompt builder |

> **Do not run a bare `pytest` in `backend/`.** It would attempt to import all five as test modules.
> Since they execute module-level side effects on import — database connection, Gemini client
> construction — collection alone would hit the network and the database, and fail confusingly.
>
> If a suite is added later, configure `python_files` explicitly (e.g. `spec_*.py`) or place tests in a
> directory with a narrower `testpaths`.
>
> The root `.gitignore` previously carried a bare `tests/` entry that would have excluded a nested
> `tests/` directory from git. It is now anchored to `/tests/`, so a `backend/tests/` directory will be
> tracked normally. [AUDIT.md](../../AUDIT.md) issue 21 — resolved.

## Manual verification only

Correctness is currently established by running the application:

| Check | How |
| ----- | --- |
| Backend alive | `GET /` → `{"message": "FastAPI MVC Running"}` |
| Database connected | `✅ Database connected successfully!` at startup |
| Token enforcement | Call any endpoint without `PK-apiToken` → `Code: 5001` |
| End-to-end | The smoke test in [../setup/local-development.md](../setup/local-development.md#first-end-to-end-smoke-test) |
| API exploration | Swagger UI at `/docs` |

Swagger is of limited help: `FastAPI()` is constructed without metadata and no route declares a
`response_model`, so `/docs` shows paths and request schemas but no response shapes and no mention of the
`{Success, Code, Error}` envelope.

## Test data

No fixtures or factories exist. What the repository does contain is **~240 real artefacts** under
`backend/storage/`:

| Path | Contents |
| ---- | -------- |
| `storage/collections/{1..67}/collection_*.json` | Real uploaded Postman collections |
| `storage/collections/{id}/environment_*.json` | Environment exports |
| `storage/collections/{id}/test_report/{api_id}/report_*.json` | Real execution reports from Feb 2026 |

These are useful as **realistic input samples** for a future suite — particularly the collection files,
which exercise the parser's edge cases. They cannot seed a database, because the matching rows are not
included.

> Before reusing them, check for real credentials. Report files contain a full `environment` block, and
> collection files contain whatever the original author exported.

## Risk assessment

The absence of tests is most acute in these areas, ranked by the cost of a silent regression:

| Area | Why it matters | Suggested first coverage |
| ---- | -------------- | ------------------------ |
| `parse_postman_collection` | Pure function, many branches (nested folders, four body modes, variable extraction), and every downstream feature depends on it | Unit tests against the 67 stored collection files |
| `validate_response` | Pure function; a wrong verdict silently mislabels a passing API as failing | Unit tests per operator, including the four unimplemented ones |
| `hydrateRequestBody` / `buildApiPayload` | Round-trip must be lossless, and the two page copies have **already diverged** | Property test: hydrate → build → hydrate is stable |
| `UniversalJSExecutor` | The documented `pm.*` surface has no test asserting it exists | One test per supported call; assert the unsupported ones fail loudly |
| `decrypt_simple_id` | Returns a tuple; one caller already misuses it | Unit tests, then fix the caller |
| Scheduler repository | Two confirmed defects (`SchedulerJob.name`, tuple comparison) that tests would have caught immediately | Integration tests against a test database |
| Endpoint contracts | The envelope shape is a convention with nothing enforcing it | API tests asserting `{Success, Code, Error}` on every route |

Note how many entries above correspond to entries in [AUDIT.md](../../AUDIT.md). Issues 10, 11, 12, 31 and
32 are all failures a modest test suite would have caught before they shipped.

## A pragmatic first suite

If testing is introduced, this ordering gives the most protection per unit of effort:

**1. Backend unit tests — no database, no network**

```
pytest + the pure functions:
  collection_parser.parse_postman_collection      ← highest value
  collection_parser.normalize_postman_raw_json
  env_extractor.extract_env_vars
  test_case_service.validate_response
  test_case_service.replace_env_vars / process_env_vars / get_nested_value
  crypto.encrypt_simple_id / decrypt_simple_id
  universal_runner.UniversalJSExecutor            ← locks the pm.* contract
```

These require no fixtures beyond the stored collection files and would take a day.

**2. Backend API tests** — `httpx` + FastAPI's `TestClient` against a throwaway PostgreSQL database,
asserting the envelope, the error codes and the ID-encoding rules on all 31 endpoints.

**3. Frontend unit tests** — Vitest over the extracted workbench helpers. This is worth doing **after**
deduplicating the two pages ([AUDIT.md](../../AUDIT.md) issue 24), since testing a forked implementation
twice is the wrong investment.

**4. End-to-end** — Playwright over the smoke path: upload → edit → generate → save → run → report.
Requires stubbing Gemini.

**5. CI** — run the above on every push. There is currently no pipeline at all, so even lint plus unit
tests would be a step change.

## Linting and static analysis

| Tool | Configured | Command |
| ---- | :--------: | ------- |
| ESLint | ✅ | `npm run lint` |
| TypeScript | Partially — `strict: true` in `tsconfig.json`, but **no script** | `npx tsc --noEmit` works |
| Prettier | ❌ | — |
| Ruff / Flake8 / Black / isort | ❌ | — |
| mypy | ❌ | — |

The backend has **no static analysis whatsoever**. Adding `ruff` would be a single dependency and would
immediately surface several items in the audit — the undefined `auth` variable in `auth_middleware.py`,
the missing `users_model` import, and the unused imports across the services.

## The irony worth stating plainly

This is a QA automation platform with no QA automation of its own. That is not a criticism of the
codebase's purpose — it is the single most actionable observation in this documentation set, and the
fastest route to making the other 35 audit items stop recurring.
