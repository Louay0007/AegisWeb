# Phase 16 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 16 adds action attempt recording for worker-executed browser and business actions.

Implemented internal endpoints:

- `POST /internal/workers/runs/:runId/action-attempts`
- `PATCH /internal/workers/action-attempts/:id/complete`
- `PATCH /internal/workers/action-attempts/:id/fail`

Implemented read endpoint:

- `GET /workflow-runs/:runId/action-attempts`

Implemented services:

- `ActionAttemptsService`
- `ActionClassificationService`
- `RiskSignalService`

## Behavior

- Internal create/complete/fail endpoints require the worker token.
- Action attempts inherit organization, agent, and vendor from the workflow run.
- Low-risk actions can default to `allow`.
- Submit/change/purchase/destructive actions require a policy decision before storage.
- Risk can be supplied by the worker or classified from action type and risk signals.
- Complete updates `completedAt`, output summary, and metadata outcome.
- Fail updates `completedAt`, stores an error summary in `outputSummary`, and records metadata outcome/error.
- Completed attempts cannot be completed or failed again.
- User read endpoint is organization-scoped through the parent workflow run.

## Tests Added

`tests/phase16-action-attempts.spec.ts` covers:

- Worker-token action attempt creation.
- Non-worker internal request rejection.
- Policy decision requirement for risky actions.
- Successful risky action creation with recorded decision.
- Complete timestamp and metadata update.
- Fail timestamp and error summary update.
- Duplicate completion rejection.
- Run-scoped list endpoint.
- Cross-organization read denial.
