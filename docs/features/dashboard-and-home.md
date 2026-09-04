# Feature — Dashboard and Home

## Overview

The landing page (`/home`) and a dashboard (`/dashboard`). Both are **placeholder screens inherited from
a different product** and display no data from this application.

**Status:** Present and rendering. Non-functional as features.

This matters more than the other inherited code, because `next.config.ts` redirects `/` to `/home`:

```ts
async redirects() {
  return [{ source: "/", destination: "/home", permanent: true }];
}
```

**`/home` is the first screen every user sees.**

## `/home`

[`app/(main)/home/page.tsx`](../../frontend/app/(main)/home/page.tsx) — 38 lines.

Renders:

- A heading: **"SMART CLOTH FINDER"**
- A subheading: *"Discover Fashion Instantly with AI and Location Intelligence."*
- A "Lets Start" button → `/dashboard`
- A footer: *"© 2026 Developed and Designed by PremitiveKey"*

Nothing on the page relates to API testing. Commented-out Login and Signup buttons remain in the source,
pointing at `/login` and `/sign-up` — neither of which exists.

The file also carries a latent portability bug:

```tsx
import { Button } from "@/app/components/Button";   // the file is button.tsx
```

This resolves on Windows and macOS and **fails to build on Linux**. [AUDIT.md](../../AUDIT.md) issue 19.

## `/dashboard`

[`app/(main)/dashboard/page.tsx`](../../frontend/app/(main)/dashboard/page.tsx) — 214 lines.

Renders four stat cards with **hard-coded values**:

| Card | Value | Links to | Exists? |
| ---- | ----- | -------- | ------- |
| Total Products | `1,284` | `/product-list` | ❌ |
| Active Stores | `12` | `/store-list` | ❌ |
| Total Scans | `850` | `/uploade` | ❌ |
| Search History | `2.4k` | `/history` | ❌ |

Plus a "Recent Inventory Changes" list with three hard-coded entries ("Vintage Denim Jacket", "Downtown
Hub", "Leather Boots"), and three quick-action buttons pointing at `/add-product`, `/add-store` and
`/history` — none of which exist.

**Every navigation target on this page 404s.** No API call is made anywhere in the file.

One piece of live behaviour remains — reading a `username` cookie that nothing ever sets:

```tsx
const match = document.cookie.match(/(?:^|;\s*)username=([^;]+)/);
if (match && match[1]) setUsername(decodeURIComponent(match[1]));
```

It always falls back to `"User"`.

## `DashboardLayout` — the exception

[`DashboardLayout.tsx`](../../frontend/app/(main)/dashboard/DashboardLayout.tsx) lives in the same
directory but is **genuinely used**. Every real page imports it for the sidebar, header and footer. It is
documented in [../architecture/frontend-architecture.md](../architecture/frontend-architecture.md).

Two dead fragments remain inside it:

- `handleLogout` POSTs to `/api/logout`, which does not exist. The button that calls it is commented out.
  [AUDIT.md](../../AUDIT.md) issue 18.
- A parent menu item without children calls `router.push(item.path)` **twice** — once in the `else`
  branch and once unconditionally afterwards.

## Other inherited fragments

| File | Status |
| ---- | ------ |
| [`app/lib/types.ts`](../../frontend/app/lib/types.ts) | `DocumentType`, `Employee` types — unused |
| [`app/lib/data.ts`](../../frontend/app/lib/data.ts) | `employees: Employee[] = []` — an empty array, unused |
| [`app/utils/data-dummy.ts`](../../frontend/app/utils/data-dummy.ts) | Dummy data — unused |
| [`app/utils/crypto.ts`](../../frontend/app/utils/crypto.ts) | AES-256-CBC helpers — imported by nothing |
| [`app/components/logout.tsx`](../../frontend/app/components/logout.tsx) | `LogoutHandler` — imported by nothing |
| `app/layout.tsx` | Metadata title is `"Postaman App"`; a stray Ola Maps `<link>` sits outside any component |
| [`app/core/prompts.py`](../../backend/app/core/prompts.py) | Backend: `PERSON_PROMPT` and `OBJECT_PROMPT` for fashion-item vision — unused |

The backend equivalent is [`backend/readme.md`](../../backend/readme.md), which still describes *"AI-powered
computer vision for fashion item detection … CLIP embeddings … Qdrant vector database."*
[AUDIT.md](../../AUDIT.md) issue 3.

Together these confirm the same origin: this repository was forked from a fashion/retail product.

## API details

**None.** Neither page makes a single API call.

## Database interaction

**None.**

## Known limitations

1. **`/` redirects to a page for a different product.** First impressions are of "Smart Cloth Finder".
2. **Every link on `/dashboard` is broken** — seven targets, zero of which exist.
3. **All figures are fabricated** and could be mistaken for real metrics.
4. **A Linux build failure** is latent in `/home`'s import casing.
5. **No genuine dashboard exists** for this product, despite the data being available — collection count,
   recent runs and pass rates could all be assembled from existing endpoints.

## Recommendation

The cheapest correct fix is to change the redirect target and delete both pages:

```ts
return [{ source: "/", destination: "/collections", permanent: true }];
```

`DashboardLayout` must be kept — move it out of `(main)/dashboard/` if the directory is removed. Tracked
as [AUDIT.md](../../AUDIT.md) issue 23.
