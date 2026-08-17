# Documentation Index

Documentation for **QA API Automation** — an AI-assisted API testing platform built on FastAPI and
Next.js.

Everything here is derived from the source code. Where a fact could not be established from the
repository, it is marked **Not verified from the current implementation.**

---

## Start here

| If you want to… | Read |
| --------------- | ---- |
| Understand what the system is and how the pieces fit | [architecture/system-overview.md](architecture/system-overview.md) |
| Get it running on your machine | [setup/local-development.md](setup/local-development.md) |
| Call the API | [api/overview.md](api/overview.md) |
| Know what is broken before you touch it | [../AUDIT.md](../AUDIT.md) |

---

## Architecture

| Document | Contents |
| -------- | -------- |
| [system-overview.md](architecture/system-overview.md) | Topology, BFF pattern, request lifecycle, technology inventory |
| [backend-architecture.md](architecture/backend-architecture.md) | Layering, middleware order, response envelope, error handling, logging |
| [frontend-architecture.md](architecture/frontend-architecture.md) | App Router structure, route groups, BFF handlers, state, editors |
| [data-flow.md](architecture/data-flow.md) | End-to-end flow: upload → generate → save → run → report |

## Setup

| Document | Contents |
| -------- | -------- |
| [prerequisites.md](setup/prerequisites.md) | Required runtimes, services and accounts |
| [backend-setup.md](setup/backend-setup.md) | Step-by-step backend install and run, with verified commands |
| [frontend-setup.md](setup/frontend-setup.md) | Step-by-step frontend install and run |
| [database-setup.md](setup/database-setup.md) | Database creation, automatic table creation, no-migrations caveat |
| [environment-variables.md](setup/environment-variables.md) | Complete variable inventory for both applications |
| [local-development.md](setup/local-development.md) | Startup order, ports, health verification, daily workflow |

## API reference

| Document | Contents |
| -------- | -------- |
| [overview.md](api/overview.md) | Headers, response envelope, ID encoding, pagination, conventions |
| [error-codes.md](api/error-codes.md) | Every `Code` value the backend can return, and its origin |
| [collections-and-environments.md](api/collections-and-environments.md) | `/collections` (5) and `/environment` (3) |
| [apis-and-test-cases.md](api/apis-and-test-cases.md) | `/api` (3) and `/api-test` (3) |
| [reports.md](api/reports.md) | `/report` (3) |
| [scheduler.md](api/scheduler.md) | `/scheduler` (3) |
| [projects-and-documents.md](api/projects-and-documents.md) | `/project` (5) and `/document` (5) |

## Database

| Document | Contents |
| -------- | -------- |
| [schema.md](database/schema.md) | All 8 tables, columns, keys, relationships, audit fields, ERD |

## Features

| Document | Status |
| -------- | ------ |
| [collection-upload.md](features/collection-upload.md) | Implemented |
| [api-editor.md](features/api-editor.md) | Implemented |
| [ai-test-generation.md](features/ai-test-generation.md) | Implemented |
| [test-execution-engine.md](features/test-execution-engine.md) | Implemented |
| [pre-post-request-scripts.md](features/pre-post-request-scripts.md) | Implemented — **read before writing any script** |
| [reporting.md](features/reporting.md) | Implemented |
| [scheduler.md](features/scheduler.md) | Implemented |
| [projects.md](features/projects.md) | Implemented, not linked in navigation |
| [documents-kyc.md](features/documents-kyc.md) | Implemented, not linked in navigation |
| [legal-ai-categories.md](features/legal-ai-categories.md) | Frontend only — backend absent |
| [dashboard-and-home.md](features/dashboard-and-home.md) | Placeholder screens |

## Integrations, security, testing, troubleshooting

| Document | Contents |
| -------- | -------- |
| [integrations/google-gemini.md](integrations/google-gemini.md) | Model configuration, prompts, cost and failure behaviour |
| [security/authentication-and-authorization.md](security/authentication-and-authorization.md) | The token-only model, and everything that is not implemented |
| [testing/testing-status.md](testing/testing-status.md) | Current state (no automated tests) and a proposed first suite |
| [troubleshooting/common-issues.md](troubleshooting/common-issues.md) | Symptom → cause → fix for the failures you will actually hit |

## Audit

| Document | Contents |
| -------- | -------- |
| [../AUDIT.md](../AUDIT.md) | 36 confirmed issues with file-and-line evidence, grouped by category |

---

## Conventions used in these documents

- **Verified** statements cite a file and, where useful, a line number.
- Endpoint tables list the request shape exactly as the Pydantic schema defines it — no invented fields.
- Response examples show the real `{Success, Code, Error}` envelope, including the fact that errors are
  returned with HTTP 200.
- Behaviour that is implemented but broken is documented as it actually behaves, with a cross-reference
  to the corresponding [AUDIT.md](../AUDIT.md) entry.
