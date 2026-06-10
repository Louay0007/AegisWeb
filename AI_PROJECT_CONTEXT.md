# AegisWeb AI Project Context

Last updated: 2026-06-10

This file is the fast orientation document for future AI agents and contributors. Read it before changing code. It summarizes what the product is, how the monorepo is structured, what is currently implemented, and which docs are historical or potentially stale.

## Product In One Sentence

AegisWeb is the identity, permission, approval, credential, browser-runtime, and audit layer that lets AI agents safely take actions on the web.

## Product Intent

AegisWeb exists because AI agents can now browse websites and perform useful business tasks, but companies cannot safely give them raw passwords, broad browser access, payment authority, or unreviewed permission to make destructive changes. AegisWeb gives each AI agent a controlled identity, scoped permissions, credential access through a vault, policy decisions, human approval gates, and audit receipts for every important action.

The current wedge is SaaS procurement and finance operations. The MVP demonstrates an agent working against a local SaaS vendor sandbox to inspect renewals, download invoices, prepare plan changes, request approval, execute approved actions, and produce receipts.

Core product principles:

- Permission before autonomy.
- Human approval for risky actions.
- Every important action leaves an audit trail and receipt.
- Start with narrow SaaS procurement workflows, then grow toward infrastructure for the agentic web.
- Never expose raw secrets to the frontend, logs, receipts, screenshots, or an LLM planner.

## Naming Caveat

The repository is named `AegisWeb`, and the user-facing frontend brand is `AegisWeb`. Some package names, Docker container names, seed identifiers, code aliases, and older documents still use `AgentPass` because this project was originally developed under that name.

Current convention:

- Use `AegisWeb` for user-facing copy, docs, product messaging, and UI labels.
- Do not rename internal `agentpass` package names, database names, path aliases, or Docker resources unless explicitly asked. They are wired through scripts, env vars, migrations, and tests.
- Treat older docs that say Angular is required as historical. The current implemented web app is Next.js App Router with React 19.

## Repository Shape

This is a TypeScript pnpm workspace.

```text
AegisWeb/
  apps/
    api/              NestJS control-plane REST API
    worker/           NestJS application context running BullMQ and Playwright workflows
    vendor-sandbox/   Local fake SaaS vendor portal for demos and tests
    web/              Next.js 16 App Router dashboard and marketing site
  libs/
    audit/            Minimal audit status helper, hash-chain work mostly in API/seed
    browser-runtime/  Controlled Playwright runtime and domain guardrails
    database/         Prisma client and seed data
    domain/           Shared enums, permissions, policy types, queue types, errors
    policy-engine/    Pure policy evaluation and risk scoring
    testing/          Test helpers
    vault/            AES-256-GCM secret encryption and redaction helpers
  prisma/
    schema.prisma     PostgreSQL data model
    migrations/       Prisma migrations
  infra/
    docker-compose.yml Local infra and app profiles
  tests/              Backend and full-stack Vitest specs
  scripts/            Smoke, demo, E2E, and QA scripts
  docs/               Product, implementation, phase, dashboard, and runbook docs
```

Workspace config:

- Root package: `package.json`, currently named `agentpass`.
- Workspace packages: `apps/*` and `libs/*` from `pnpm-workspace.yaml`.
- Root TypeScript config uses `module: NodeNext`, strict mode, and path aliases such as `@agentpass/domain` and `@/*` for `apps/web/*`.
- Root TypeScript excludes `apps/web` because the Next app has its own TypeScript setup.

## Main Technology Stack

Backend and worker:

- Node.js 22+.
- TypeScript 5.7+.
- NestJS 11.
- PostgreSQL 17 with Prisma 7.
- Redis 8 with BullMQ 5.
- MinIO/S3-compatible object storage.
- Mailpit local SMTP/inbox.
- Playwright Chromium for browser automation.
- Argon2id password hashing.
- JWT access tokens plus refresh token cookie.
- Zod for DTO/env validation in many controllers.
- Vitest for tests.

Frontend:

- Next.js 16 App Router.
- React 19.
- Tailwind CSS 4.
- Radix UI/shadcn-style local primitives.
- TanStack React Query for server state.
- Sonner toasts.
- Iconoir and some Lucide icons.
- Motion/GSAP dependencies are present, but the dashboard should stay operational and evidence-first rather than decorative.

Local infrastructure:

- Docker Compose runs Postgres, Redis, MinIO, and Mailpit.
- Docker Compose app profile can also run API, worker, vendor sandbox, migrations, and web.

## Canonical Local Ports

- Web dashboard: `http://localhost:3000`
- API: `http://localhost:3001`
- Worker: no public HTTP port by default
- Vendor sandbox: `http://localhost:4202`
- Mailpit UI: `http://localhost:8025`
- Mailpit SMTP: `localhost:1025`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Common Commands

Use pnpm from the repository root.

```bash
pnpm install
pnpm infra:up
pnpm db:reset
pnpm dev
pnpm dev:web
```

One-command local demo:

```bash
pnpm demo:local
```

Clean seeded demo:

```bash
pnpm demo:reset
```

Hybrid mode, with backend services in Docker and local Next dev server:

```bash
pnpm stack:hybrid:up
pnpm dev:web
```

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
pnpm e2e:happy
pnpm qa:click-path
pnpm qa:responsive
pnpm prod:check
```

Database commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm db:deploy
```

## Required Environment

Use `.env.example` as the local reference. Important variables:

- `API_PORT=3001`
- `API_BASE_URL=http://localhost:3001`
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `DATABASE_URL=postgresql://agentpass:agentpass@localhost:5432/agentpass`
- `REDIS_URL=redis://localhost:6379`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `VAULT_MASTER_KEY`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`
- `DASHBOARD_BASE_URL=http://localhost:3000`
- `WORKER_INTERNAL_TOKEN`
- `VENDOR_SANDBOX_URL=http://localhost:4202`
- `API_ALLOWED_ORIGINS=http://localhost:3000`
- `ENABLE_OPENAPI=false` locally unless docs are needed
- `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`
- `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false`

Production config is intentionally stricter in `apps/api/src/config/config.service.ts` and `apps/web/lib/runtime-config.ts`. Production requires real secrets, HTTPS origins, no local dependency URLs unless explicitly allowed, and `ENABLE_OPENAPI=false`.

## Demo Data

The seed script is `libs/database/src/seed.ts`. It deletes and recreates the demo organization with domain `northstarlabs.dev`.

Seeded login users all use password `Password123!`:

- `founder@northstarlabs.dev`, role `OWNER`, name `Maya Chen`.
- `finance@northstarlabs.dev`, role `APPROVER`, name `Leo Martinez`.
- `auditor@northstarlabs.dev`, role `AUDITOR`, name `Priya Shah`.
- `dev@northstarlabs.dev`, role `DEVELOPER`, name `Samir Haddad`.

Seeded organization:

- `Northstar Labs`
- domain `northstarlabs.dev`
- plan `business`

Seeded agents include:

- `Procurement Bot`, active, handles SaaS invoices, renewals, and billing workflows.
- `Invoice Collector`, active, downloads invoices from approved vendor portals.
- `Risky Admin Bot`, paused, used for denied admin/security actions.
- `Legacy Spend Bot`, revoked, used for audit examples.

Seeded vendors include:

- `Acme Analytics`, analytics, local sandbox URL, main demo vendor.
- `Nimbus Docs`, productivity.
- `Atlas CRM`, sales.
- `PayrollPro`, payroll, intentionally blocked/denied in demo flows.

Seeded workflows include:

- `Acme Invoice Download`, template `vendor_invoice_download`.
- `Acme Renewal Check`, template `saas_renewal_check`.
- `Acme Downgrade Request`, template `plan_downgrade_request`.
- `Atlas Renewal Check`, template `saas_renewal_check`.
- `Payroll Read Attempt`, template `vendor_invoice_download`, expected denial.

Seeded historical runs cover completed, waiting for approval, approved downgrade, rejected, expired, failed, denied, and canceled states. This gives the dashboard meaningful data immediately after `pnpm db:reset`.

## Core Data Model

The Prisma schema is in `prisma/schema.prisma`. It uses PostgreSQL with UUID primary keys, enums, JSONB fields, and organization scoping.

Main tables/models:

- `Organization`: workspace root. Owns users, agents, vendors, policies, credentials, workflows, runs, action attempts, approval requests, audit events, files, receipts, and refresh tokens.
- `User`: organization member with role, status, password hash, and refresh tokens.
- `Agent`: non-human actor with identifier, purpose, status, creator, policies, grants, workflow runs, action attempts, approvals, audit events, and receipts.
- `Vendor`: SaaS portal metadata, website, category, renewal date, monthly cost, owner, and soft-delete timestamp.
- `Policy`: JSON policy rules, type, status, version, optional agent binding.
- `Credential`: encrypted vault payload tied to vendor and organization.
- `CredentialAgentGrant`: grants an agent access to a credential with a scope.
- `Workflow`: reusable workflow definition for an agent and vendor.
- `WorkflowRun`: executable run instance with status, timestamps, current step, result summary, error, and JSON state.
- `ActionAttempt`: recorded browser or business action with risk, policy decision, summaries, amount, metadata, and completion.
- `ApprovalRequest`: human approval gate for a risky action attempt.
- `AuditEvent`: append-style audit event with previous hash and event hash.
- `File`: object-storage metadata for screenshots, invoices, traces, downloads, and exports.
- `Receipt`: final trust artifact for completed, failed, denied, or canceled runs.
- `RefreshToken`: hashed refresh token records.

Important enums:

- Roles: `owner`, `admin`, `approver`, `auditor`, `developer`.
- Agent statuses: `active`, `paused`, `revoked`.
- Workflow templates: `vendor_invoice_download`, `saas_renewal_check`, `plan_downgrade_request`.
- Workflow run statuses: `queued`, `running`, `waiting_for_approval`, `completed`, `failed`, `canceled`, `denied`.
- Action types: `open_page`, `read_page`, `fill_form`, `click_button`, `download_file`, `submit_form`, `change_plan`, `cancel_subscription`, `invite_user`, `change_billing_details`, `make_purchase`, `credential_injection`.
- Policy decisions: `allow`, `deny`, `require_approval`, `require_step_up_auth`, `pause_agent`.
- Risk levels: `low`, `medium`, `high`, `critical`.
- Approval statuses: `pending`, `approved`, `rejected`, `expired`, `auto_approved`, `escalated`.

## Shared Domain Library

`libs/domain/src` is the shared source for pure domain values and helpers.

Important files:

- `enums.ts`: string constants mirroring Prisma enum values for app code.
- `permissions.ts`: role-to-permission map and `hasPermission`.
- `policy.ts`: policy snapshots, risk signals, default policy, and action risk defaults.
- `workflows.ts`: workflow template definitions and legal run status transitions.
- `queue.ts`: BullMQ queue names, job modes, job data, and id helpers.
- `worker-token.ts`: issuing/verifying scoped internal worker run tokens.
- `errors.ts`: `DomainError`, `DomainErrorCode`, and helpers.
- `pagination.ts`, `audit.ts`, `ids.ts`: support types/utilities.

Role permissions:

- Owner and Admin get all permissions.
- Approver can read core entities, approve approvals, read receipts and files.
- Auditor can read core entities, approvals, receipts, audit events, and files.
- Developer can read core entities and run/cancel workflows.

## Policy Engine

`libs/policy-engine/src/index.ts` is intentionally pure and database-free.

`evaluatePolicy` checks, in order:

- Agent must be active.
- Domain must not be blocked.
- Domain must be in the allowlist.
- Action must not be explicitly denied.
- Amount must not exceed hard deny limit.
- Approval-required actions require approval.
- Amount above approval threshold requires approval.
- Amount below auto-approval threshold may allow if action is allowed.
- High or critical risk requires approval.
- Action must be allowed.

`extractRiskSignals` derives signals such as unknown domain, financial amount, credential use, first run, submit button, sensitive file download, plan change, cancellation, payment, and dangerous keywords.

The default policy in `libs/domain/src/policy.ts` is conservative: only `open_page` and `read_page` are allowed by default; destructive/admin/payment actions are denied or approval-gated.

## Vault And Secret Handling

`libs/vault/src/index.ts` encrypts credential payloads with AES-256-GCM. The master key can be a 32-byte base64 key or a sufficiently long string that is hashed to a 256-bit key. Optional associated data can bind payloads to organization and credential IDs.

Rules to preserve:

- Do not return raw credential secrets from API endpoints.
- Do not show encrypted payloads in the UI.
- Do not log passwords, tokens, cookies, authorization headers, or secret-like keys.
- Use `redactSecretLikeValues` for secret-like JSON if adding logs, receipts, or diagnostic output.
- Worker obtains decrypted credentials through internal vault APIs, not direct frontend access.

## Browser Runtime

`libs/browser-runtime/src/index.ts` wraps Playwright in a controlled context.

Implemented behavior:

- Launches isolated Chromium context per workflow run.
- Enforces allowed domains on navigation and after clicks.
- Blocks popups/new tabs that leave the allowed domain set.
- Supports credential field filling while marking secret fields.
- Supports click attempts, downloads, screenshots, and DOM metadata extraction.
- Masks password and secret-marked fields before screenshots.
- Saves downloads with SHA-256, size, URL, and timestamp.

This library should remain a guardrail layer. Do not bypass it in worker workflows unless there is a concrete reason and equivalent safety checks are added.

## API Application

Entry point: `apps/api/src/main.ts`.

Main module: `apps/api/src/app.module.ts`.

API responsibilities:

- Auth, sessions, and RBAC.
- Organization, user, agent, vendor, policy, credential, workflow, run, approval, receipt, file, and audit management.
- Queueing workflow starts, resumes, and cancels.
- Worker-internal endpoints for action attempts, audit events, file/screenshot uploads, credential decrypt, approval creation, run complete/fail, and receipts.
- OpenAPI docs when enabled.

Global middleware in `AppModule`:

- `RequestContextMiddleware`
- `SecurityHeadersMiddleware`
- `RateLimitMiddleware`
- `RequestLoggingMiddleware`

API CORS allows requests with no origin or an origin listed in `API_ALLOWED_ORIGINS`, with credentials enabled.

OpenAPI:

- Enabled only when `ENABLE_OPENAPI` parses true.
- Swagger UI: `GET /docs`.
- JSON: `GET /docs-json`.
- Tests document that protected routes use bearer auth and internal routes use worker-token auth.

Response shape:

- Success endpoints generally return `{ data: ... }`, or paginated `{ data, meta }`.
- Errors are normalized by `DomainExceptionFilter` to `{ error: { code, message, requestId, details? } }`.

## API Auth And Authorization

Auth controller: `apps/api/src/auth/auth.controller.ts`.

Public auth endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Authenticated endpoint:

- `GET /auth/me`

Session behavior:

- Login/register returns an access token in the response data and writes refresh token cookie `agentpass_refresh_token`.
- Refresh token cookie is `HttpOnly`, `SameSite=Lax`, `Path=/auth`, and `Secure` only in production.
- Refresh/logout perform trusted origin checks using `Origin` or `Referer`.
- Frontend stores access token in browser storage and relies on refresh cookie for renewal.

Authorization behavior:

- Protected routes require a bearer access token unless marked public or internal.
- `JwtAuthGuard` loads user, verifies active status, and places user and organization ID into request context.
- Permission decorators such as `@RequirePermission` and role decorators such as `@RequireRole` enforce RBAC.
- Internal worker routes use worker-token auth through `InternalWorkerGuard`.

## API Route Map

Important user-facing routes:

- `GET /health`, `GET /health/ready`.
- `GET /organization`, `PATCH /organization`.
- `GET /users`, `GET /users/:id`, `POST /users/invite`, `PATCH /users/:id/role`, `POST /users/:id/disable`.
- `GET /agents`, `POST /agents`, `GET /agents/:id`, `PATCH /agents/:id`, `POST /agents/:id/pause`, `POST /agents/:id/resume`, `POST /agents/:id/revoke`, `GET /agents/:id/activity`.
- `GET /vendors`, `POST /vendors`, `GET /vendors/:id`, `PATCH /vendors/:id`, `DELETE /vendors/:id`.
- `GET /policies`, `POST /policies`, `POST /policies/evaluate`, `GET /policies/:id`, `PATCH /policies/:id`.
- `GET /credentials`, `POST /credentials`, `GET /credentials/:id`, `PATCH /credentials/:id`, `POST /credentials/:id/grants`, `DELETE /credentials/:id/grants/:grantId`, `POST /credentials/:id/revoke`.
- `GET /workflows/templates`, `GET /workflows`, `POST /workflows`, `GET /workflows/:id`, `PATCH /workflows/:id`, `POST /workflows/:id/runs`.
- `GET /workflow-runs`, `GET /workflow-runs/:id`, `GET /workflow-runs/:id/events`, `GET /workflow-runs/:id/queue`, `POST /workflow-runs/:id/cancel`.
- `GET /workflow-runs/:runId/action-attempts`.
- `GET /approvals`, `GET /approvals/:id`, `POST /approvals/:id/approve`, `POST /approvals/:id/reject`.
- `GET /receipts`, `GET /receipts/:id`, `GET /receipts/:id/export`.
- `GET /files/:id`, `GET /files/:id/download`.
- `GET /audit-events`, `GET /audit-events/:id`.

Important internal worker routes:

- `POST /internal/workers/runs/:runId/events`
- `POST /internal/workers/runs/:runId/screenshots`
- `POST /internal/workers/runs/:runId/files`
- `POST /internal/workers/runs/:runId/complete`
- `POST /internal/workers/runs/:runId/fail`
- `POST /internal/workers/runs/:runId/approval-requests`
- `POST /internal/workers/runs/:runId/action-attempts`
- `PATCH /internal/workers/action-attempts/:id/complete`
- `PATCH /internal/workers/action-attempts/:id/fail`
- `POST /internal/vault/credentials/:id/decrypt-for-run`

## Queueing And Worker

Queue service: `apps/api/src/queue/workflow-queue.service.ts`.

Worker entry point: `apps/worker/src/main.ts`.

Worker module: `apps/worker/src/worker.module.ts`.

Worker queue service: `apps/worker/src/queue/worker-queue.service.ts`.

Executor: `apps/worker/src/workflow-executor/workflow-executor.service.ts`.

Queues:

- `workflow-runs` for start jobs.
- `workflow-resume` for resume jobs after approval.
- `workflow-maintenance` for cancel jobs, queued by API but not consumed by the current worker service.

API enqueue behavior:

- Start job ID: `start-${workflowRunId}`.
- Resume job ID: `resume-${workflowRunId}-${approvalRequestId}`.
- Cancel job ID: `cancel-${workflowRunId}`.
- Queue adds are idempotent by job ID.
- Start/resume jobs retry 3 times with exponential backoff.
- Worker run tokens are scoped to organization ID and workflow run ID and expire after 6 hours.

Worker consumption behavior:

- Worker starts BullMQ workers for `workflow-runs` and `workflow-resume` with concurrency 1.
- The executor handles `start` and `resume` modes.
- The executor skips unknown modes and templates.
- The executor currently implements deterministic workflows for the local vendor sandbox.

Implemented workflow behavior:

- `vendor_invoice_download`: starts run, checks policy, decrypts credential, opens controlled browser, logs into sandbox, downloads latest invoice, uploads invoice and screenshot, records events, completes run, creates receipt.
- `saas_renewal_check`: starts run, checks policy, decrypts credential, opens controlled browser, reads renewal data, uploads screenshot, records events, completes run, creates receipt.
- `plan_downgrade_request`: starts by preparing a risky change-plan action; if policy requires approval, creates approval and puts run into waiting state. Resume path uses approval context to submit the approved downgrade, complete the run, and create receipt.

Preserve these workflow invariants:

- Browser automation runs in the worker, not in API request handlers.
- Risky actions must be recorded as action attempts.
- Policy denials produce denied runs and receipts.
- Failures should update run state and create failed receipts.
- Approval-gated workflows must not submit sensitive actions until approved.
- Worker uses internal API for audit/files/credentials where appropriate.

## Vendor Sandbox

Entry point: `apps/vendor-sandbox/src/main.ts`.

Controller: `apps/vendor-sandbox/src/vendor-sandbox.controller.ts`.

The sandbox is a fake SaaS vendor portal used by local demos and tests. It exposes:

- `GET /health`
- `GET /`
- `GET /login`
- `POST /login`
- `GET /dashboard`
- `GET /billing`
- `GET /billing?format=json`
- `GET /billing/invoices/latest.pdf`
- `POST /billing/downgrade`
- `POST /billing/cancel`
- `GET /admin/users`
- `POST /admin/users/invite`

The sandbox intentionally includes risky admin, cancellation, and downgrade actions so policy and approval behavior can be tested locally without real vendor credentials.

## Web App

The current frontend lives in `apps/web`. It is not Angular. It is Next.js App Router.

Important files:

- `apps/web/app/layout.tsx`: global providers, metadata, fonts, analytics consent, toaster.
- `apps/web/app/page.tsx`: marketing landing page.
- `apps/web/app/login/page.tsx`, `apps/web/app/register/page.tsx`: auth routes.
- `apps/web/app/app/layout.tsx`: protected product shell wrapper.
- `apps/web/middleware.ts`: redirects `/app/*` to `/login` unless `aegisweb_session` marker cookie exists.
- `apps/web/lib/api/api-client.ts`: fetch wrapper with access token, request IDs, refresh retry, downloads, and error parsing.
- `apps/web/lib/auth/auth-session.tsx`: auth session provider, boot, sign in, sign out, refresh.
- `apps/web/lib/data-layer/resource-queries.ts`: React Query read queries and low-level API resource methods.
- `apps/web/lib/data-layer/mutations.ts`: mutation hooks, normalization, cache invalidation, and toasts.
- `apps/web/lib/api/mappers.ts`: backend DTO to dashboard fixture-shaped model mapping.
- `apps/web/lib/fixtures/dashboard.ts`: fixture data used for fallback/demo contexts.
- `apps/web/components/app-shell/*`: sidebar, mobile nav, top bar, nav item definitions.
- `apps/web/components/product/*`: management screens and approval/run/detail surfaces.
- `apps/web/components/data/*`, `display/*`, `evidence/*`: reusable product UI primitives.

Protected product routes:

- `/app/home`
- `/app/agents`, `/app/agents/[agentId]`
- `/app/vendors`, `/app/vendors/[vendorId]`
- `/app/credentials`, `/app/credentials/[credentialId]`
- `/app/policies`, `/app/policies/[policyId]`
- `/app/workflows`, `/app/workflows/[workflowId]`
- `/app/runs`, `/app/runs/[runId]`
- `/app/approvals`, `/app/approvals/[approvalId]`
- `/app/receipts`, `/app/receipts/[receiptId]`
- `/app/audit`
- `/app/settings`

Web API behavior:

- `apiRequest` sends `credentials: include`, `content-type: application/json`, `x-request-id`, and bearer token if available.
- On 401 it attempts `/auth/refresh` once, saves the new access token, then retries.
- Downloads use `apiDownload` and parse `content-disposition` filename.
- API errors become `ApiError` with code, message, request ID, details, and HTTP status.

Data layer behavior:

- React Query keys live in `query-keys.ts`.
- Resource queries co-locate query key, fetcher, stale time, and polling intervals.
- Runs and approvals poll because they represent near-realtime workflow state.
- Mutations centralize cache invalidation and toast errors.
- Payload normalizers convert UI form fields to backend DTO shapes, for example dollars to cents, credential fields into `secretJson`, policy form fields into `rulesJson`, and workflow setup values into `configurationJson`.

Frontend feature flags:

- `NEXT_PUBLIC_ENABLE_DEMO_MODE` controls demo auth mode.
- `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK` controls fixture fallback.
- `NEXT_PUBLIC_ALLOW_LOCAL_API_URL` allows localhost API URL in production builds only when true.

## UI And Design Direction

The product dashboard should feel like a controlled evidence room: minimal, precise, monochrome, operational, dense enough for operators, and serious about trust.

Keep these dashboard rules:

- Use existing Tailwind semantic tokens from `apps/web/app/globals.css`.
- Prefer borders over heavy shadows.
- Use `tabular-nums` for counters, prices, durations, dates, and hashes.
- Risk/status badges should use icon plus label, not color alone.
- Risky actions need explicit confirmation and clear consequences.
- Do not show plaintext secrets, encrypted payloads, tokens, password hashes, or raw credential values.
- Evidence panels, tables, timelines, audit drawers, and receipts are core surfaces, not decoration.
- Marketing pages can be more cinematic; product routes should stay calm and inspectable.

Important design docs:

- `docs/FRONTEND_DESIGN_SPEC.md` is relevant for current AegisWeb frontend direction.
- `docs/DASHBOARD_COMPLETION_PLAN.md` captures dashboard product goals.
- `docs/WEB_DESIGN_SYSTEM.md` contains useful tokens and component inventory, but includes stale MONO/architecture product language. Use it for implementation tokens, not product meaning.

## Testing And Acceptance

Test runner: Vitest.

Test config: `vitest.config.ts`.

Included tests:

- `tests/**/*.spec.ts`
- `apps/**/*.spec.{ts,tsx}`
- `libs/**/*.spec.ts`

Web component tests run in jsdom via `environmentMatchGlobs`.

Major acceptance proof:

- `tests/mvp-backend-acceptance.spec.ts` validates the full local backend story: login, workflow start, worker execution, approval pause, Mailpit notification, human approval, resume, completion, receipt, files/screenshots, and secret-safe evidence.

Documented acceptance results from `docs/MVP_BACKEND_ACCEPTANCE.md`:

- Full backend validation previously passed with 31 test files and 195 tests.
- `pnpm smoke` verified Postgres, Redis, and MinIO.

Common verification commands:

```bash
pnpm typecheck
pnpm lint
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
pnpm smoke
pnpm e2e:happy
```

Use the fork pool command for backend integration specs when tests share local services or in-process Nest apps.

## Production Notes

See `docs/production-runbook.md` for deployment details. Key production expectations:

- Managed Postgres, Redis, S3-compatible storage, and SMTP provider.
- HTTPS domains for API and web.
- Production-grade secrets of at least 32 characters.
- `ENABLE_OPENAPI=false` unless intentionally protected.
- `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` and `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false`.
- Demo login must not work unless real seeded/demo credentials are intentionally deployed.
- API unavailable states must not silently show fixture records in production.
- Refresh/logout with cross-site origins must be rejected.

The current root `Dockerfile` has build targets `api`, `worker`, `vendor-sandbox`, `web-builder`, and `web`. Compose file `infra/docker-compose.yml` uses the root Dockerfile targets for local app profiles.

## Documentation Map

Useful current docs:

- `README.md`: product spec plus local runbook.
- `AegisWeb_detailed_product_spec.md`: detailed product spec without the local runbook prefix.
- `docs/MVP_BACKEND_ACCEPTANCE.md`: final local MVP backend acceptance proof.
- `docs/PHASE_29_COMPLETION_NOTES.md`: OpenAPI and API contract documentation.
- `docs/production-runbook.md`: staging/production deployment path.
- `docs/dashboard-frontend-backend-sync-audit.md`: dashboard/API sync findings and fixes.
- `docs/FRONTEND_DESIGN_SPEC.md`: current frontend implementation direction.
- `docs/DASHBOARD_COMPLETION_PLAN.md`: product dashboard completion plan.

Historical or partially stale docs:

- `docs/TECHNICAL_CONCEPTION.md` and `docs/BACKEND_IMPLEMENTATION_PLAN.md` describe the original AgentPass/Angular plan. They are still useful for backend architecture intent, but the actual frontend is Next.js.
- `docs/WEB_DESIGN_SYSTEM.md` has stale MONO/architecture language, but useful Tailwind token and component references.

Phase completion notes:

- `docs/PHASE_*_COMPLETION_NOTES.md` document incremental implementation history from backend foundation through API docs. Use them to understand why a module exists, but verify current behavior in source before changing code.

## Development Guidelines For Future AI Agents

Before editing:

- Read this file, then inspect the exact files related to the task.
- Do not assume older docs are current if they conflict with source code.
- Preserve organization scoping and permission checks on every backend endpoint.
- Keep policy engine and vault libraries pure and database-free.
- Do not add frontend fixture-only behavior to production paths.
- Do not expose raw secrets or encrypted credential payloads.
- Prefer minimal, targeted changes over broad rewrites.
- If changing API shapes, update frontend mappers, mutations, tests, and OpenAPI docs where relevant.
- If changing workflow state behavior, update state transition tests and worker/API queue behavior together.
- If changing dashboard mutations, verify backend DTO expectations and cache invalidation.

Good first files to inspect by task type:

- Auth/RBAC: `apps/api/src/auth`, `apps/api/src/authorization`, `libs/domain/src/permissions.ts`, `apps/web/lib/auth`.
- API data resources: the matching controller/service in `apps/api/src/<resource>` plus Prisma model and web `resource-queries.ts`/`mappers.ts`.
- Worker workflows: `apps/worker/src/workflow-executor/workflow-executor.service.ts`, connector files, queue services, internal API client.
- Policy behavior: `libs/policy-engine/src/index.ts`, `libs/domain/src/policy.ts`, API policy evaluation service.
- Credential behavior: `libs/vault/src/index.ts`, API credentials module, worker vault client.
- Dashboard pages: `apps/web/app/app`, `apps/web/components/product`, `apps/web/lib/data-layer`.
- Local demo issues: `scripts/demo-local.ts`, `infra/docker-compose.yml`, seed script, `README.md` runbook.

## Known Important Invariants

- Every organization-scoped query must filter by `organizationId`.
- Every protected business route must have auth and permission checks.
- Every mutating business operation should emit audit events where the module currently supports auditing.
- Workflow state transitions should use explicit allowed transitions.
- Queue operations should be idempotent by job ID.
- Browser runtime must enforce domain allowlists.
- Screenshots should mask credential fields.
- Receipts and notifications must avoid raw secrets.
- Approval-required actions must pause before sensitive submission.
- Production must not rely on demo mode or fixture fallback.
