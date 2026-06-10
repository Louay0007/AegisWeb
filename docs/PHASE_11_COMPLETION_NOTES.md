# Phase 11 Completion Notes: Policy Engine Library

Date: 2026-06-06

## Scope Implemented

Phase 11 replaced the policy engine placeholder with a deterministic, explainable, pure TypeScript library.

Library:

- `libs/policy-engine`

Public API:

- `evaluatePolicy(input)`
- `scoreRisk(input)`
- `extractRiskSignals(actionContext)`
- `getPolicyEngineStatus()`

## Files Updated

- `libs/policy-engine/src/index.ts`
- `tests/phase11-policy-engine.spec.ts`
- `tests/phase0.spec.ts`

## Design Rules

The policy engine has no dependency on:

- NestJS
- Prisma
- PostgreSQL
- Redis
- MinIO
- Playwright
- Angular

It only imports shared domain types and constants from `@agentpass/domain`.

## Policy Snapshot Fields

Implemented support for:

- `allowedDomains`
- `blockedDomains`
- `allowedActions`
- `deniedActions`
- `approvalRequiredActions`
- `autoApproveBelowCents`
- `approvalRequiredAboveCents`
- `denyAboveCents`
- `dangerKeywords`
- `businessHours`

`businessHours` is carried in the snapshot type for Phase 12+ validation/evaluation expansion, but Phase 11 does not enforce time windows yet.

## Decision Order

Implemented deterministic order:

1. Deny if agent is inactive.
2. Deny if domain is blocked.
3. Deny if domain is not allowed.
4. Deny if action is explicitly denied.
5. Deny if amount is above hard limit.
6. Require approval if action explicitly requires approval.
7. Require approval if amount is above approval threshold.
8. Allow permitted amount below auto-approval threshold.
9. Require approval if risk level is high or critical.
10. Deny if action is not allowed.
11. Allow if action is allowed and remaining risk is low or medium.

Important:

- Hard deny rules are evaluated before approval rules.
- Below-threshold purchases can auto-allow even though purchase has high default action risk.

## Risk Scoring

Implemented:

- Base risk from `ACTION_RISK_DEFAULTS`.
- Risk escalation from extracted or supplied risk signals.
- Highest risk wins.

Signals that can elevate risk include:

- `unknown_domain`
- `destructive_keyword`
- `financial_amount_present`
- `credential_used`
- `new_vendor`
- `first_run_for_agent`
- `submit_button`
- `download_sensitive_file`
- `plan_change_detected`
- `cancel_detected`
- `payment_detected`

## Risk Signal Extraction

`extractRiskSignals(...)` detects:

- Unknown domains.
- Amount presence.
- Credential use.
- Credential use on unknown vendor.
- First agent run.
- Submit actions.
- Sensitive downloads.
- Plan changes.
- Cancellation actions.
- Purchases.
- Dangerous text keywords.

## Explainability

Every evaluation result includes:

- `decision`
- `riskLevel`
- `reason`
- `matchedRules`

Example matched rules:

```text
domain.blocked
amount.hard_limit
action.requires_approval.change_plan
risk.requires_approval.high
action.allowed.read_page
```

## Tests Added

File:

- `tests/phase11-policy-engine.spec.ts`

Coverage:

- Policy engine status.
- Allowed domain and read page allows.
- Allowed domain and invoice download allows.
- Unknown domain denies.
- Blocked domain denies.
- Change plan requires approval.
- Cancel subscription requires approval.
- Invite admin denies.
- Change bank details denies.
- Purchase below threshold allows.
- Purchase between thresholds requires approval.
- Purchase above hard limit denies.
- Danger keyword produces high risk.
- Credential use on known vendor produces medium risk.
- Credential use on unknown vendor denies.
- Paused agent denies.
- Revoked agent denies.
- Matched rule snapshot remains deterministic.
- Hard deny wins over approval rules.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 12 test files passed.
- 96 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
