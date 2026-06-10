# Phase 18 Completion Notes: QueueModule

Implemented: 2026-06-06

## Summary

Phase 18 centralizes BullMQ usage for workflow execution, resume, and maintenance signals.

The backend now has one QueueModule that owns Redis connection parsing, queue names, job ID conventions, retry options, idempotent enqueue behavior, queue diagnostics, and worker safety helpers.

## Queues

Implemented queue names:

```text
workflow-runs
workflow-resume
workflow-maintenance
```

Implemented job names:

```text
workflow.run.start
workflow.run.resume
workflow.run.cancel
```

Job IDs include the workflow run ID for idempotency:

```text
start-{workflowRunId}
resume-{workflowRunId}-{approvalRequestId}
cancel-{workflowRunId}
```

## Added Files

```text
apps/api/src/queue/queue.module.ts
apps/api/src/queue/queue-redis.ts
apps/api/src/queue/workflow-queue.service.ts
apps/api/src/queue/workflow-queue.types.ts
apps/api/src/queue/index.ts
tests/phase18-queue.spec.ts
```

## Removed Legacy Queue Adapters

The older split queue adapters were removed:

```text
apps/api/src/workflows/workflow-queue.service.ts
apps/api/src/workflow-runs/workflow-run-queue.service.ts
apps/api/src/workflow-runs/workflow-run-redis.ts
```

Workflows, workflow runs, and approvals now all use `WorkflowQueueService` from `QueueModule`.

## API Additions

Added diagnostics endpoint:

```http
GET /workflow-runs/:id/queue
```

Requires:

```text
workflow:read
```

Returns start, resume, and cancel job diagnostics for the workflow run.

## Worker Safety Helpers

`WorkflowQueueService` now provides:

```text
shouldProcessRun(workflowRunId)
markPermanentFailure(workflowRunId, errorMessage)
```

These support Phase 19 worker implementation by making workers check terminal/canceled states before execution and record permanent failures consistently.

## Retry Behavior

Start and resume jobs use bounded retries:

```json
{
  "attempts": 3,
  "backoff": {
    "type": "exponential",
    "delay": 1000
  }
}
```

Cancellation signals use one attempt because they are control signals and should not create duplicate intent.

## Tests

Added `tests/phase18-queue.spec.ts` covering:

- Start enqueue creates a BullMQ job.
- Duplicate start enqueue is idempotent.
- Worker processing ignores canceled runs.
- Permanent worker failures mark runs failed.
- Retry options are configured for retryable jobs.
- Queue diagnostics report start, resume, and cancellation jobs.

Updated existing queue assertions in:

```text
tests/phase14-workflows.spec.ts
tests/phase15-workflow-runs.spec.ts
tests/phase17-approvals.spec.ts
```

## Validation

Targeted validation passed:

```bash
pnpm typecheck
pnpm test -- tests/phase18-queue.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase14-workflows.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase15-workflow-runs.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm test -- tests/phase17-approvals.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Full validation should also pass before starting Phase 19:

```bash
pnpm lint
pnpm test
pnpm smoke
```
