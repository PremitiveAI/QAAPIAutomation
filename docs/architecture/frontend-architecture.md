# Frontend Architecture

Next.js 16 App Router application in [`frontend/`](../../frontend/).

## Directory layout

```
frontend/app/
├── layout.tsx              the only layout — Geist fonts, globals.css, .auth-bg wrapper
├── globals.css
├── (auth)/                 route group — pages (NO layout, NO guard)
│   ├── uploadeCollection/            2,973 lines — upload + workbench
│   ├── collectionDetails/[collectionId]/  3,146 lines — workbench for an existing collection
│   ├── collections/                  collection list
│   ├── report/                       test-run list
│   ├── test_result/[reportId]/       run detail + per-API drill-down
│   ├── shedularList/                 scheduler list
│   ├── schedulerReport/[id]/         scheduler run reports (backend endpoint absent)
│   ├── projects/                     createProjects, project-list, save-Project
│   └── legalAi/                      categories, subCategorieList, addSubCategories
├── (main)/                 route group — pages (NO layout, NO guard)
│   ├── home/                         landing page
│   └── dashboard/                    dashboard + DashboardLayout (the real chrome)
├── api/                    30 Route Handlers — the BFF proxy layer
├── components/             13 shared components
├── hooks/                  useContainerReady, useNetworkStatus
├── utils/                  api.ts, networkFetch.ts, crypto.ts, data-dummy.ts
└── lib/                    types.ts, data.ts
```

## Route groups carry no behaviour

`(auth)` and `(main)` are Next.js route groups: parentheses exclude the segment from the URL. In this
application they are **naming conventions only**.

- There is no `layout.tsx` in either group — only `app/layout.tsx` exists.
- There is no `middleware.ts` anywhere in the project.
- There is no login page and no route guard.

A page under `(auth)` is exactly as public as one under `(main)`. See
[../security/authentication-and-authorization.md](../security/authentication-and-authorization.md).

## Layout and chrome

`app/layout.tsx` sets metadata (`title: "Postaman App"`) and wraps children in a single `div.auth-bg`.
It contains a stray top-level `<link>` element for the Ola Maps stylesheet outside any component return —
inert, and a leftover from another project.

The real application chrome is `DashboardLayout`
([`app/(main)/dashboard/DashboardLayout.tsx`](../../frontend/app/(main)/dashboard/DashboardLayout.tsx)),
imported explicitly by each page rather than applied through the router. It renders the sidebar, the
mobile drawer, the footer and a logout modal.

Active sidebar entries:

| Label | Path |
| ----- | ---- |
| Collection → Upload Collection | `/uploadeCollection` |
| Collection → Collection List | `/collections` |
| Report | `/report` |
| Sheduler List | `/shedularList` |

Project and Category entries are present but commented out, which is why
[projects](../features/projects.md) and [legal-AI](../features/legal-ai-categories.md) are unreachable
through navigation.

## The BFF layer

`app/api/**/route.ts` contains 30 handlers. Each one:

1. Reads the incoming body or route params.
2. Calls FastAPI with `PK-apiToken`, `PK-role: User`, `PK-country: IN`, `PK-timezone: Asia/Kolkata`.
3. Guards against non-JSON responses.
4. Returns the backend payload verbatim with the backend's status code.

Two implementation styles coexist — `fetch` (most handlers) and `axios` (documents, projects, legal-AI).
The axios handlers additionally unwrap the envelope and reshape the payload, so their pages consume a
different response shape than the rest of the application.

Complete mapping:

| Frontend route | Backend endpoint |
| -------------- | ---------------- |
| `POST /api/collectionsUpload` | `POST /collections/upload` |
| `POST /api/collectionList` | `POST /collections/list` |
| `POST /api/collections/[id]/updateCollectionName` | `POST /collections/{id}/update-name` |
| `POST /api/reorder` | `POST /collections/reorder_api` |
| `GET /api/collections/[id]/enviroment` | `GET /environment/{id}/environment` |
| `POST /api/collections/[id]/updatEnviroment` | `POST /environment/{id}/environment/update` |
| `POST /api/collections/[id]/uploadEnviroment` | `POST /environment/{id}/environment/upload` |
| `GET /api/apiList/[collectionId]` | `GET /api/{id}/apis` |
| `GET /api/collections/[id]/apis/[apiId]` | `GET /api/{id}/apis/{apiId}` |
| `POST /api/collections/[id]/saveapi` | `POST /api/{id}/apis` |
| `POST /api/testGeneration` | `POST /api-test/generation` |
| `POST /api/savetest` | `POST /api-test/save` |
| `GET /api/runTest/[collectionId]` | `GET /api-test/run/{id}` |
| `POST /api/reportList` | `POST /report/list` |
| `GET /api/reportDetails/[reportId]` | `GET /report/details/{id}` |
| `GET /api/reportDetails/[reportId]/api/[apiId]` | `GET /report/details/{id}/api/{apiId}` |
| `POST /api/Scheduler/create` | `POST /scheduler/create` |
| `POST /api/Scheduler/List` | `POST /scheduler/list` |
| `DELETE /api/Scheduler/delete/[id]` | `DELETE /scheduler/delete/{id}` |
| `GET /api/scheduler_report/[id]/reports` | `GET /scheduler/{id}/reports` — **does not exist** |
| `POST /api/projects/save-project` | `POST /project/save` |
| `POST /api/projects/project-list` | `POST /project/list` |
| `GET /api/projects/project-details/[id]` | `GET /project/details/{id}` |
| `DELETE /api/projects/project-delete/[id]` | `DELETE /project/delete/{id}` |
| `POST /api/documents/save-document` | `POST /document/save` |
| `POST /api/documents/document-list` | `POST /document/list` |
| `DELETE /api/documents/document-delete/[id]` | `DELETE /document/delete/{id}` |
| `POST /api/documents/upload-documents` | `POST /document/upload?project_id=…` |
| `POST /api/legalAi/category/list` | `POST /master/category/list` — **does not exist** |
| `POST /api/legalAi/category/add` | `POST /master/category/save` — **does not exist** |

## Configuration

[`app/utils/api.ts`](../../frontend/app/utils/api.ts) exports every configuration value:

```ts
export const API_URL   = process.env.NEXT_PUBLIC_API_URL || "";
export const API_TOKEN = process.env.API_TOKEN || "";
// plus GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
//      SESSION_SECRET, ISSUER_URL, CLIENT_ID — exported, never consumed
```

Only the first two are used. Because the file is imported exclusively by server-side route handlers,
`API_TOKEN` never reaches the browser despite lacking a `NEXT_PUBLIC_` prefix — that is the intended
design.

`next.config.ts` declares one rule: a permanent redirect from `/` to `/home`.

## State management

There is none, in the library sense. Every page is a `"use client"` component using `useState`,
`useEffect`, `useRef` and `useCallback`. There is no Redux, Zustand, Jotai, React Query or Context
provider. Data is fetched in `useEffect` and held in component state; navigating away discards it.

`react-hook-form`, `@hookform/resolvers` and `zod` are dependencies in `package.json` but are **not
imported by any source file**. All forms are manually controlled.

## Data-loading patterns

**Infinite scroll**, used by `/collections`, `/report` and `/shedularList`:

```ts
const isFetchingRef = useRef(false);
const [offset, setOffset]   = useState(0);
const [hasMore, setHasMore] = useState(true);

const fetchX = useCallback(async () => {
  if (isFetchingRef.current || !hasMore) return;
  isFetchingRef.current = true;
  // POST { search, sort, order, limit: LIMIT, offset }
  setItems(prev => [...prev, ...newItems]);
  setOffset(prev => prev + LIMIT);
  if (newItems.length < LIMIT) setHasMore(false);
  isFetchingRef.current = false;
}, [offset, hasMore]);
```

`handleScroll` triggers the next page when the container reaches its bottom.

**Parallel bootstrap**, used by `/collectionDetails/[collectionId]`:

```ts
const [envRes, apiRes] = await Promise.all([
  fetch(`/api/collections/${collectionId}/enviroment`),
  fetch(`/api/apiList/${collectionId}`),
]);
```

A `didBootstrapRef` guard prevents a second run under React Strict Mode.

## Error handling

Three layers, applied inconsistently:

1. `res.ok` checks, then a `Toast` — the dominant pattern in the workbench pages.
2. `json.Code !== 0` checks — used by `/report`, not by most others.
3. `console.error` for the underlying exception.

[`app/utils/networkFetch.ts`](../../frontend/app/utils/networkFetch.ts) is a richer wrapper offering
`navigator.onLine` detection, an `AbortController` timeout and normalised error messages — but it is
**imported by no page**. `useNetworkStatus` is likewise unused.

## The workbench pages

`/uploadeCollection` and `/collectionDetails/[collectionId]` are the core of the product and are a
**verbatim fork** of one another — 6,119 lines, ~44% of the frontend. Shared logic includes
`hydrateRequestBody`, `extractParamsFromUrl`, `extractQueryFromSource`, `buildUrlWithParams`,
`buildScriptObject`, `buildApiPayload`, `handleSaveApiRequest`, `handleSaveSelectedScenarios`,
`executeRun`, `saveApiOrder`, `handleApiReorder`, the Monaco setup and the injected `pm.d.ts`.

They differ in entry point — one starts from an upload and owns the rename flow, the other bootstraps
from a route parameter — and they have **already drifted** in three behavioural ways. See
[AUDIT.md](../../AUDIT.md) issues 24, 31, 32 and 34, and
[../features/api-editor.md](../features/api-editor.md).

### Dirty-state model

Two independent flags drive the save button:

| Flag | Set when | Saved by |
| ---- | -------- | -------- |
| `isRequestDirty` | URL, headers, body, params or scripts change | `POST /api/collections/{id}/saveapi` |
| `hasUnsavedScenarios` | Scenarios are generated or edited | `POST /api/savetest` |

`isLoadingScriptsRef` suppresses false positives while scripts are loaded programmatically. The save
handler dispatches to exactly one endpoint — scenarios take priority, and the two calls are never
combined.

## Components

| Component | Purpose |
| --------- | ------- |
| `DashboardLayout` | Sidebar, header, footer, logout modal |
| `DynamicTableEditor` | Generic key/value/type row editor — drives form-data, urlencoded and params |
| `JsonTextEditor` | JSON textarea with parse-error reporting |
| `SchedulerPopup` | Cron/interval builder; loads collections and posts to the scheduler |
| `ConfirmModal` | Confirmation dialog with configurable labels |
| `InfoTooltip`, `StatCard`, `Toast`, `Loader`, `Pagination`, `Button`, `SafeImage`, `DocumentUpload` | Presentational |

## Build configuration

| File | Purpose |
| ---- | ------- |
| `next.config.ts` | `/` → `/home` permanent redirect |
| `tsconfig.json` | `strict: true`, `@/*` → project root, bundler resolution |
| `tailwind.config.ts` | `darkMode: "class"`, custom `primary` colour, Inter display font |
| `postcss.config.mjs` | `@tailwindcss/postcss` |
| `eslint.config.mjs` | `eslint-config-next` core-web-vitals + typescript |

`package.json` defines `dev`, `build`, `start` and `lint`. There is **no `test` script and no
type-check script**; `tsc --noEmit` would work but is not configured.
