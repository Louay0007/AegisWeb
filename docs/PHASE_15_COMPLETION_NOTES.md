# Phase 15 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 15 adds the workflow run lifecycle read/control module.

Implemented endpoints:

- `GET /workflow-runs`
- `GET /workflow-runs/:id`
- `POST /workflow-runs/:id/cancel`
- `GET /workflow-runs/:id/events`

Implemented services:

- `WorkflowRunsService`
- `WorkflowRunStateMachine`
- `WorkflowRunQueryService`
- `WorkflowRunQueueService`

## Behavior

- Run listing supports filters by `workflowId`, `agentId`, `vendorId`, `status`, `limit`, and `offset`.
- Run detail includes workflow, agent, vendor, recent action attempts, files, approval requests, and receipt summary.
- Run events return the audit timeline for the run.
- State transitions are centralized in `WorkflowRunStateMachine`.
- Cancel transitions are allowed from queued, running, and waiting-for-approval.
- Terminal runs cannot be canceled.
- Cancel reason is stored in `stateJson.transitionReason`, `stateJson.transitions`, and `errorMessage`.
- Canceling queued runs removes the queued BullMQ job when possible.
- Canceling running/waiting runs creates a worker cancellation signal job.
- Canceled runs emit `workflow_run_canceled` audit.
- Starting a run now also emits `workflow_run_created` audit before the queue request audit.

## Tests Added

`tests/phase15-workflow-runs.spec.ts` covers:

- State machine allowed transitions.
- State machine forbidden transitions.
- Listing runs with filters.
- Getting run detail with attempts, files, approvals, and receipt.
- Canceling queued runs.
- Canceling running runs.
- Worker cancellation queue signal.
- Terminal cancellation rejection.
- Events endpoint audit timeline.
- RBAC and cross-organization denial.
