# Phase 17 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 17 adds the human approval lifecycle.

Implemented endpoints:

- `GET /approvals`
- `GET /approvals/:id`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`
- `POST /internal/workers/runs/:runId/approval-requests`

Implemented services:

- `ApprovalsService`
- `ApprovalExpirationService`
- `ApprovalResumeService`
- `ApprovalNotificationService`

## Behavior

- Internal worker creates pending approval requests.
- Approval requests must reference an action attempt whose policy decision is `require_approval`.
- Creating an approval moves the workflow run to `waiting_for_approval`.
- Approvals can be approved or rejected exactly once.
- Approved/rejected/expired approvals cannot be decided again.
- Expired approvals are marked `expired` and emit `approval_expired`.
- Owner/admin/approver can approve or reject through `approval:approve`.
- Auditor can read but cannot approve/reject.
- Approval stores approver, timestamps, and comment.
- Approving moves the run back to `running` and enqueues a resume job.
- Rejecting marks the run `denied`.
- Approval decisions emit audit events.
- A placeholder notification service records local delivery metadata during request audit.

## Tests Added

`tests/phase17-approvals.spec.ts` covers:

- Internal pending approval creation.
- List/get pending approvals.
- Approver approval.
- Duplicate approval rejection.
- Rejection and run denial.
- Duplicate rejection rejection.
- Auditor approval denial.
- Expired approval rejection.
- Reject then approve rejection.
- Resume queue job creation.
- Cross-organization access denial.
