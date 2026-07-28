# AegisWeb MVP Phases

Release target: production launch with Stripe Billing + GitHub connectors.
Slack approvals are out of MVP scope (dashboard + email only).

## Phase 1 — Stabilize sandbox MVP (complete)

- [x] Remove Slack from product claims and settings
- [x] Wire step-up auth for sensitive dashboard mutations
- [x] Add MFA disable UI
- [x] Surface invite email delivery failures
- [x] Add audit export + hash-chain verify UI
- [x] Add approval expiry sweeper (plus lazy safety net)

## Phase 2 — Real connectors (complete)

- [x] Connector registry + capability matrix
- [x] Stripe Billing connector
- [x] GitHub connector
- [x] TOTP / manual MFA handoff support
- [x] Fail-closed page-structure detection
- [x] Vendor `connectorType` schema + dashboard selection
- [x] Registry/capability tests

## Phase 3 — Production launch hardening (complete)

- [x] Stripe billing config enforced in production startup
- [x] Observability alert thresholds documented
- [x] Launch-readiness checks expanded beyond file existence
- [x] Deploy digests captured and rollback workflow added
- [x] Production smoke after promote
- [x] Backup/restore scripts remain launch-gated

## Remaining operational work (outside code)

- Configure live Stripe keys and Render image digest pinning in the host platform
- Run staging canaries against dedicated Stripe/GitHub test accounts
- Complete pen-test residual closure and restore drill sign-off on the launch checklist
