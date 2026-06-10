# Phase 25 Completion Notes: Renewal Check Workflow

Implemented: 2026-06-06

## Summary

Phase 25 adds the `saas_renewal_check` workflow execution path.

The worker now logs in to the local vendor sandbox, navigates to billing, extracts renewal data, calculates price increase and savings opportunity, stores the result in run state, completes the run, and creates a receipt containing the extracted business result.

## Updated Files

```text
apps/worker/src/connector/sandbox-vendor.connector.ts
apps/worker/src/receipts/worker-receipt.service.ts
apps/worker/src/workflow-executor/workflow-executor.service.ts
tests/phase24-invoice-download-workflow.spec.ts
```

## Added Files

```text
tests/phase25-renewal-check-workflow.spec.ts
```

## Worker Execution

Implemented `SAAS_RENEWAL_CHECK` handling in `WorkflowExecutorService`:

1. Loads the queued workflow run.
2. Marks the run `RUNNING`.
3. Loads the active agent policy bundle.
4. Validates the vendor domain against policy `allowedDomains`.
5. Decrypts the run credential through the internal API.
6. Opens the sandbox through the controlled browser runtime.
7. Logs in with injected credentials.
8. Navigates to billing.
9. Extracts renewal data from the sandbox page.
10. Calculates monthly price increase.
11. Calculates monthly and annualized savings opportunity.
12. Captures a screenshot.
13. Completes the run through the internal API.
14. Creates a receipt containing the extracted result.

## Extracted Result

The workflow stores:

```json
{
  "vendorName": "Acme Analytics",
  "currentPlan": "Growth",
  "currentMonthlyPriceCents": 80000,
  "renewalMonthlyPriceCents": 110000,
  "renewalDate": "2026-07-15",
  "seatCount": 28,
  "unusedSeats": 5,
  "estimatedMonthlySavingsCents": 48000,
  "recommendation": "downgrade_to_starter",
  "monthlyPriceIncreaseCents": 30000,
  "monthlyPriceIncreasePercent": 37.5,
  "annualizedSavingsOpportunityCents": 576000
}
```

## Receipts

`WorkerReceiptService` now accepts an optional `resultJson` payload.

For Phase 25, the receipt stores the renewal result in `approvalDetailsJson.resultJson` until the dedicated receipts phase introduces a richer first-class receipt shape.

## Tests

Added:

```text
tests/phase25-renewal-check-workflow.spec.ts
```

Coverage:

- Renewal extraction succeeds.
- Missing renewal fields fail with a controlled validation error.
- Price increase and savings calculations are correct.
- Full API-to-worker-to-sandbox renewal workflow completes.
- Run result summary includes extracted business value.
- Receipt includes extracted result.
- Audit includes read-only policy evaluation events.
- Read-page action attempt records allow decision.
- No approval request is created.

Also hardened Phase 24 receipt assertions to wait for receipt creation after terminal run status.

## Validation

Passed:

```bash
pnpm typecheck
pnpm test -- tests/phase25-renewal-check-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase19-worker-foundation.spec.ts tests/phase22-connector.spec.ts tests/phase24-invoice-download-workflow.spec.ts tests/phase25-renewal-check-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
```

Full deterministic suite:

```text
26 test files passed
178 tests passed
```
