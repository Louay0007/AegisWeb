# Phase 23 Completion Notes: InternalWorkerModule

Implemented: 2026-06-06

## Summary

Phase 23 adds a small internal API surface for worker-to-API communication.

The API now exposes dedicated worker endpoints for run events, screenshots, files, completion, and failure. Existing internal action-attempt, approval-request, and credential decrypt endpoints remain protected by the same worker-token guard.

## Added Files

```text
apps/api/src/internal-worker/index.ts
apps/api/src/internal-worker/internal-worker.controller.ts
apps/api/src/internal-worker/internal-worker.module.ts
apps/api/src/internal-worker/internal-worker.service.ts
tests/phase23-internal-worker.spec.ts
```

## Updated Files

```text
apps/api/src/app.module.ts
apps/worker/src/internal-api/internal-api-client.service.ts
```

## Internal Worker Endpoints

Implemented:

```http
POST /internal/workers/runs/:runId/events
POST /internal/workers/runs/:runId/screenshots
POST /internal/workers/runs/:runId/files
POST /internal/workers/runs/:runId/complete
POST /internal/workers/runs/:runId/fail
```

Already available and validated with Phase 23-adjacent coverage:

```http
POST /internal/workers/runs/:runId/action-attempts
POST /internal/workers/runs/:runId/approval-requests
POST /internal/vault/credentials/:id/decrypt-for-run
```

## Security Rules

Implemented:

- Internal worker routes require `WORKER_INTERNAL_TOKEN`.
- Token can be supplied through `x-worker-token` or bearer authorization.
- Worker run writes require an explicit `organizationId`.
- Run writes validate that the run belongs to that organization.
- Worker file uploads are stored against the scoped workflow run.
- Credential decrypt still validates credential organization, vendor match, and active agent grant.
- Completing a run is allowed only from `RUNNING`.
- Failing a run is blocked for terminal statuses.

## Worker Client

Extended `InternalApiClient` with helper methods for:

- Recording run events.
- Uploading screenshots.
- Uploading worker files.
- Completing runs.
- Failing runs.
- Decrypting credentials for a run.

## Tests

Added:

```text
tests/phase23-internal-worker.spec.ts
```

Coverage:

- Missing worker token is rejected.
- Wrong worker token is rejected.
- Correct worker token is accepted.
- Worker event recording stores audit metadata.
- Worker screenshot and file uploads are scoped to the run.
- Worker cannot write files or update runs with another organization scope.
- Worker can complete and fail valid running runs.
- Worker cannot decrypt a credential without an active grant.
- Worker cannot complete an already failed run.

## Validation

Passed:

```bash
pnpm typecheck
pnpm test -- tests/phase13-credentials-vault.spec.ts tests/phase16-action-attempts.spec.ts tests/phase17-approvals.spec.ts tests/phase23-internal-worker.spec.ts --pool=forks --poolOptions.forks.singleFork=true
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
```

Note:

- The default parallel `pnpm test` run reported all visible specs passing, then Vitest emitted a transient `tinypool` worker-exit error.
- The deterministic single-fork full suite passed: 24 files, 172 tests.
