# Feature — Legal-AI Categories

## Overview

Three frontend pages and two BFF route handlers for managing a category / sub-category hierarchy.

**Status: Non-functional.** The frontend is complete; the backend endpoints it calls **do not exist**.

## Business purpose

**Not verified from the current implementation.** Nothing in the repository explains what "Legal AI"
categories are for. There is no model, no table, no service and no README reference. Judging by the
naming and the payload shape, this is UI inherited from a different product.

## What exists

### Pages

| Page | Path | Lines |
| ---- | ---- | ----: |
| Categories | `/legalAi/categories` | 429 |
| Sub-category list | `/legalAi/subCategorieList` | 469 |
| Add sub-categories | `/legalAi/addSubCategories` | 152 |

### Route handlers

| Handler | Proxies to | Backend status |
| ------- | ---------- | -------------- |
| `POST /api/legalAi/category/list` | `POST {API_URL}master/category/list` | **Does not exist** |
| `POST /api/legalAi/category/add` | `POST {API_URL}master/category/save` | **Does not exist** |

### Navigation

Commented out in `DashboardLayout`:

```tsx
// {
//   icon: History,
//   label: "Category List",
//   path: "/legalAi/categories",
// },
```

## Why it cannot work

The backend registers eight routers in [`app/main.py`](../../backend/app/main.py):

```
/project  /document  /collections  /environment  /api  /api-test  /report  /scheduler
```

There is **no `/master` router**, no `master_routes.py`, no `MasterCategories` model and no
`tbl_master_categories` table. Every call from these pages resolves to a FastAPI 404.

The name `MasterCategories` does appear once in the codebase — inside a commented-out relationship in
[`tbl_documents.py`](../../backend/app/models/tbl_documents.py):

```python
# project = relationship("MasterCategories", back_populates="subcategories", lazy="selectin")
```

That is the only trace, and it points at a model that was never ported into this repository.

## Runtime behaviour

1. The page mounts and calls `/api/legalAi/category/list`.
2. The route handler forwards to `{API_URL}master/category/list`.
3. FastAPI returns 404 with `{"detail": "Not Found"}`.
4. The handler passes the payload through; the page finds no `Success.data` and renders empty.

No crash, no error toast in most paths — just a permanently empty list.

## API details

**None.** There is no backend API to document.

## Database interaction

**None.** No table exists.

## Authentication

Not applicable — no request ever reaches a real endpoint.

## Dependencies

Standard page dependencies (`DashboardLayout`, `Loader`, `Toast`). Nothing specific to this feature.

## Known limitations

The feature does not function. Its ~1,050 lines of frontend code are dead weight that:

- appear in `npm run lint` and any type-check,
- are indexed by editor search, producing misleading hits for anyone exploring the codebase,
- imply a backend capability that does not exist.

## Recommendation

Either remove the three pages and two route handlers, or implement the `/master/category/*` endpoints.
Tracked as [AUDIT.md](../../AUDIT.md) issue 17.
