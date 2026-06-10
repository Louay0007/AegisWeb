# Phase 4 Completion Notes: AuthModule

Date: 2026-06-06

## Scope Implemented

Phase 4 added local authentication for AgentPass with safe password handling, access tokens, refresh-token rotation, and session audit events.

Implemented endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`

## Auth Module

Files:

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/dto.ts`
- `apps/api/src/auth/http-types.ts`

Implemented:

- Local organization owner registration.
- Login with generic failure response.
- Refresh-token rotation.
- Logout refresh-token revocation.
- Current-user lookup through bearer access token.
- Zod DTO validation at the controller boundary.
- Secret-safe response bodies for Angular consumption.

## PasswordService

File:

- `apps/api/src/auth/password.service.ts`

Implemented:

- Argon2id password hashing.
- Safe password verification.
- Invalid or malformed hashes return `false` instead of leaking implementation errors.

Dependency added:

- `argon2`

## TokenService

File:

- `apps/api/src/auth/token.service.ts`

Implemented:

- Local signed JWT-compatible access tokens using HS256.
- Access-token payload includes:
  - user ID
  - organization ID
  - role
  - email
  - expiry
  - unique `jti`
- Access-token verification rejects malformed, expired, or tampered tokens.

Note:

- This is intentionally local and dependency-light. Phase 5 guards can use this service directly.

## RefreshTokenService

File:

- `apps/api/src/auth/refresh-token.service.ts`

Implemented:

- Cryptographically random refresh tokens.
- SHA-256 token hashes stored in `refresh_tokens`.
- Raw refresh tokens are never stored.
- Token consumption revokes the old token before issuing a replacement.
- Revoked or expired refresh tokens are rejected.

## SessionAuditService

File:

- `apps/api/src/auth/session-audit.service.ts`

Implemented audit events:

- `user_registered`
- `user_login_succeeded`
- `user_login_failed`
- `user_logout`
- `token_refreshed`

Audit events are appended with a per-organization previous hash reference.

## Demo Seed Update

File updated:

- `libs/database/src/seed.ts`

Changed:

- Demo users now receive a real Argon2id hash for `Password123!`.
- This makes the seeded users usable for local login once the auth UI or API client is added.

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `AuthModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase4-auth.spec.ts`

Coverage:

- Password hashing and verification.
- Invalid password rejection.
- Access-token payload includes user, organization, and role.
- Register creates organization and owner user.
- Password hash never appears in API response.
- Refresh-token hash is stored instead of raw token.
- `GET /auth/me` returns user and organization safely.
- Unauthenticated `GET /auth/me` is rejected.
- Login succeeds with correct credentials.
- Login fails generically with wrong credentials.
- Failed login emits audit event.
- Refresh returns a new access token and rotated refresh cookie.
- Consumed refresh token is rejected.
- Logout revokes refresh token and clears cookie.
- Disabled users cannot log in.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 5 test files passed.
- 39 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
