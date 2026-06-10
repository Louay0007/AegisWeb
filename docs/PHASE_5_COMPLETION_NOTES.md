# Phase 5 Completion Notes: Authorization And Organization Isolation

Date: 2026-06-06

## Scope Implemented

Phase 5 made API authorization protected by default and added reusable route guards for future business modules.

Implemented:

- `JwtAuthGuard`
- `OptionalAuthGuard`
- `RolesGuard`
- `PermissionsGuard`
- `InternalWorkerGuard`
- `PublicRoute` decorator
- `InternalRoute` decorator
- `RequirePermission` decorator
- `RequireRole` decorator
- `OrganizationScopeService`

## Authorization Module

Files:

- `apps/api/src/authorization/authorization.module.ts`
- `apps/api/src/authorization/authorization-metadata.ts`
- `apps/api/src/authorization/authorization-reflector.ts`
- `apps/api/src/authorization/authenticated-request.ts`
- `apps/api/src/authorization/role-normalization.ts`
- `apps/api/src/authorization/index.ts`

Implemented:

- Global JWT authentication guard through `APP_GUARD`.
- Global role guard through `APP_GUARD`.
- Global permission guard through `APP_GUARD`.
- Explicit route metadata for public, internal, role-gated, and permission-gated routes.
- Prisma enum roles are normalized to domain role values before permission checks.

## JwtAuthGuard

File:

- `apps/api/src/authorization/jwt-auth.guard.ts`

Behavior:

- Protects routes by default.
- Allows routes marked with `@PublicRoute()`.
- Skips JWT for routes marked with `@InternalRoute()` so `InternalWorkerGuard` can validate worker tokens.
- Verifies bearer access tokens with `TokenService`.
- Confirms the user still exists and is active.
- Confirms token organization matches the current user organization.
- Writes authenticated user and organization into request context.

## OptionalAuthGuard

File:

- `apps/api/src/authorization/optional-auth.guard.ts`

Behavior:

- Allows requests without a token.
- If a bearer token is present and valid, it hydrates request context.
- This is available for future public endpoints that can personalize responses when authenticated.

## RolesGuard

File:

- `apps/api/src/authorization/roles.guard.ts`

Behavior:

- Enforces `@RequireRole(...)`.
- Uses domain role values:
  - `owner`
  - `admin`
  - `approver`
  - `auditor`
  - `developer`

## PermissionsGuard

File:

- `apps/api/src/authorization/permissions.guard.ts`

Behavior:

- Enforces `@RequirePermission(...)`.
- Uses the existing domain permission map in `libs/domain/src/permissions.ts`.
- Owners can perform every MVP permission.
- Approvers can approve but cannot create credentials.
- Auditors cannot approve.

## InternalWorkerGuard

File:

- `apps/api/src/authorization/internal-worker.guard.ts`

Behavior:

- Validates `x-worker-token` or bearer token against `WORKER_INTERNAL_TOKEN`.
- Uses timing-safe comparison.
- Intended for future worker-only internal endpoints.

Example future usage:

```ts
@InternalRoute()
@UseGuards(InternalWorkerGuard)
@Post('internal/workers/example')
handleWorkerCall() {}
```

## OrganizationScopeService

File:

- `apps/api/src/authorization/organization-scope.service.ts`

Implemented:

- `assertSameOrganization(...)`
- `whereFor(...)`

Purpose:

- Every organization-owned business query should use authenticated organization context.
- Cross-organization access fails with `ORGANIZATION_ISOLATION_VIOLATION`.

## Public Routes Marked

Files updated:

- `apps/api/src/health/health.controller.ts`
- `apps/api/src/auth/auth.controller.ts`

Public routes:

- `GET /health`
- `GET /health/ready`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Protected route:

- `GET /auth/me`

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `AuthorizationModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase5-authorization.spec.ts`

Coverage:

- Routes are protected by default.
- Public routes must be explicit.
- Authenticated routes hydrate current user context.
- Owner can perform MVP protected actions.
- Approver cannot create credentials.
- Approver can approve.
- Auditor cannot approve.
- Auditor role-only route works.
- Owner cannot pass auditor-only role checks.
- User from organization A cannot read organization B resource.
- Internal worker routes reject missing or wrong token.
- Internal worker routes accept configured worker token.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 6 test files passed.
- 45 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
