# Feature — Documents and KYC Extraction

## Overview

Defines named document types with rule lists (e.g. "PAN Card" → *"PAN number must be present"*), accepts
file uploads, extracts text via OCR, and uses Google Gemini to evaluate the extracted text against those
rules.

**Status:** Fully implemented backend and frontend. **Not reachable through the UI** — it sits behind the
commented-out Project menu.

> **Scope note.** This is a document-verification workflow with no connection to API testing. It shares
> the deployment, the database and the Gemini key, and nothing else. It is documented here because it is
> implemented and callable.

## Business purpose

KYC-style document checking: define what a valid document must contain, upload a scan or PDF, and get a
structured verdict per rule.

## User flow

1. Navigate to `/projects/save-Project` (URL only — no menu entry).
2. Create or select a project.
3. Add document types, each with a list of rules marked mandatory or optional.
4. Upload files.
5. Each file is OCR'd, evaluated against the rules, and the result is stored on the matching document row.

## Frontend flow

```
/projects/save-Project
  → POST /api/documents/save-document      create/update a rule set
  → POST /api/documents/document-list      list for the project
  → POST /api/documents/upload-documents   multipart upload
  → DELETE /api/documents/document-delete/{id}
```

`DocumentUpload.tsx` is a thin 20-line wrapper; the substantive logic lives inside the 1,048-line
`save-Project` page.

## Backend flow

```
POST /document/upload?project_id=N
  → verify the project exists                          Code 4040
  → load all status=1 documents for the project        Code 4040 "documents rules not found"
  → build document_rules = [{id, document_name, rules}]
  → for each file:
        save_local_file(userId, project_id, file)       storage/{userId}/{project_id}/{safe_name}
        ocr_extract_text(saved_path)                    → text
        extract_details(text, document_rules)           → Gemini → {id, rules, ...}
        save_document_and_get_id(db, project_id, details)  UPDATE file_path, result
  → success_response(uploaded, failed, results, errors)
```

### OCR pipeline

[`kyc_document_parser.py`](../../backend/app/utils/kyc_document_parser.py) dispatches on MIME type:

| Type | Handling |
| ---- | -------- |
| Image (`image/*`) | Base64-encoded and sent to Gemini Vision with *"Extract all readable text from this image."* |
| PDF | Opened with PyMuPDF. Pages with an embedded text layer are read directly; **only pages returning empty text** are rendered and sent to Gemini Vision |
| DOCX | `python-docx` |
| Anything else | `"other"` — unsupported |

The PDF path is the efficient one: a born-digital PDF costs no Gemini calls at all, while a scanned PDF
costs one vision call per page.

### Rule evaluation

Extracted text plus the project's rule sets are sent to Gemini, which returns a structured verdict stored
in `tbl_documents.result` (JSONB). The document row is matched by the `id` the model returns:

```python
db.query(Documents).filter(Documents.id == doc_id,
                           Documents.project_id == project_id,
                           Documents.status == 1
).update({"file_path": details.get("file_path"), "result": details.get("rules")})
```

If the model returns an id that does not match, the update affects zero rows, `updated_doc` is `None`, and
the response reports *"Upload failed. Mandatory fields are missing or invalid."* — the model's
classification decides which document row is written.

## API details

[../api/projects-and-documents.md](../api/projects-and-documents.md).

## Request and response

**Define a rule set:**

```json
{ "project_id": 3, "name": "PAN Card",
  "rules": [ { "rule": "PAN number must be present", "mandatory": true },
             { "rule": "Name must match the employee record", "mandatory": false } ] }
```

**Upload result:**

```json
{ "Success": { "message": "Files uploaded successfully",
    "data": { "uploaded": 2, "failed": 0,
      "results": [ { "details": { "id": 11, "name": "PAN Card", "result": { },
                                  "file_path": "http://127.0.0.1:8000/storage/..." },
                     "filename": "pan.pdf", "message": "File uploaded successfully." } ],
      "errors": [] } },
  "Code": 0, "Error": null }
```

Per-file exceptions are collected into `errors[]` without aborting the batch, so a partial success is a
`Code: 0` response.

## Validation

| Rule | Enforced by | Failure |
| ---- | ----------- | ------- |
| `rules[]` items are `{rule: str, mandatory: bool}` | `RuleItem` Pydantic model | HTTP 400, `Code: 1` |
| `project_id` present and the project exists | Controller | `Code: 4040` |
| `name` non-blank | `_validate_name` | `Code: 4030` |
| At least one file | Route + controller | `Code: 4002` / `4000` |
| Project must already have rule sets | Controller | `Code: 4040`, "documents rules not found" |

**File types are not validated.** Any file is accepted; `detect_file_type` classifies unknown types as
`"other"` and extraction yields nothing. There is no size limit.

## Database interaction

| Table | Operation |
| ----- | --------- |
| `tbl_documents` | INSERT, UPDATE, SELECT, soft delete; UPDATE `file_path` + `result` on upload |
| `tbl_projects` | SELECT for existence |

## Filesystem interaction

```
storage/{userId}/{project_id}/{sanitised_filename}
```

with

```python
userId = "U-98WZ41BUTTOM"   # request.state.userId
```

**`userId` is hard-coded.** Every upload from every caller lands in the same directory. The commented-out
alternative shows the intent — a per-user path — but there is no authentication to supply a user ID.

Filenames are sanitised with `re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)`, which strips directory
components and traversal sequences. **No timestamp is added**, so re-uploading the same filename
overwrites the previous file — unlike collection storage, which timestamps every write.

Note this path is *not* under `STORAGE_DIR` — `save_local_file` hard-codes the literal `storage/` prefix
rather than reading the environment variable.

## Authentication and authorization

`PK-apiToken` only. `createdBy`/`updatedBy` are hard-coded to `1`, and the storage `userId` is a
hard-coded constant. There is no per-user isolation of uploaded documents.

## Error handling

| Situation | Result |
| --------- | ------ |
| No files | `Code: 4002` |
| Project missing | `Code: 4040` |
| No rule sets defined | `Code: 4040` |
| Per-file exception | Collected into `errors[]`; the batch continues |
| No matching document | `details: null` with an explanatory message, inside a **successful** response |
| `GOOGLE_API_KEY` missing | The backend **fails to start** |

## Dependencies

`PyMuPDF` (`fitz`), `python-docx`, `Pillow`, `langchain-google-genai`, and a Gemini API key.

> `PyMuPDF` is declared in `requirements.txt`; **`Pillow` is not**, despite being imported.
> [AUDIT.md](../../AUDIT.md) issue 2.

## Known limitations

1. **Unreachable through navigation.**
2. **`userId` is a hard-coded constant** — no per-user separation of uploaded documents.
3. **Uploads overwrite on filename collision.**
4. **`save_local_file` ignores `STORAGE_DIR`**, hard-coding `storage/`.
5. **No file-type or size validation.**
6. **Fully synchronous.** Each file is OCR'd through Gemini before the response returns; a multi-page
   scanned batch can take minutes and there is no progress or queue.
7. **Document–rule matching is delegated to the model.** A misclassification writes the result to the
   wrong document row, or to none.
8. **Documents are orphaned when a project is deleted** — the foreign key is commented out.
9. **Uploaded documents are sent to Google.** For a KYC workflow this is a data-residency and privacy
   decision that must be made deliberately.
10. **Files are served publicly.** `app.mount("/storage", StaticFiles(...))` is **exempt from token
    verification** — anyone who knows or guesses a path can download any uploaded document without
    authentication. This is the most serious consequence of the hard-coded, unpredictable-but-static
    `userId` path being the only obscurity protecting them.
