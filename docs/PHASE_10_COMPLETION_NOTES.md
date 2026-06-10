# Phase 10 Completion Notes: VendorsModule

Date: 2026-06-06

## Scope Implemented

Phase 10 added SaaS vendor portal tracking and renewal metadata.

Implemented endpoints:

- `GET /vendors`
- `POST /vendors`
- `GET /vendors/:id`
- `PATCH /vendors/:id`
- `DELETE /vendors/:id`

## VendorsModule

Files:

- `apps/api/src/vendors/vendors.module.ts`
- `apps/api/src/vendors/vendors.controller.ts`
- `apps/api/src/vendors/vendors.service.ts`
- `apps/api/src/vendors/vendor-url.service.ts`
- `apps/api/src/vendors/vendor-risk-profile.service.ts`
- `apps/api/src/vendors/vendor-category-mapping.ts`
- `apps/api/src/vendors/vendors.types.ts`
- `apps/api/src/vendors/index.ts`

Implemented:

- Organization-scoped vendor list.
- Organization-scoped vendor detail.
- Vendor create.
- Vendor update.
- Vendor delete.
- URL normalization.
- Duplicate active website protection.
- Risk profile derivation.
- Owner-user same-organization validation.

## Permissions

Routes require:

- `vendor:read` for list and detail.
- `vendor:create` for create.
- `vendor:update` for update and delete.

Approvers can read vendors but cannot create, update, or delete vendors.

## VendorUrlService

File:

- `apps/api/src/vendors/vendor-url.service.ts`

Implemented normalization:

- Lowercase scheme.
- Lowercase hostname.
- Remove query string.
- Remove hash.
- Trim trailing slash.
- Preserve non-root paths for local sandbox vendors.

Examples:

```text
HTTPS://Example.COM/path/?utm=1#top -> https://example.com/path
http://LOCALHOST:4202/nimbus/?x=1 -> http://localhost:4202/nimbus
http://localhost:4202/ -> http://localhost:4202
```

## VendorRiskProfileService

File:

- `apps/api/src/vendors/vendor-risk-profile.service.ts`

Implemented:

- Uses `metadataJson.risk` when present.
- Marks payroll vendors as `blocked` by default.
- Marks monthly spend at or above $1,000 as `high`.
- Marks monthly spend at or above $500 as `medium`.
- Defaults to `low`.

Risk levels:

- `low`
- `medium`
- `high`
- `blocked`

## Delete Behavior

Implemented:

- Vendors with no workflows are hard deleted.
- Vendors with workflows are soft deleted through `deletedAt`.
- Soft-deleted vendors disappear from list/detail endpoints.

Note:

- The current Prisma schema has a unique `(organization_id, website)` constraint, so a soft-deleted vendor website still cannot be reused without a future migration.

## Audit Events

Implemented:

- `vendor_created`
- `vendor_updated`
- `vendor_deleted`

Audit payloads include useful vendor IDs and deletion mode.

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `VendorsModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase10-vendors.spec.ts`

Coverage:

- URL normalization.
- Local sandbox path preservation.
- Create/list/get/update.
- Risk profile from metadata.
- Risk profile from category and spend.
- Create and update audit events.
- Duplicate active vendor blocked.
- Approver can read vendors.
- Approver cannot create/update/delete vendors.
- Cross-organization vendor reads are rejected.
- Cross-organization owner assignment is rejected.
- Hard delete for vendors without workflows.
- Soft delete for vendors with workflows.
- Soft-deleted vendors disappear from detail reads.
- Delete audit event records soft-delete mode.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 11 test files passed.
- 78 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
