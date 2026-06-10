# Phase 8 Completion Notes: OrganizationsModule And UsersModule

Date: 2026-06-06

## Scope Implemented

Phase 8 added workspace identity and team management endpoints.

Organization endpoints:

- `GET /organization`
- `PATCH /organization`

User endpoints:

- `GET /users`
- `GET /users/:id`
- `POST /users/invite`
- `PATCH /users/:id/role`
- `POST /users/:id/disable`

## OrganizationModule

Files:

- `apps/api/src/organization/organization.module.ts`
- `apps/api/src/organization/organization.controller.ts`
- `apps/api/src/organization/organization.service.ts`
- `apps/api/src/organization/organization.types.ts`
- `apps/api/src/organization/index.ts`

Implemented:

- Current organization read from authenticated organization context.
- Owner-only organization updates.
- DTO responses without internal fields.
- `organization:read` protection on reads.
- `organization:update` plus owner role protection on updates.

Update fields:

- `name`
- `domain`

Audit event:

- `organization_updated`

## UsersModule

Files:

- `apps/api/src/users/users.module.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/users/users.types.ts`
- `apps/api/src/users/user-role-mapping.ts`
- `apps/api/src/users/index.ts`

Implemented:

- Organization-scoped user list.
- Organization-scoped user detail.
- Local invite as `INVITED` user.
- Role change.
- User disable.
- DTO responses that never expose `passwordHash`.

Invite fields:

- `email`
- `name`
- `role`

Role values accepted from API:

- `owner`
- `admin`
- `approver`
- `auditor`
- `developer`

## Business Rules

Implemented:

- Organization read returns only the current authenticated organization.
- Only owners can update organization profile.
- Only owners and admins can invite users.
- Only owners and admins can change user roles.
- Only owners and admins can disable users.
- Users cannot change their own role to owner.
- Last active owner cannot be demoted.
- Last active owner cannot be disabled.
- Cross-organization user reads return not found.

## Audit Events

Implemented:

- `organization_updated`
- `user_invited`
- `user_role_changed`
- `user_disabled`

Audit payloads include useful IDs and role transitions, without secrets.

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `OrganizationModule` imported.
- `UsersModule` imported.

## Tests Added

File:

- `tests/phase8-organization-users.spec.ts`

Coverage:

- Organization read returns the current org only.
- Organization update is owner-only.
- Organization update emits audit.
- Admin can invite users.
- Owner can invite users.
- Approver cannot invite users.
- Invited users are created in the same organization.
- User list is organization-scoped.
- User detail is organization-scoped.
- Password hashes never appear in user API responses.
- Invalid role changes fail.
- Self-change to owner fails.
- Role change emits audit.
- Disabling a user emits audit.
- Last owner cannot be disabled.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 9 test files passed.
- 64 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
