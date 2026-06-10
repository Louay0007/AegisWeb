# Phase 3 Completion Notes: API Cross-Cutting Infrastructure

Date: 2026-06-06

## Scope Implemented

Phase 3 added the NestJS infrastructure that later API modules will depend on:

- `ConfigModule`
- `DatabaseModule`
- `HealthModule` upgrades
- `LoggingModule`
- `ErrorsModule`
- `RequestContextModule`
- `SecurityModule`

The implementation keeps infrastructure local-first and free to run, using the existing PostgreSQL, Redis, MinIO, and Mailpit development stack.

## ConfigModule

Files:

- `apps/api/src/config/config.module.ts`
- `apps/api/src/config/config.service.ts`

Implemented:

- Loads `.env` through `dotenv`.
- Validates runtime config with `zod`.
- Exposes typed `AppConfig`.
- Provides local defaults for development and test mode.
- Fails fast when production mode is missing required values.
- Validates dependency URL formats for PostgreSQL, Redis, S3 endpoint, and vendor sandbox URL.

Important required values now covered:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `VAULT_MASTER_KEY`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `MAIL_HOST`
- `MAIL_PORT`
- `WORKER_INTERNAL_TOKEN`

## DatabaseModule

Files:

- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/database.service.ts`

Implemented:

- Creates Prisma through `@agentpass/database`.
- Connects on module init.
- Disconnects on module destroy and application shutdown.
- Exposes `client` for later application services.
- Exposes `ping()` for health checks.
- Exposes `transaction()` helper for rollback-safe application flows.

Future extension point:

- Organization-scoped query helpers should be added here after Phase 5 authorization and organization isolation are implemented.

## HealthModule

Files updated:

- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.service.ts`

Implemented:

- `GET /health` still returns API liveness.
- `GET /health/ready` now checks:
  - PostgreSQL through `DatabaseService`
  - Redis through `@agentpass/database`
  - MinIO through `@agentpass/database`
- Readiness state becomes `degraded` if any dependency is down.

## RequestContextModule

Files:

- `apps/api/src/request-context/request-context.module.ts`
- `apps/api/src/request-context/request-context.service.ts`
- `apps/api/src/request-context/request-context.middleware.ts`
- `apps/api/src/request-context/types.ts`
- `apps/api/src/request-context/current-user.decorator.ts`
- `apps/api/src/request-context/current-organization-id.decorator.ts`
- `apps/api/src/request-context/request-id.decorator.ts`

Implemented:

- Generates a request ID when one is not provided.
- Preserves incoming `x-request-id`.
- Writes `x-request-id` to the response.
- Stores request context with `AsyncLocalStorage`.
- Supports temporary development identity headers:
  - `x-user-id`
  - `x-organization-id`
  - `x-user-role`
- Exposes decorators:
  - `@CurrentUser()`
  - `@CurrentOrganizationId()`
  - `@RequestId()`

Future extension point:

- Phase 4/5 auth guards should replace development identity headers with JWT-authenticated user context.

## SecurityModule

Files:

- `apps/api/src/security/security.module.ts`
- `apps/api/src/security/security-headers.middleware.ts`

Implemented response headers:

- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: no-referrer`
- `permissions-policy: camera=(), microphone=(), geolocation=()`
- `x-agentpass-service: api`

## LoggingModule

Files:

- `apps/api/src/logging/logging.module.ts`
- `apps/api/src/logging/request-logging.middleware.ts`

Implemented:

- Logs method, URL, status code, latency, and request ID after response finish.

## ErrorsModule

Files:

- `apps/api/src/errors/errors.module.ts`
- `apps/api/src/errors/domain-exception.filter.ts`

Implemented:

- Global error filter.
- Standard API error envelope:

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Human readable message.",
    "requestId": "req_..."
  }
}
```

- Maps `DomainError` codes to appropriate HTTP statuses.
- Wraps Nest `HttpException` responses.
- Includes request ID from `RequestContextService`.

## Application Wiring

Files updated:

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`

Implemented:

- App imports all Phase 3 infrastructure modules.
- Middleware order:
  1. Request context
  2. Security headers
  3. Request logging
- Bootstrap now reads port from `ConfigService`.
- Shutdown hooks are enabled.

## Tests Added

File:

- `tests/phase3-api-foundation.spec.ts`

Coverage:

- Local typed config defaults load in test mode.
- Missing production config fails fast.
- Invalid dependency URLs fail validation.
- Database module connects and transaction rollback works.
- Real API liveness returns `ok`.
- Real API readiness checks PostgreSQL, Redis, and MinIO.
- Request ID is preserved and returned.
- Security headers are returned.
- Dependency failure produces degraded readiness.
- Request context decorators work for public and authenticated-header requests.
- Domain errors use the standard API error envelope with request ID.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 4 test files passed.
- 30 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
