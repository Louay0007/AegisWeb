# AegisWeb

<p align="center">
  <img src="apps/web/public/images%20(2)/aegisweb_primary_logo.png" alt="AegisWeb logo" width="360" />
</p>

<p align="center">
  <strong>The permission, credential, approval, browser-runtime, and audit layer for AI agents acting on the web.</strong>
</p>

<p align="center">
  <a href="#why-aegisweb">Why</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#local-demo">Local demo</a> ·
  <a href="#security-model">Security</a> ·
  <a href="#development">Development</a>
</p>

---

## Why AegisWeb

AI agents can now browse websites, fill forms, download invoices, update settings, and operate across business tools. But companies cannot safely hand autonomous agents raw passwords, admin access, payment authority, or unrestricted browser control.

The bottleneck is no longer only intelligence. It is permission.

**AegisWeb gives AI agents controlled authority:** scoped identities, vaulted credentials, policy decisions, human approvals, workflow execution, browser evidence, and receipts for every important action.

The first wedge is practical and narrow:

> Safely let AI procurement agents manage SaaS invoices, renewals, and approval-gated plan changes without exposing raw credentials or allowing silent destructive actions.

## What It Does

AegisWeb provides a full local MVP for safe web-agent operations.

| Capability | What AegisWeb Provides |
| --- | --- |
| Agent identity | Each agent has its own non-human identity, purpose, status, and owning organization. |
| Credential vault | Vendor credentials are encrypted at rest and granted only to approved agents. |
| Policy engine | Website allowlists, denied actions, spending thresholds, risk levels, and approval rules. |
| Controlled browser runtime | Playwright-based browser context with domain allowlists, popup blocking, downloads, screenshots, and private-network safeguards. |
| Workflow engine | Queue-backed invoice download, renewal check, and plan downgrade workflows. |
| Human approval | Risky actions pause for approval before submission. |
| Audit trail | Important operations and worker actions produce audit events with hash-chain metadata. |
| Evidence files | Screenshots, invoices, downloads, and receipt artifacts are stored through S3-compatible object storage. |
| Receipts | Final trust artifacts summarize what happened, which policy applied, who approved, and what evidence was captured. |
| Dashboard | Next.js operational dashboard for agents, vendors, credentials, policies, workflows, runs, approvals, receipts, audit, and settings. |
| Vendor sandbox | Local fake SaaS vendor portal for safe deterministic demos and tests. |

## Product Flow

The flagship MVP workflow is a SaaS vendor plan change that requires approval.

```text
Owner logs in
  -> creates or selects agent, vendor, credential, policy, workflow
  -> starts Acme Downgrade Request
  -> API creates workflow run and queues worker job
  -> worker opens controlled browser
  -> worker logs into vendor sandbox using vaulted credential
  -> worker reads renewal and plan data
  -> policy engine classifies plan change as risky
  -> run pauses for human approval
  -> approver reviews evidence and approves or rejects
  -> worker resumes only after approval
  -> approved action is submitted
  -> receipt and audit trail are generated
```

## Architecture

```text
apps/web                Next.js dashboard and marketing surface
apps/api                NestJS REST control-plane API
apps/worker             BullMQ + Playwright workflow worker
apps/vendor-sandbox     Local fake SaaS vendor portal

libs/domain             Shared enums, permissions, errors, queue types, workflow types
libs/database           Prisma client and seed data
libs/policy-engine      Pure policy/risk evaluation
libs/vault              AES-256-GCM secret encryption and redaction helpers
libs/browser-runtime    Controlled Playwright runtime
libs/audit              Audit helper surface
libs/testing            Test helpers

prisma/schema.prisma    PostgreSQL schema and migrations
infra/docker-compose.yml Local infrastructure and app profile
tests/                  Backend, worker, browser, dashboard, and acceptance tests
```

### Runtime Components

| Component | Role |
| --- | --- |
| Web dashboard | User-facing app for managing agents, vendors, policies, workflows, approvals, receipts, and audit evidence. |
| API | Auth, RBAC, organization isolation, CRUD resources, workflow queueing, approval decisions, receipts, OpenAPI docs, and internal worker endpoints. |
| Worker | Consumes BullMQ jobs, runs browser workflows, calls internal API, records action attempts, uploads evidence, and creates receipts. |
| Vendor sandbox | Local portal that simulates billing, invoices, renewal data, admin actions, downgrade, and cancellation paths. |
| Postgres | System of record for organizations, users, agents, policies, credentials, workflows, runs, approvals, audit, files, receipts, refresh tokens. |
| Redis | BullMQ workflow queues and production rate-limit counters. |
| MinIO | Local S3-compatible object storage for screenshots, invoices, downloads, and receipt artifacts. |
| Mailpit | Local approval notification inbox. |

## Tech Stack

### Backend

- Node.js 22+
- TypeScript
- NestJS 11
- Prisma 7
- PostgreSQL 17
- Redis 8
- BullMQ
- S3-compatible storage via AWS SDK
- Argon2id password hashing
- JWT access tokens and refresh-token cookies
- Zod validation
- Vitest and Supertest

### Worker And Browser Runtime

- NestJS application context
- BullMQ workers
- Playwright Chromium
- Controlled browser context per workflow run
- Domain allowlist and private-network blocking
- Screenshot and download capture
- Worker-scoped internal tokens

### Frontend

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Radix UI / shadcn-style local primitives
- TanStack React Query
- Sonner toasts
- Iconoir and Lucide icons

## Security Model

AegisWeb is security-sensitive by design. The security model is built around least privilege, explicit approval, and evidence capture.

### Implemented Controls

- Argon2id password hashing.
- Short-lived access tokens.
- Refresh token cookie with `HttpOnly`, `SameSite=Lax`, path scoping, and production `Secure` flag.
- Atomic refresh-token consumption with unique token hash.
- RBAC across owner, admin, approver, auditor, and developer roles.
- Owner-only management for owner-level role transitions.
- Organization-scoped database queries and cross-organization tests.
- AES-256-GCM credential encryption.
- Credential decrypt only for authorized workflow runs and active credential grants.
- Worker-scoped HMAC run tokens.
- User-facing queue diagnostics no longer expose worker tokens or job payloads.
- Production rate limiting uses Redis TTL counters.
- Trusted-proxy-aware `X-Forwarded-For` handling.
- Browser runtime blocks private-network destinations by default.
- Production web builds reject localhost API URLs.
- Web security headers and nonce-based CSP without `unsafe-eval`.
- API production HSTS.
- Recursive redaction of secret-like fields in audit, receipts, and action metadata.
- Secret-leakage and cross-organization security regression coverage.

### Security Documentation

- `docs/SECURITY_AUDIT.md` contains the full security audit, findings, remediations, and pilot gate checklist.
- `AI_PROJECT_CONTEXT.md` is the AI/contributor orientation file and should be read before changing the codebase.

## Local Demo

### Requirements

- Node.js `>=22`
- pnpm `>=10`
- Docker Desktop or compatible Docker runtime
- Playwright browser dependencies for worker/browser tests

### Install

```bash
pnpm install
```

### Start Local Infrastructure

```bash
pnpm infra:up
```

This starts:

- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- MinIO on `localhost:9000` and console on `localhost:9001`
- Mailpit SMTP on `localhost:1025` and UI on `localhost:8025`

### Seed Demo Data

```bash
pnpm db:reset
```

### Start Apps Manually

Use separate terminals:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:vendor
pnpm dev:web
```

Or start API, worker, and vendor sandbox together:

```bash
pnpm dev
pnpm dev:web
```

### One-Command Demo

```bash
pnpm demo:local
```

Clean seeded demo:

```bash
pnpm demo:reset
```

### Hybrid Docker Mode

Run backend services in Docker and the frontend locally:

```bash
pnpm stack:hybrid:up
pnpm dev:web
```

Logs and cleanup:

```bash
pnpm stack:hybrid:logs
pnpm stack:hybrid:down
```

## Local URLs

| Service | URL |
| --- | --- |
| Web dashboard | `http://localhost:3000` |
| API | `http://localhost:3001` |
| API readiness | `http://localhost:3001/health/ready` |
| OpenAPI JSON | `http://localhost:3001/docs-json` |
| Swagger UI | `http://localhost:3001/docs` |
| Vendor sandbox | `http://localhost:4202` |
| Mailpit | `http://localhost:8025` |
| MinIO console | `http://localhost:9001` |

## Demo Accounts

After seeding, all demo users use:

```text
Password123!
```

| Role | Email |
| --- | --- |
| Owner | `founder@northstarlabs.dev` |
| Approver | `finance@northstarlabs.dev` |
| Auditor | `auditor@northstarlabs.dev` |
| Developer | `dev@northstarlabs.dev` |

## Seeded Demo Workspace

Seed data creates `Northstar Labs` with realistic SaaS procurement state.

Seeded agents:

- `Procurement Bot`
- `Invoice Collector`
- `Risky Admin Bot`
- `Legacy Spend Bot`

Seeded vendors:

- `Acme Analytics`
- `Nimbus Docs`
- `Atlas CRM`
- `PayrollPro`

Seeded workflows:

- `Acme Invoice Download`
- `Acme Renewal Check`
- `Acme Downgrade Request`
- `Atlas Renewal Check`
- `Payroll Read Attempt`

Seeded run history includes completed, waiting-for-approval, approved, rejected, expired, failed, denied, and canceled states.

## API Surface

The API exposes user-facing resources and internal worker endpoints.

User-facing groups:

- `/auth`
- `/organization`
- `/users`
- `/agents`
- `/vendors`
- `/policies`
- `/credentials`
- `/workflows`
- `/workflow-runs`
- `/approvals`
- `/receipts`
- `/files`
- `/audit-events`

Internal worker groups:

- `/internal/workers/runs/:runId/events`
- `/internal/workers/runs/:runId/screenshots`
- `/internal/workers/runs/:runId/files`
- `/internal/workers/runs/:runId/complete`
- `/internal/workers/runs/:runId/fail`
- `/internal/workers/runs/:runId/approval-requests`
- `/internal/workers/runs/:runId/action-attempts`
- `/internal/vault/credentials/:id/decrypt-for-run`

OpenAPI docs are available locally when enabled:

```text
GET /docs
GET /docs-json
```

## Development

### Common Commands

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

### Database Commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm db:deploy
```

### Production Check

```bash
pnpm prod:check
```

This runs:

- Prisma generate
- TypeScript typecheck
- ESLint
- High-severity production dependency audit
- Next.js production build

## Tests

The project uses Vitest. Test coverage includes:

- API foundation and health.
- Auth and refresh flows.
- RBAC and organization isolation.
- Audit logging and file storage.
- Agents, vendors, policies, credentials, workflows, runs, approvals, receipts.
- Queue behavior and worker diagnostics.
- Browser runtime controls.
- Full MVP backend acceptance.
- Dashboard client/data-layer behavior.
- Security coverage inventory.

For integration tests that share local services, use a single fork:

```bash
pnpm test -- --pool=forks --poolOptions.forks.singleFork=true
```

## Production Notes

Production deployment should use:

- Managed Postgres.
- Managed Redis with auth/TLS or private-network isolation.
- Private S3-compatible object storage with encryption.
- HTTPS web and API domains.
- Real SMTP provider with TLS/auth.
- Strong secrets injected by the runtime platform.
- `ENABLE_OPENAPI=false` unless protected.
- `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`.
- `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false`.

See `docs/production-runbook.md` for the production runbook.

## Documentation Map

| Document | Purpose |
| --- | --- |
| `AI_PROJECT_CONTEXT.md` | AI/contributor orientation and source-of-truth context. |
| `docs/SECURITY_AUDIT.md` | Full security audit and remediation status. |
| `docs/MVP_BACKEND_ACCEPTANCE.md` | Local MVP acceptance proof. |
| `docs/production-runbook.md` | Staging/production deployment notes. |
| `docs/FRONTEND_DESIGN_SPEC.md` | Frontend implementation direction. |
| `docs/DASHBOARD_COMPLETION_PLAN.md` | Dashboard product plan. |
| `docs/PHASE_*_COMPLETION_NOTES.md` | Historical implementation notes. |

## Project Status

AegisWeb is an advanced local MVP, not yet a hosted production service. It is suitable for local demos, security review, and continued product development. Before handling real customer credentials, apply migrations, run the DB-backed security regression suites, and complete the remaining pilot gate items in `docs/SECURITY_AUDIT.md`.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the project owner.
