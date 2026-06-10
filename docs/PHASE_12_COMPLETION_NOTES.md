# Phase 12 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 12 adds the API policy management module for AgentPass.

Implemented endpoints:

- `GET /policies`
- `POST /policies`
- `GET /policies/:id`
- `PATCH /policies/:id`
- `POST /policies/evaluate`

Implemented services:

- `PoliciesService`
- `PolicySnapshotService`
- `PolicyValidationService`
- `PolicyEvaluationService`

## Behavior

- Policies are organization-scoped and always queried by the current organization.
- Policy rules are validated before create, update, and direct evaluation.
- Policy create stores version `1`.
- Policy update increments version on every patch.
- The MVP rule of one active `agent_policy_bundle` per agent is enforced in application logic.
- Policy evaluation calls the pure `@agentpass/policy-engine` library.
- Policy evaluation records the policy ID, version, decision, risk level, reason, and matched rules in audit.
- `POST /policies/evaluate` is restricted to owner/admin users with policy update permission.
- Responses use domain enum values for Angular while Prisma stores native enum values.

## Audit Events

- `policy_created`
- `policy_updated`
- `policy_evaluated`

## Tests Added

`tests/phase12-policies.spec.ts` covers:

- Creating a valid policy bundle.
- Listing and reading policies.
- Rejecting invalid domains.
- Rejecting invalid thresholds.
- Preventing a second active policy bundle for the same agent.
- Incrementing version on update.
- Recording create, update, and evaluation audit events.
- Returning policy evaluation decision reasons.
- Restricting evaluation to owner/admin access.
- Denying cross-organization policy and agent access.
- Verifying Prisma enum storage with domain enum API output.
