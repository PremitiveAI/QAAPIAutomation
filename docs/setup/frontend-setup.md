# Frontend Setup

All commands below come from [`frontend/package.json`](../../frontend/package.json),
[`frontend/README.md`](../../frontend/README.md), `run-dev.bat` or `run-prod.bat`.

## Step 1 — Navigate to the frontend

```bash
cd frontend
```

## Step 2 — Check Node.js

```bash
node -v
```

`frontend/README.md` links the **v24.12.0** installer. `run-dev.bat` and `run-prod.bat` both verify that
`node` and `npm` are on `PATH` before starting.

## Step 3 — Check the package manager

```bash
npm -v
```

Only `package-lock.json` is present — no `yarn.lock`, `pnpm-lock.yaml` or `bun.lockb` — so **npm is the
package manager for this project**. Using another manager would regenerate the lockfile and drift from
the pinned tree.

## Step 4 — Install dependencies

```bash
npm i
```

> `frontend/README.md` instructs `npm -i`, which is not a valid npm command. The correct form is `npm i`
> (or `npm install`). See [AUDIT.md](../../AUDIT.md) issue 27.

`node_modules/` is not present in a fresh checkout, so this step is mandatory.

## Step 5 — Configure environment variables

Create `frontend/.env.local`. No env file is committed — `.gitignore` excludes `.env*`, and no
`.env.example` exists.

```ini
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/
API_TOKEN=<the same value as backend/.env API_TOKEN>
```

Two things matter here:

**The trailing slash is required.** Route handlers concatenate directly:

```ts
await fetch(`${API_URL}collections/list`, { ... })
```

Without the slash this produces `http://127.0.0.1:8000collections/list`. Two handlers
(`projects/project-list`, `projects/project-delete`) normalise with `API_URL.replace(/\/$/, "")` and
tolerate either form, but the other 28 do not.

**`API_TOKEN` must not have a `NEXT_PUBLIC_` prefix.** It is read only inside server-side route
handlers, so Next.js keeps it out of the client bundle. Adding the prefix would publish your shared token
to every browser.

`frontend/README.md` also lists `NEXT_PUBLIC_OLA_MAPS_API_KEY`, `OLA_MAPS_API_KEY`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY`. **No source file reads any of them** — they
are leftovers from another project and can be omitted. See
[environment-variables.md](environment-variables.md).

## Step 6 — Configure the backend URL

Covered by `NEXT_PUBLIC_API_URL` above. There is no separate API-client configuration file; every value
flows through [`app/utils/api.ts`](../../frontend/app/utils/api.ts).

## Step 7 — Authentication configuration

**None required.** There is no login flow, no session, no OAuth provider and no auth-related
configuration. The only credential is the shared `API_TOKEN`. See
[../security/authentication-and-authorization.md](../security/authentication-and-authorization.md).

## Step 8 — Start the development server

```bash
npm run dev
```

Serves on **<http://localhost:3000>**. The root path redirects to `/home` (`next.config.ts`).

Windows convenience script:

```bash
run-dev.bat
```

> `run-dev.bat` sets `PORT=3001` as a batch variable but never passes it to `next dev`, then opens
> `http://localhost:3001` — where nothing is listening. The server is on **3000**. See
> [AUDIT.md](../../AUDIT.md) issue 28.

## Step 9 — Build for production

```bash
npm run build
```

## Step 10 — Start the production server

```bash
npm run start
```

Serves on port 3000. `run-prod.bat` chains build and start and opens the browser at the correct port.

## Step 11 — Run tests

**Not verified from the current implementation.** `package.json` has no `test` script, and no Jest,
Vitest, Playwright, Cypress or Testing Library packages are installed. See
[../testing/testing-status.md](../testing/testing-status.md).

## Step 12 — Lint

```bash
npm run lint
```

Runs `eslint` with `eslint-config-next` core-web-vitals plus TypeScript rules
([`eslint.config.mjs`](../../frontend/eslint.config.mjs)).

## Step 13 — Type-check

**Not verified from the current implementation.** There is no `typecheck` script. TypeScript is installed
and `tsconfig.json` sets `strict: true`, so the following works even though the repository does not
define it:

```bash
npx tsc --noEmit
```

## Step 14 — Verify

1. Open <http://localhost:3000> — you should be redirected to `/home`.
2. Navigate to `/collections`. An empty backend shows "No more collections"; a populated one lists
   collections with API counts.
3. Open the browser Network tab. Requests should go to `localhost:3000/api/...`, **never** directly to
   `localhost:8000`. If you see direct backend calls, something bypassed the BFF layer.
4. Confirm no `PK-apiToken` header is visible in browser requests — it is added server-side.

If `/collections` shows an empty list while the backend has data, the usual cause is a missing trailing
slash on `NEXT_PUBLIC_API_URL` or a mismatched `API_TOKEN`. See
[../troubleshooting/common-issues.md](../troubleshooting/common-issues.md).

## Command reference

| Purpose | Command | Required | Verified from |
| ------- | ------- | -------- | ------------- |
| Node version | `node -v` | Yes | `frontend/README.md`, `run-dev.bat` |
| Package manager | `npm -v` | Yes | `package-lock.json`, `run-dev.bat` |
| Install dependencies | `npm i` | Yes | `frontend/README.md` (shown there as `npm -i`) |
| Development server | `npm run dev` | Yes | `package.json` scripts |
| Production build | `npm run build` | Optional | `package.json` scripts |
| Production server | `npm run start` | Optional | `package.json` scripts |
| Lint | `npm run lint` | Optional | `package.json` scripts |
| Dev helper (Windows) | `run-dev.bat` | Optional | repository file |
| Prod helper (Windows) | `run-prod.bat` | Optional | repository file |
| Tests | — | — | Not verified from the current implementation |
| Type check | — | — | Not verified from the current implementation |
| Format | — | — | Not verified from the current implementation |

## Key dependencies

| Package | Used for | Actually imported |
| ------- | -------- | ----------------- |
| `next`, `react`, `react-dom` | Framework | Yes |
| `@monaco-editor/react` | Script editor in the workbench | Yes |
| `@dnd-kit/*` | Drag-and-drop API reordering | Yes |
| `lucide-react` | Icons | Yes |
| `axios` | Some BFF route handlers | Yes |
| `tailwindcss` | Styling | Yes |
| `recharts` | Charts | Yes |
| `react-hook-form`, `@hookform/resolvers`, `zod` | Forms and validation | **No** — every form is manually controlled |
| `exceljs`, `mammoth`, `pdf-parse`, `tesseract.js` | Document processing | **No** |
| `express`, `express-session`, `cookie-parser`, `openid-client` | Server / auth | **No** |
| `olamaps-web-sdk`, `@types/google.maps` | Maps | **No** |
| `uuid` | IDs | **No** — pages use `crypto.randomUUID()` with a manual fallback |

Roughly a third of the declared dependencies are unused, inherited from an earlier project. They inflate
install time and the audit surface but do not affect runtime behaviour.
