# AegisWeb Production Implementation Plan

Generated: 2026-06-09

## Purpose

This document turns the backend/frontend audit into an implementation plan for moving AegisWeb from a polished local demo/MVP into a real production product.

Current status:

- Demo/local walkthrough readiness: high
- Frontend build/type/lint readiness: passing
- Backend architecture foundation: strong
- Production readiness: not yet ready

Primary goal:

> Make AegisWeb safe to expose to real organizations, real users, real credentials, real workflow evidence, and real approval decisions.

---

## Validation baseline

The following commands were run successfully:

```bash
pnpm db:generate
pnpm --filter my-v0-project build
pnpm typecheck
pnpm lint
```

The following commands are blocked until Docker Desktop / Docker daemon is running:

```bash
pnpm infra:up
pnpm smoke
pnpm test
pnpm e2e:happy
pnpm qa:click-path
pnpm qa:responsive
```

Current environment blocker:

```txt
Docker daemon unavailable.
Redis unavailable at localhost:6379.
```

---

## Implementation phases

| Phase | Goal | Priority |
| --- | --- | --- |
| Phase 0 | Freeze demo behavior behind env flags | P0 |
| Phase 1 | Harden auth/session/routing | P0 |
| Phase 2 | Harden API exposure and backend config | P0 |
| Phase 3 | Make data layer production-safe | P0 |
| Phase 4 | Secure worker, vault, files, audit | P1 |
| Phase 5 | Add production deployment path | P1 |
| Phase 6 | Complete product functionality tests | P1 |
| Phase 7 | Compliance, retention, enterprise hardening | P2 |

---

# Phase 0 — Gate demo mode and fixtures

## Objective

Ensure demo behavior cannot accidentally appear in production.

## Problem

The current product uses demo/fixture paths heavily:

- Demo login fallback
- Demo register fallback
- Prefilled demo credentials
- `?demo=1`
- `localStorage["aegisweb.fixture"]`
- Fixture data for unauthenticated/API-error states
- Hardcoded dashboard timelines/active runs in places

This is useful for demos but dangerous in production because it can show fake operational data.

## Required changes

### 0.1 Add frontend env flags

Add production-safe feature flags:

```txt
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
```

Create a central config helper, for example:

```txt
apps/web/lib/runtime-config.ts
```

Responsibilities:

- Read `NEXT_PUBLIC_ENABLE_DEMO_MODE`
- Read `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK`
- Read `NEXT_PUBLIC_API_URL`
- In production, fail or warn if API URL is missing or localhost

Acceptance criteria:

- Demo mode is disabled unless explicitly enabled.
- Fixture fallback is disabled unless explicitly enabled.
- Production build does not silently default to localhost API.

---

### 0.2 Disable demo login fallback in production

Files:

```txt
apps/web/components/auth/login-form.tsx
apps/web/components/auth/auth-client.ts
```

Required behavior:

- If demo mode is disabled, failed API login must show an error.
- It must not create a demo session.
- Demo users/passwords must not be prefilled.

Acceptance criteria:

- With `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`, `Password123!` does not create a local demo session.
- Login form does not prefill demo email/password.

---

### 0.3 Disable register fallback to demo mode

File:

```txt
apps/web/components/auth/register-form.tsx
```

Required behavior:

- Register should never fall back to demo session unless demo mode is enabled.
- On API failure, show the API error.
- On API success, update `AuthSessionProvider` state.

Acceptance criteria:

- API registration failure does not route to `/app/home?demo=1` in production.
- Successful registration lands in authenticated dashboard state.

---

### 0.4 Disable fixture fallback on production API errors

Files:

```txt
apps/web/lib/data-layer/feature-flags.ts
apps/web/lib/data-layer/resource-hooks.ts
apps/web/lib/api/resource-state.ts
apps/web/components/product/start-workflow-flow.tsx
```

Required behavior:

- Production API errors should show real error states.
- Production unauthenticated state should not show fixture records.
- Local/demo mode may still use fixture data when explicitly enabled.

Acceptance criteria:

- API down in production mode shows “API unavailable” or retry UI.
- No fake agents/vendors/approvals/runs/receipts appear in production mode.

---

# Phase 1 — Harden auth/session/routing

## Objective

Make frontend and backend authentication production-grade.

---

## 1.1 Add Next.js middleware route protection

Create:

```txt
apps/web/middleware.ts
```

Protect:

```txt
/app/:path*
```

Initial behavior:

- If no valid session marker exists, redirect to `/login`.
- Middleware should avoid relying on localStorage because middleware runs server-side.

Preferred long-term behavior:

- Use HttpOnly auth cookies.
- Middleware checks cookie/session presence.

Acceptance criteria:

- Directly visiting `/app/home` unauthenticated redirects before rendering dashboard shell.
- Authenticated users can access `/app/*`.

---

## 1.2 Move access tokens out of localStorage

Current files:

```txt
apps/web/lib/auth/token-storage.ts
apps/web/lib/api/api-client.ts
apps/web/lib/auth/auth-session.tsx
```

Current issue:

- Access token is stored in localStorage.
- XSS can steal it.

Preferred solution:

- Backend sets secure HttpOnly cookies.
- Frontend API client sends credentials via cookies.
- Access token is not readable by JavaScript.

Intermediate solution:

- Keep access token in memory only.
- Use refresh endpoint to rehydrate.
- Harden CSP.

Acceptance criteria:

- No bearer token is persisted in localStorage in production.
- Refresh/logout flow still works.
- App survives page reload with secure session strategy.

---

## 1.3 Secure refresh cookie

Backend files:

```txt
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/http-types.ts
```

Required cookie flags in production:

```txt
HttpOnly
Secure
SameSite=Lax or Strict
Path=/auth
```

Acceptance criteria:

- Refresh cookie has `Secure` when `NODE_ENV=production`.
- Refresh/logout are protected against CSRF/origin abuse.

---

## 1.4 Add CSRF/origin protection for cookie routes

Routes:

```txt
POST /auth/refresh
POST /auth/logout
```

Required checks:

- Validate `Origin` / `Referer` for browser requests.
- Consider CSRF token if using cookie-authenticated state-changing routes.

Acceptance criteria:

- Cross-site refresh/logout attempts are rejected.
- Same-site app requests succeed.

---

## 1.5 Fix register success auth provider state

File:

```txt
apps/web/lib/auth/auth-session.tsx
```

Add method:

```ts
saveApiSession(session: AuthSession): void
```

Use it in:

```txt
apps/web/components/auth/register-form.tsx
```

Acceptance criteria:

- After successful register, dashboard shell sees authenticated state immediately.
- No intermediate “session not active” screen.

---

# Phase 2 — Harden API exposure and backend config

## Objective

Prevent unsafe API exposure and local/demo defaults in production.

---

## 2.1 Replace permissive CORS

File:

```txt
apps/api/src/main.ts
```

Current issue:

```ts
app.enableCors({ origin: true, credentials: true });
```

Required config:

```txt
API_ALLOWED_ORIGINS=https://app.aegisweb.com,https://www.aegisweb.com
```

Acceptance criteria:

- Requests from allowed frontend origins succeed.
- Unknown origins are rejected.
- Credentialed CORS is not reflected for arbitrary origins.

---

## 2.2 Disable/protect Swagger in production

Files:

```txt
apps/api/src/main.ts
apps/api/src/docs/openapi.ts
apps/api/src/authorization/jwt-auth.guard.ts
```

Required behavior:

- Swagger disabled unless explicitly enabled.
- If enabled in production, protect behind admin/VPN/internal auth.
- Disable `persistAuthorization` in production.

Acceptance criteria:

- `/docs` and `/docs-json` are not publicly available in production.

---

## 2.3 Strengthen config validation

File:

```txt
apps/api/src/config/config.service.ts
```

Required changes:

- Reject local sentinel secrets in production.
- Require 32+ byte secrets for JWT/vault/worker.
- Require HTTPS dashboard URL in production.
- Require explicit CORS origins.
- Reject localhost DB/Redis/S3 in production unless explicitly allowed.

Acceptance criteria:

- Production API refuses to start with demo/local secrets.
- Production API refuses to start with missing required env.

---

## 2.4 Add production scripts

Root `package.json` should include production commands:

```json
{
  "build": "tsc -p tsconfig.json --noEmit && pnpm --filter my-v0-project build",
  "start:api": "node dist/apps/api/main.js",
  "db:deploy": "prisma migrate deploy",
  "prod:check": "pnpm db:generate && pnpm typecheck && pnpm lint && pnpm --filter my-v0-project build"
}
```

Actual build strategy may require a bundler or TypeScript emit setup for API.

Acceptance criteria:

- There is a documented production deployment path.
- Migrations use `prisma migrate deploy`, not `prisma migrate dev`.

---

## 2.5 Add rate limiting

Backend targets:

```txt
POST /auth/login
POST /auth/register
POST /auth/refresh
POST /auth/logout
/internal/*
/files/*
/receipts/*/export
```

Suggested implementation:

- Redis-backed rate limiter.
- Per-IP limits.
- Per-user/per-email login limits.
- Per-worker-token internal limits.
- Per-org file/artifact limits.

Acceptance criteria:

- Repeated login attempts are throttled.
- File/internal endpoints cannot be spammed freely.

---

## 2.6 Return generic production 500 errors

File:

```txt
apps/api/src/errors/domain-exception.filter.ts
```

Required behavior:

- In production, unknown exceptions return generic message.
- Logs retain detailed error with request ID.

Acceptance criteria:

- Internal DB/crypto/parser error messages do not leak to clients.

---

# Phase 3 — Make data layer production-safe

## Objective

Ensure the UI truthfully represents backend state.

---

## 3.1 Split demo data from production data flow

Files:

```txt
apps/web/lib/data-layer/resource-hooks.ts
apps/web/lib/data-layer/resource-queries.ts
apps/web/lib/fixtures/dashboard.ts
```

Required behavior:

- Production uses API data only.
- Demo mode uses fixtures only when enabled.
- Error state does not silently fall back to fixture data.

Acceptance criteria:

- Production dashboard shows explicit empty/error states.
- Demo dashboard still works when demo mode is enabled.

---

## 3.2 Replace hardcoded dashboard timeline/active run

File:

```txt
apps/web/components/dashboard/home-dashboard.tsx
```

Current issue:

- Uses fixture `timeline` and fallback `workflowRuns[0]` in home dashboard.

Required behavior:

- Use live run data from API where available.
- If no live run exists, show empty state.
- Demo-only fixture timeline behind demo flag.

Acceptance criteria:

- Production `/app/home` does not show Acme fixture evidence unless data exists in backend.

---

## 3.3 Remove demo fallback from start workflow flow

File:

```txt
apps/web/components/product/start-workflow-flow.tsx
```

Current issue:

- Uses legacy `useApiResource` and routes to demo run when API unavailable.

Required behavior:

- Production start workflow requires API.
- Demo fallback only when demo mode enabled.

Acceptance criteria:

- API failure blocks run start with a clear error.
- Demo start still works when explicitly enabled.

---

# Phase 4 — Secure worker, vault, files, audit

## Objective

Make real credentialed browser work safe enough for production.

---

## 4.1 Replace static worker token

Current issue:

- `WORKER_INTERNAL_TOKEN` is a static shared secret.

Required design:

- Short-lived run-scoped worker token.
- Bound to `organizationId`, `workflowRunId`, allowed internal operations, and expiry.
- Optional mTLS/service identity for worker.

Acceptance criteria:

- Worker token for one run cannot mutate another run.
- Expired worker token is rejected.
- Worker identity is logged in audit events.

---

## 4.2 Add file upload limits

Files:

```txt
apps/api/src/internal-worker
apps/api/src/files
```

Required controls:

- Max base64 payload size.
- Max decoded bytes.
- MIME allowlist per `FileKind`.
- Per-org and per-run storage quotas.
- Streaming upload instead of full memory buffering.

Acceptance criteria:

- Oversized upload is rejected before memory pressure.
- Unsupported MIME/file kind is rejected.

---

## 4.3 Upgrade vault encryption model

Current file:

```txt
libs/vault/src/index.ts
```

Required production model:

- KMS/envelope encryption.
- Per-tenant or per-credential data keys.
- Key versioning.
- Rotation process.
- AES-GCM AAD binding to org/credential/version metadata.

Acceptance criteria:

- Credentials can be rotated to a new key version.
- Ciphertext cannot be moved between orgs/credentials without detection.

---

## 4.4 Make audit chain concurrency-safe

Files:

```txt
apps/api/src/audit
prisma/schema.prisma
```

Required behavior:

- Serialize hash-chain writes per organization or stream.
- Prevent chain forks on concurrent writes.
- Consider external anchoring/WORM storage.

Acceptance criteria:

- Concurrent audit writes produce a single valid chain.
- Audit chain verification passes after high concurrency tests.

---

## 4.5 Protect audit retention

Required behavior:

- Avoid cascade deletion of audit/receipt records in production.
- Add retention/archive policy.
- Add immutable export option.

Acceptance criteria:

- Org deletion does not silently destroy compliance evidence without archive/retention process.

---

# Phase 5 — Production deployment path

## Objective

Make production deploy repeatable.

---

## 5.1 Containerize services

Required artifacts:

```txt
apps/api/Dockerfile
apps/worker/Dockerfile
apps/web/Dockerfile
```

Acceptance criteria:

- API, worker, and web can be built as immutable artifacts.
- Images do not include local secrets.

---

## 5.2 Add deployment runbook

Create:

```txt
docs/production-runbook.md
```

Include:

- Required env vars
- Migration process
- Startup order
- Health checks
- Rollback steps
- Log/metric locations

Acceptance criteria:

- A new operator can deploy staging from the runbook.

---

## 5.3 Add staging environment

Required staging setup:

- Staging Postgres
- Staging Redis
- Staging S3 bucket
- Staging mail provider
- Staging web/API domains
- Separate secrets

Acceptance criteria:

- Staging deploy runs without local defaults.
- E2E happy path passes against staging.

---

# Phase 6 — Final functionality tests

## Objective

Create confidence that all core product workflows work without demo shortcuts.

---

## 6.1 Local infra validation

After Docker Desktop is running:

```bash
pnpm infra:up
pnpm smoke
pnpm db:migrate
pnpm test
```

Acceptance criteria:

- Smoke passes.
- Vitest suite passes.

---

## 6.2 Local demo validation

```bash
pnpm demo:reset
```

Then in another terminal:

```bash
pnpm e2e:happy
pnpm qa:click-path
pnpm qa:responsive
```

Acceptance criteria:

- Login succeeds.
- Dashboard loads.
- Workflow starts.
- Approval flow works.
- Receipt/evidence path works.
- Responsive QA passes.

---

## 6.3 Production-mode validation

Run frontend with:

```txt
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
NEXT_PUBLIC_API_URL=<real API URL>
```

Run backend with:

```txt
NODE_ENV=production
```

Validate:

- No demo credentials prefilled.
- Demo login fails.
- `?demo=1` does nothing.
- API errors show error UI.
- Fixture data does not appear.
- Analytics waits for consent.
- `/app/*` requires auth.

---

## 6.4 Manual functional checklist

### Auth

- Register workspace.
- Login.
- Logout.
- Refresh session after reload.
- Invalid login shows error.
- Demo mode disabled in production mode.

### Dashboard

- `/app/home` loads from API.
- Global search opens and navigates.
- Sidebar and mobile nav work.
- Refresh button works.
- Pending approval count matches API.

### Agents

- Create agent.
- Edit agent.
- Pause/resume/revoke agent.
- Agent detail shows related runs.

### Vendors

- Create vendor.
- Edit vendor.
- Delete vendor.
- Vendor detail shows workflows/credentials.

### Credentials

- Create credential.
- Grant credential to agent.
- Revoke grant.
- Revoke credential.
- Secret is never displayed after create.

### Policies

- Create policy.
- Edit policy.
- Evaluate policy.
- Verify allow/deny/approval outputs.

### Workflows

- Create workflow.
- Edit workflow.
- Start workflow.
- Readiness checks render accurately.
- Run detail opens.

### Approvals

- Approval list loads.
- Approval detail shows evidence.
- Approve request.
- Reject requires comment.
- Run state updates after decision.

### Receipts

- Receipt list loads.
- Receipt detail opens.
- Hash copy works.
- Export works.
- Evidence file download works.

### Audit

- Audit list loads.
- Audit drawer opens.
- Payload is redacted.
- Copy event/hash works.
- Related links navigate correctly.

---

# Phase 7 — Compliance and enterprise hardening

## Objective

Prepare for security-conscious teams and enterprise customers.

## Work items

- Email verification.
- Invite acceptance flow.
- MFA for owners/admins/approvers.
- SSO/SAML/OIDC.
- SCIM user provisioning.
- Per-org retention policies.
- Receipt export audit logs.
- Admin activity review.
- Security disclosure page.
- DPA/privacy documentation.
- SOC 2 evidence collection.

---

## Recommended execution order

1. Phase 0: gate demo/fixtures.
2. Phase 1: harden auth/routing.
3. Phase 2: harden API exposure/config.
4. Phase 3: make data layer production-safe.
5. Run production-mode frontend/backend validation.
6. Phase 4: secure worker/vault/files/audit.
7. Phase 5: staging deployment.
8. Phase 6: full E2E and QA validation.
9. Phase 7: enterprise/compliance roadmap.

---

## Definition of production-ready MVP

AegisWeb can be considered production-ready for a limited beta when all of the following are true:

- Demo mode is impossible unless explicitly enabled.
- Production never shows fixture data as real operational data.
- `/app/*` is protected before render.
- Access/refresh session handling is production-safe.
- API CORS is allowlisted.
- Swagger is disabled or protected.
- Auth routes are rate limited.
- Worker/internal routes use scoped auth or equivalent protection.
- File upload/download limits exist.
- Credentials use production-grade key management.
- Audit chain is concurrency-safe.
- Production deploy path and rollback process are documented.
- Local and staging E2E happy paths pass.
