# Feature — Projects

## Overview

CRUD for a "project" entity — a named container with a description, which owns a set of
[document rule sets](documents-kyc.md).

**Status:** Fully implemented backend and frontend. **Not reachable through the UI** — the sidebar entry
is commented out.

> **Scope note.** Projects and Documents form a document-verification workflow that is functionally
> independent of the API-testing product. There is no foreign key, no shared table and no code path
> connecting `tbl_projects` to `tbl_collections`. This documentation covers them because they are
> implemented and callable, not because they participate in API testing.

## Business purpose

Projects group document rule sets so that an uploaded file can be checked against the rules defined for
one project. Beyond that grouping they carry no behaviour.

## User flow

Reachable only by typing the URL — `DashboardLayout` has the Project menu block commented out:

```tsx
//   {
//     icon: Projector,
//     label: "Project",
//     children: [
//       { label: "Create Project", path: "/projects/save-Project" },
//       { label: "Project List",   path: "/projects/project-list" },
//     ],
//   },
```

| Page | Path | Purpose |
| ---- | ---- | ------- |
| Project list | `/projects/project-list` | List with delete |
| Save project | `/projects/save-Project` | Create/edit a project **and** manage its documents (1,048 lines) |
| Create projects | `/projects/createProjects` | A second, simpler create form |

## Frontend flow

```
/projects/project-list
  → POST /api/projects/project-list        (the handler hard-codes the payload: limit 100, offset 0)
  → reads  data.data                        ← the handler reshapes the envelope
  → delete → DELETE /api/projects/project-delete/{id}

/projects/save-Project
  → GET  /api/projects/project-details/{id}
  → POST /api/projects/save-project
  → then the document sub-flow (see documents-kyc.md)
```

The project route handlers use `axios` and **unwrap the envelope**, returning `{message, data}` instead
of `{Success, Code, Error}`. These pages therefore consume a different response shape from the rest of
the application.

## Backend flow

```
POST   /project/save          → ProjectController.project_save  → ProjectService.create_master / update_master
POST   /project/list          → ProjectController.list_projects → ProjectService.list_projects
GET    /project/details/{id}  → ProjectController.get_project    → ProjectService.get_master_by_id
DELETE /project/delete/{id}   → ProjectController.delete_project → ProjectService.delete_master
```

`ProjectService` is written generically — every method takes a `model` argument — and is shared in style
with `DocumentService`. `create_master` and `update_master` even probe for a `category_id` attribute that
`Projects` does not have, evidence of the generic base being reused from another codebase.

## API details

[../api/projects-and-documents.md](../api/projects-and-documents.md).

## Request and response

**Create** — `{"name": "Payments API", "description": "Regression suite"}`
**Update** — the same with `"id": 3`.

```json
{
  "Success": { "message": "Created successfully",
    "data": { "id": 3, "name": "Payments API", "description": "Regression suite",
              "createdAt": "11-Feb-2026 07:05:52", "updatedAt": "11-Feb-2026 07:05:52", "status": 1,
              "total_docs": 0, "pending_docs": 0, "uploaded_docs": 0 } },
  "Code": 0, "Error": null
}
```

The three counts are recomputed on **every** project response:

| Field | Definition |
| ----- | ---------- |
| `total_docs` | `status = 1` and `deletedAt IS NULL` |
| `pending_docs` | …with `file_path` null or empty |
| `uploaded_docs` | …with a non-empty `file_path` |

## Validation

| Rule | Enforced by | Failure |
| ---- | ----------- | ------- |
| `name` required and non-blank | `_validate_name` in the service | `Code: 4030`, "Name is required" |
| Record must exist on update/delete | Service | `Code: 4040`, "Record not found" |

`projetcCreateReq` (the misspelling is in the source) types `name: str` and everything else optional.
There is no length limit beyond the column's `String(255)`, no uniqueness constraint, and no check that
`description` fits `String(500)` — an over-long description raises a database error surfacing as HTTP 500.

## Database interaction

| Table | Operation |
| ----- | --------- |
| `tbl_projects` | INSERT, UPDATE, SELECT, soft delete (`status = -1`, `deletedAt`) |
| `tbl_documents` | Three COUNT queries per project response |

Listing 100 projects issues 301 queries — one list query plus three counts each. The frontend handler
hard-codes `limit: 100`.

## Authentication and authorization

`PK-apiToken` only. `createdBy` and `updatedBy` are hard-coded:

```python
admin_id = 1   # request.state.adminUserId
```

The commented-out original shows the intent — a real user ID from the session — but no session exists.
Every project is attributed to user `1`.

## Error handling

| Situation | Result |
| --------- | ------ |
| Missing/blank name | `Code: 4030` |
| Unknown id on update | `Code: 4040` |
| Unknown or already-deleted id on delete | `Code: 4040` |
| Soft-deleted project fetched by id | `Code: 4040` (filter is `status == 1`) |

## Dependencies

`passlib` is imported by `project_service.py` (`CryptoContext`) but never used — another inherited
artefact.

## Known limitations

1. **Unreachable through navigation.** The menu entry is commented out.
2. **Two create pages exist** — `/projects/save-Project` and `/projects/createProjects` — with no
   indication of which is canonical.
3. **`imageId` and `imagePath` are assigned on update but are not columns**, so the values are silently
   discarded. [AUDIT.md](../../AUDIT.md) issue 13.
4. **Deleting a project orphans its documents.** `tbl_documents.project_id` has its foreign key commented
   out, so there is no cascade and no integrity check.
5. **The list handler reads `totalRecords`, the backend returns `count`** — the page's total is always
   `0`.
6. **N+1 counting** — three extra queries per project.
7. **All records are attributed to user `1`.**
8. **No connection to API testing.** Projects cannot own collections, and collections cannot belong to a
   project.
9. **`ProjectService.list_master` and `list_products_minimal` are unused** duplicates of `list_projects`.
10. **Sorting is ignored.** The payload accepts `sort` but the query always orders by `id`.
