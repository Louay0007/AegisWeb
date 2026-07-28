# Production Launch Checklist

Use this checklist before opening AegisWeb to paying design partners.

## Security Validation

- [ ] All P0/P1/P2 findings fixed.
- [ ] Penetration test passed with no critical or high findings.
- [ ] `pnpm audit --prod --audit-level moderate` passes.
- [ ] Cross-org isolation tests pass.
- [ ] Secret leakage tests pass.
- [ ] SSRF protection validated.
- [ ] Rate limiting configured and tested with Redis counters, `429 RATE_LIMITED`, and `Retry-After` headers.
- [ ] HTTPS enforced everywhere.
- [ ] CSP and security headers present on all responses.
- [ ] Demo mode impossible in production.
- [ ] Fixture fallback impossible in production.

## Infrastructure Validation

- [ ] CI/CD pipeline passing.
- [ ] Docker images built and pushed to registry.
- [ ] Staging environment deployed and tested.
- [ ] Production environment provisioned.
- [ ] Database backups configured and tested.
- [ ] Restore drill completed.
- [ ] Disaster recovery plan documented.
- [ ] Monitoring and alerting configured.
- [ ] Incident response runbook published.

## Product Validation

- [ ] All backend and shared tests passing.
- [ ] Frontend tests passing with `pnpm test:frontend` and component coverage with `pnpm test:component`.
- [ ] E2E happy path passing for all supported workflows with `pnpm e2e:happy` or `pnpm test:e2e`.
- [ ] Sandbox, Stripe Billing, and GitHub connector canaries green against dedicated test accounts.
- [ ] Load test targets met with `pnpm load:api` and `pnpm load:workflow` (see `docs/load-test-targets.md`).
- [ ] Lighthouse scores above 90.
- [ ] Accessibility audit passed with `pnpm qa:a11y` and manual checklist in `docs/accessibility-manual-checklist.md`.
- [ ] Mobile responsive validated with `pnpm qa:responsive`.
- [ ] Dark mode and light mode validated.
- [ ] `pnpm launch:check` passes with digest/rollback deploy gates.

## Operational Readiness

- [ ] Production runbook complete.
- [ ] Secret rotation runbook complete.
- [ ] On-call rotation established.
- [ ] Escalation path documented.
- [ ] Status page live at https://status.aegisweb.com.
- [ ] Support email active at support@aegisweb.com.
- [ ] In-app feedback reviewed daily during pilot.

## Launch Decision

Launch can proceed only when every required item above is checked or has a named owner, accepted risk, and mitigation date.
