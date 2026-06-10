# Phase 14 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 14 adds reusable workflow definitions and run requests.

Implemented endpoints:

- `GET /workflows/templates`
- `GET /workflows`
- `POST /workflows`
- `GET /workflows/:id`
- `POST /workflows/:id/runs`

Implemented services:

- `WorkflowsService`
- `WorkflowTemplateService`
- `WorkflowValidationService`
- `WorkflowQueueService`

## Behavior

- Workflows are organization-scoped.
- Workflows reference one active agent and one non-deleted vendor.
- Template configuration is validated before creation.
- Login templates require `credentialId` in configuration.
- Plan downgrade workflows require `targetPlan`.
- Credential IDs must belong to the selected vendor and must be actively granted to the selected agent.
- Starting a workflow requires an active agent, non-deleted vendor, active agent policy bundle, and active credential grant.
- Starting a workflow creates a `workflow_run` with queued status.
- Starting a workflow enqueues a BullMQ job on `agentpass-workflow-runs`.
- Responses use domain enum values for Angular while Prisma keeps native enum values.

## Audit Events

- `workflow_created`
- `workflow_run_requested`

`workflow_updated` is reserved for a future update endpoint; Phase 14 plan did not define one.

## Tests Added

`tests/phase14-workflows.spec.ts` covers:

- Template list endpoint.
- Create/list/get workflow.
- All three MVP templates.
- Revoked agent rejection.
- Deleted vendor rejection.
- Invalid template config rejection.
- Missing credential grant rejection.
- Queued workflow run creation.
- BullMQ job enqueue.
- Run request audit event.
- No active policy rejection.
- RBAC and cross-organization denial.
