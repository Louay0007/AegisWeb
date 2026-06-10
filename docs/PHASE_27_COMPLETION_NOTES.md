# Phase 27 Completion Notes: ReceiptsModule

Implemented: 2026-06-06

## Summary

Phase 27 implements the backend receipt trust artifact layer.

The API can now list receipts, read a complete receipt detail document, and export a receipt as JSON for completed, failed, denied, and canceled workflow outcomes. Receipt detail responses combine stored receipt data with workflow context, audit events, action attempts, files, and approval requests so the Angular receipt page can be powered from one backend response.

## Added Files

```text
apps/api/src/receipts/index.ts
apps/api/src/receipts/receipt-export.service.ts
apps/api/src/receipts/receipt-redaction.service.ts
apps/api/src/receipts/receipt-summary.builder.ts
apps/api/src/receipts/receipt-timeline.builder.ts
apps/api/src/receipts/receipts.controller.ts
apps/api/src/receipts/receipts.module.ts
apps/api/src/receipts/receipts.service.ts
apps/api/src/receipts/receipts.types.ts
tests/phase27-receipts.spec.ts
```

## Updated Files

```text
apps/api/src/app.module.ts
```

## API Endpoints

Implemented:

```http
GET /receipts
GET /receipts/:id
GET /receipts/:id/export
```

All endpoints require `receipt:read` permission and are scoped to the authenticated user's organization.

## Receipt Detail Shape

Receipt detail includes:

- Final receipt status.
- Workflow run status, current step, and terminal error when present.
- Agent, workflow, and vendor context.
- Timeline built from audit events, action attempts, files, and approval requests.
- File metadata from receipt JSON, not file contents.
- Policy decision summary.
- Approval details when present.
- Failed run summary enriched with the workflow error.

## Timeline Builder

`ReceiptTimelineBuilder` produces a sorted evidence timeline from:

```text
audit_events
action_attempts
files
approval_requests
```

Timeline entries are sorted by timestamp and stable ID fallback so the receipt page receives deterministic ordering.

## Redaction

`ReceiptRedactionService` recursively redacts sensitive keys before receipt detail or export responses are returned.

Redacted key patterns include:

```text
password
secret
token
authorization
cookie
credential
encryptedPayload
ciphertext
auth_tag
```

This protects receipt timeline metadata, audit payloads, policy decision JSON, file JSON, screenshots JSON, and export JSON.

## Export

`ReceiptExportService` currently exports the assembled receipt detail as a JSON attachment named:

```text
receipt-{receiptId}.json
```

This keeps the MVP export local, free, and testable while leaving room for a later PDF renderer.

## Tests

Added:

```text
tests/phase27-receipts.spec.ts
```

Coverage:

- Receipt listing with pagination and final status filter.
- Completed invoice receipt detail.
- Completed approval receipt detail.
- Failed run receipt detail with error summary.
- Denied run receipt detail.
- Timeline sorted by timestamp.
- Receipt detail redacts secret-like fields.
- Receipt export redacts secret-like fields.
- Cross-organization receipt reads are denied.
- Cross-organization receipt export is denied.

## Acceptance

Phase 27 acceptance is satisfied:

- Receipts are readable through backend APIs.
- Receipt page data is available from `GET /receipts/:id`.
- Export is available from `GET /receipts/:id/export`.
- No raw credentials or encrypted secret payload details are exposed.
- Organization isolation is enforced.
