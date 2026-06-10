# Phase 21 Completion Notes: Vendor Sandbox Backend

Implemented: 2026-06-06

## Summary

Phase 21 expands `apps/vendor-sandbox` into a deterministic local SaaS vendor portal for browser-worker tests and demos.

The sandbox now exposes login, dashboard, billing, invoice download, downgrade, cancellation, admin user listing, and admin invite routes with stable Acme Analytics data.

## Added Files

```text
apps/vendor-sandbox/src/vendor-sandbox.data.ts
apps/vendor-sandbox/src/vendor-sandbox.views.ts
tests/phase21-vendor-sandbox.spec.ts
```

## Routes

Implemented:

```http
GET  /
GET  /health
GET  /login
POST /login
GET  /dashboard
GET  /billing
GET  /billing?format=json
GET  /billing/invoices/latest.pdf
POST /billing/downgrade
POST /billing/cancel
GET  /admin/users
POST /admin/users/invite
```

## Deterministic Data

The sandbox uses stable Acme Analytics data:

```text
Valid username: finance@northstarlabs.dev
Valid password: acme-local-password
Current plan: Growth
Target plan: Starter
Current monthly price: 80000 cents
Renewal monthly price: 110000 cents
Renewal date: 2026-07-15
Seats: 28
Unused seats: 5
Estimated monthly savings: 48000 cents
Invoice: INV-ACME-2026-0007
```

## Browser-Ready HTML

The HTML pages include stable IDs and `data-testid` markers for future connector/runtime tests:

```text
login-form
billing-link
admin-users-link
renewal-data
download-latest-invoice
downgrade-form
cancel-form
admin-users-table
invite-admin-form
```

The billing page also embeds renewal data as `data-*` attributes and as an `application/json` script block.

## Test Coverage

`tests/phase21-vendor-sandbox.spec.ts` covers:

- Sandbox health.
- Login page, dashboard page, billing page rendering.
- Login success.
- Login failure.
- Renewal data extraction through `GET /billing?format=json`.
- Deterministic invoice download.
- Downgrade form submit result.
- Cancel action availability.
- Admin users page.
- Admin invite action availability for later policy denial tests.

## Acceptance

Worker tests no longer need real vendor accounts for:

- Login.
- Invoice download.
- Renewal data extraction.
- Downgrade action.
- Destructive cancellation scenario.
- Denied admin invite scenario.

## Validation

Targeted validation passed:

```bash
pnpm typecheck
pnpm test -- tests/phase21-vendor-sandbox.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Full validation should be run before Phase 22:

```bash
pnpm lint
pnpm test
pnpm smoke
```
