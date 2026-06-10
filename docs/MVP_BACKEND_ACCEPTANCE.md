# MVP Backend Acceptance

Validated: 2026-06-06

## Purpose

This document records the final local MVP backend acceptance proof.

The acceptance test verifies the full product story from a clean local backend: login, start workflow, worker execution, approval pause, Mailpit notification, human approval, worker resume, final receipt, and secret-safe evidence.

## Test

Added:

```text
tests/mvp-backend-acceptance.spec.ts
```

## Covered Flow

The test runs:

1. Starts local vendor sandbox in-process.
2. Starts local API in-process.
3. Starts the real worker against Redis.
4. Uses PostgreSQL, Redis, MinIO, and Mailpit from Docker.
5. Clears the Mailpit inbox through the local Mailpit API.
6. Creates an MVP organization, owner, approver, agent, vendor, policy, credential, grant, and downgrade workflow.
7. Logs in owner and approver through `/auth/login`.
8. Starts `PLAN_DOWNGRADE_REQUEST` through `POST /workflows/:id/runs`.
9. Waits for the run to reach `WAITING_FOR_APPROVAL`.
10. Confirms the pending approval exists.
11. Confirms a real email was delivered to Mailpit.
12. Approves through `POST /approvals/:id/approve`.
13. Waits for the run to reach `COMPLETED`.
14. Confirms final receipt creation.
15. Reads the receipt through `GET /receipts/:id`.
16. Confirms screenshots/files were recorded.
17. Confirms the final `CHANGE_PLAN` submit action happened exactly once.
18. Confirms receipt and email evidence do not contain the raw vendor password.

## From-Scratch Validation

Ran:

```bash
pnpm infra:up
pnpm db:reset
pnpm test -- tests/mvp-backend-acceptance.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Result:

```text
1 test file passed
1 test passed
```

## Full Backend Validation

Ran:

```bash
pnpm typecheck
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
```

Result:

```text
31 test files passed
195 tests passed
postgres: ok
redis: ok
minio: ok
```

## Mailpit

Real Mailpit delivery was verified through:

```text
http://localhost:8025/api/v1/messages
```

Latest acceptance message:

```text
Subject: Approval required: Downgrade Acme Analytics from Growth to Starter.
```

## Conclusion

The local MVP backend acceptance flow is now automated and passing.
