# Phase 6 Completion Notes: AuditModule

Date: 2026-06-06

## Scope Implemented

Phase 6 added append-only audit logging and organization-scoped audit querying before business mutations are built.

Implemented endpoints:

- `GET /audit-events`
- `GET /audit-events/:id`

Implemented services:

- `AuditService`
- `AuditHashService`
- `AuditQueryService`
- `AuditRedactionService`

## AuditModule

Files:

- `apps/api/src/audit/audit.module.ts`
- `apps/api/src/audit/audit.controller.ts`
- `apps/api/src/audit/audit.types.ts`
- `apps/api/src/audit/index.ts`

Implemented:

- Protected audit read endpoints.
- `audit:read` permission requirement on all audit routes.
- Organization-scoped listing.
- Organization-scoped single-event lookup.
- Query validation with `zod`.

Supported list filters:

- `workflowRunId`
- `actorType`
- `actorId`
- `eventType`
- `from`
- `to`
- `limit`
- `offset`

## AuditService

File:

- `apps/api/src/audit/audit.service.ts`

Implemented:

- One-line `audit.record(...)` API for later modules.
- Runtime enum validation for actor type and event type.
- Payload redaction before storage.
- Previous hash lookup per organization.
- Append-only event creation.
- DTO response conversion.

Important:

- No update endpoint was added.
- No delete endpoint was added.

## AuditHashService

File:

- `apps/api/src/audit/audit-hash.service.ts`

Implemented:

- Deterministic SHA-256 hash generation.
- Stable object-key ordering before hashing.
- Hash input includes:
  - organization ID
  - workflow run ID
  - agent ID
  - actor type
  - actor ID
  - event type
  - event data JSON
  - previous hash

## AuditRedactionService

File:

- `apps/api/src/audit/audit-redaction.service.ts`

Implemented:

- Recursive secret-field masking.
- Masks fields matching the domain secret patterns:
  - password
  - token
  - secret
  - authorization
  - cookie
  - credential

Replacement value:

```text
[REDACTED]
```

## AuditQueryService

File:

- `apps/api/src/audit/audit-query.service.ts`

Implemented:

- Organization-scoped list query.
- Organization-scoped get-by-id query.
- Cross-organization audit reads return not found.
- Pagination metadata with `total`, `limit`, and `offset`.

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `AuditModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase6-audit.spec.ts`

Coverage:

- Hash is deterministic for identical input.
- Hash changes when payload changes.
- Redaction masks password, token, authorization, and cookie fields recursively.
- Creating an event stores a valid hash.
- Stored payload is redacted.
- Second event references the previous event hash.
- Unknown event type is rejected.
- Query filters by workflow run, actor, event type, and date.
- Owner and auditor can read audit events.
- Approver cannot read audit events.
- Cross-organization audit reads are rejected.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 7 test files passed.
- 52 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
