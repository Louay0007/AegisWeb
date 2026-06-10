# Phase 24 Completion Notes: Invoice Download Workflow

Implemented: 2026-06-06

## Summary

Phase 24 adds the first complete workflow execution path without approval.

An authenticated API caller can start a vendor invoice workflow, the API enqueues the run, the worker consumes the job, opens the local vendor sandbox, decrypts credentials through the internal API, logs in, downloads the invoice, uploads invoice and screenshot artifacts through the internal API, completes the run, and creates a receipt.

## Added Files

```text
apps/worker/src/receipts/worker-receipt.module.ts
apps/worker/src/receipts/worker-receipt.service.ts
tests/phase24-invoice-download-workflow.spec.ts
```

## Updated Files

```text
apps/worker/src/internal-api/internal-api-client.service.ts
apps/worker/src/worker.module.ts
apps/worker/src/workflow-executor/workflow-executor.module.ts
apps/worker/src/workflow-executor/workflow-executor.service.ts
```

## Worker Execution

Implemented `vendor_invoice_download` handling in `WorkflowExecutorService`:

1. Loads the queued workflow run.
2. Marks the run `RUNNING`.
3. Loads the active agent policy bundle.
4. Validates the vendor domain against policy `allowedDomains`.
5. Reads `credentialId` from workflow configuration.
6. Calls internal vault decrypt for the run.
7. Creates a controlled Playwright browser context.
8. Uses `SandboxVendorConnector` to log in.
9. Uses `SandboxVendorConnector` to download the latest invoice.
10. Uploads the invoice as `INVOICE`.
11. Captures and uploads a screenshot as `SCREENSHOT`.
12. Records `FILE_DOWNLOADED`.
13. Completes the run through the internal API.
14. Creates a receipt.

Existing no-op worker behavior remains for Phase 19 tests.

## Receipts

Added `WorkerReceiptService` as a temporary worker-side receipt builder until the dedicated `ReceiptsModule` phase.

It stores:

- Final run status.
- Audit timeline.
- File metadata.
- Screenshot metadata.
- Policy decisions from action attempts.
- Approval details when present.

Receipts never store plaintext credentials.

## Failure Paths

Implemented:

- Wrong credential marks the run `FAILED`.
- Wrong credential creates a failed receipt.
- Vendor domain outside policy allowlist marks the run `DENIED`.
- Policy denial creates a denied receipt.
- Policy denial stops before credential decrypt, so no credential use event is recorded.

## Tests

Added:

```text
tests/phase24-invoice-download-workflow.spec.ts
```

Coverage:

- Full API-to-worker-to-sandbox integration.
- Invoice file exists in MinIO.
- Screenshot file exists.
- Run status becomes `COMPLETED`.
- Receipt exists for completed run.
- Audit timeline includes credential use and file download.
- No approval request is created.
- Wrong credential causes failed run and failed receipt.
- Disallowed vendor domain causes denied run and denied receipt.

## Validation

Passed:

```bash
pnpm typecheck
pnpm test -- tests/phase24-invoice-download-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase19-worker-foundation.spec.ts tests/phase22-connector.spec.ts tests/phase23-internal-worker.spec.ts tests/phase24-invoice-download-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
```

Full deterministic suite:

```text
25 test files passed
175 tests passed
```
