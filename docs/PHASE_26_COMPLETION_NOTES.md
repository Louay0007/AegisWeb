# Phase 26 Completion Notes: Plan Downgrade Approval Workflow

Implemented: 2026-06-06

## Summary

Phase 26 implements the flagship MVP approval loop.

The worker can now start a `plan_downgrade_request`, prepare a downgrade proposal, pause the workflow for human approval, resume after approval, submit the downgrade in the vendor sandbox, store final evidence, complete the run, and create a receipt containing approval and final action details.

## Updated Files

```text
apps/worker/src/internal-api/internal-api-client.service.ts
apps/worker/src/queue/worker-queue.service.ts
apps/worker/src/workflow-executor/workflow-executor.service.ts
tests/phase24-invoice-download-workflow.spec.ts
```

## Added Files

```text
tests/phase26-plan-downgrade-approval-workflow.spec.ts
```

## Worker Queue

`WorkerQueueService` now starts workers for:

```text
workflow-runs
workflow-resume
```

The existing queue status shape remains backward-compatible while also exposing per-queue status.

## Start Flow

Implemented `PLAN_DOWNGRADE_REQUEST` start handling:

1. Marks the run `RUNNING`.
2. Loads active policy.
3. Validates vendor domain.
4. Decrypts credential through internal API.
5. Logs in to sandbox.
6. Reads renewal data.
7. Prepares downgrade proposal.
8. Records `CHANGE_PLAN` attempt with `REQUIRE_APPROVAL`.
9. Captures approval screenshot.
10. Uploads screenshot.
11. Creates internal approval request.
12. Run moves to `WAITING_FOR_APPROVAL`.

## Resume Flow

Implemented resume handling:

1. Consumes `workflow-resume` jobs.
2. Reloads run and approval.
3. Confirms approval is approved.
4. Confirms agent is still active.
5. Logs in to sandbox.
6. Returns to billing.
7. Submits approved downgrade.
8. Records final `CHANGE_PLAN` attempt with `ALLOW`.
9. Captures and uploads final screenshot.
10. Completes the run.
11. Creates receipt with approval and final action details.

Terminal runs are ignored on duplicate resume, preventing duplicate downgrade submissions.

## Failure And Safety Paths

Implemented/tested:

- Rejected approval marks run `DENIED`.
- Expired approval cannot be approved or resumed.
- Duplicate resume job does not submit downgrade twice.
- Paused agent before resume stops the run with `FAILED`.

## Tests

Added:

```text
tests/phase26-plan-downgrade-approval-workflow.spec.ts
```

Coverage:

- Policy requires approval.
- Pending approval appears in API.
- Approver approves.
- Worker resumes from resume queue.
- Downgrade action is submitted.
- Receipt records approval and final action.
- Rejection marks run denied.
- Expired approval cannot resume.
- Duplicate resume job does not duplicate submission.
- Paused agent before resume stops the run.

Also hardened Phase 24 receipt/audit assertions to wait for asynchronous receipt and audit writes after terminal run status.

## Validation

Passed:

```bash
pnpm typecheck
pnpm test -- tests/phase26-plan-downgrade-approval-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase18-queue.spec.ts tests/phase19-worker-foundation.spec.ts tests/phase22-connector.spec.ts tests/phase24-invoice-download-workflow.spec.ts tests/phase25-renewal-check-workflow.spec.ts tests/phase26-plan-downgrade-approval-workflow.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
```

Full deterministic suite:

```text
27 test files passed
182 tests passed
```
