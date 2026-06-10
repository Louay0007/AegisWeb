# Phase 19 Completion Notes: Worker Foundation

Implemented: 2026-06-06

## Summary

Phase 19 builds the local worker foundation before browser automation and real workflow logic.

The worker now has explicit modules for configuration, runtime checks, Redis/BullMQ processing, no-op workflow execution, internal API reachability, audit writing, file/policy/vault placeholders, cancellation checks, and heartbeat events.

## Worker Modules

Implemented modules:

```text
WorkerConfigModule
RuntimeModule
WorkerQueueModule
WorkflowExecutorModule
PolicyClientModule
VaultClientModule
AuditClientModule
FileStorageModule
ConnectorModule
InternalApiModule
WorkerLoggingModule
WorkerDatabaseModule
```

`WorkerModule` now composes these modules and exports `WorkerService`.

## Worker Shared Services

Implemented shared services:

```text
WorkerConfigService
InternalApiClient
WorkerLogger
RunCancellationService
RunHeartbeatService
WorkerRuntimeService
WorkerQueueService
WorkflowExecutorService
WorkerDatabaseService
WorkerAuditService
```

## Queue Processing

The worker can start a BullMQ processor on:

```text
workflow-runs
```

The worker uses the shared domain queue contract:

```text
WORKFLOW_QUEUE_NAMES
WORKFLOW_QUEUE_JOB_NAMES
WorkflowQueueJobData
workflowStartJobId
```

Phase 19 intentionally processes only jobs with:

```json
{
  "mode": "start",
  "template": "noop"
}
```

Other jobs are skipped until the browser workflow phases are implemented.

## No-Op Execution

The no-op executor:

1. Loads the workflow run.
2. Ignores missing or terminal/canceled runs.
3. Marks the run `running`.
4. Records `workflow_run_started`.
5. Sends a heartbeat event.
6. Checks cancellation.
7. Marks the run `completed`.
8. Records `workflow_run_completed`.

This satisfies the Phase 19 acceptance requirement that the worker can pick a no-op workflow job and mark it completed.

## Boot Checks

`WorkerRuntimeService.checkBootDependencies()` checks:

```text
Redis
API /health endpoint
MinIO
Browser runtime placeholder
```

The API check sends the configured worker token in `x-worker-token`, preparing the boundary for Phase 23 internal worker APIs.

## Config

`WorkerConfigService` validates:

```text
API_BASE_URL or API_PORT
DATABASE_URL
REDIS_URL
WORKER_INTERNAL_TOKEN
S3 config
VENDOR_SANDBOX_URL
```

Missing or too-short `WORKER_INTERNAL_TOKEN` fails fast.

## Tests

Added:

```text
tests/phase19-worker-foundation.spec.ts
```

Coverage:

- Worker app boots with Phase 19 modules.
- Worker connects to Redis and checks API, MinIO, and browser runtime.
- Missing worker token is rejected.
- Internal API health check succeeds with the worker token.
- Heartbeat records run state and audit event.
- No-op BullMQ job is picked up and marks the run completed.

## Validation

Targeted validation passed:

```bash
pnpm typecheck
pnpm test -- tests/phase19-worker-foundation.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Full validation should be run before Phase 20:

```bash
pnpm lint
pnpm test
pnpm smoke
```
