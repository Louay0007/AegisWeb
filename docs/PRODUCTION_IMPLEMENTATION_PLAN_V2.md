# AegisWeb — Production Implementation Plan v2

**Generated:** 2026-06-26  
**Status:** All 198 tests passing, demo/MVP complete, 24 dashboard routes built  
**Target:** Production-ready limited beta with paying design partners

---

## Executive Summary

The project has a strong foundation: full CRUD backend, 3 workflow types (invoice download, renewal check, plan downgrade with approval gates), credential vault, policy engine, 24 dashboard routes, 198 passing tests, Docker deployment, and a completed security audit.

**What remains for production readiness:**

| Dimension | Current | Target |
|-----------|---------|--------|
| Security score | 3.8/5 | 4.5/5 |
| Auth model | Bearer token in JS memory | BFF / HttpOnly session |
| Frontend tests | 0 | >100 |
| Settings page | Skeleton | Fully functional |
| CI/CD | None | Full pipeline |
| Monitoring | Basic logging | Metrics + alerting |
| Billing | Not built | Stripe integration |
| Onboarding | Demo login | Proper signup flow |

**Total estimated effort:** 8-10 weeks (2 developers full-time)  
**Critical path:** Security → Auth model → CI/CD → Launch prep

---

## Phase 1: Security Hardening (Week 1-2)

**Goal:** Close all remaining audit findings. No P0/P1/P2 vulnerabilities.

### 1.1 — Remediate P2 Audit Findings (Week 1, Days 1-3)

#### 1.1.1 — Remove Request Context Trust of Client-Supplied Headers
**Files:** `apps/api/src/request-context/request-context.middleware.ts`
- Remove reading `x-user-id`, `x-organization-id`, `x-user-role` from headers
- Set context exclusively from verified JWT claims
- Add integration test: spoofed headers are ignored
- **Test:** `tests/security/request-context-spoof.spec.ts`

#### 1.1.2 — Prevent Account Enumeration in Auth
**Files:** `apps/api/src/auth/auth.service.ts`
- Return generic error on login (`Invalid email or password`) regardless of whether user exists
- Perform dummy Argon2 verification for non-existent users (constant-time)
- Return generic registration error (`Registration failed`) in production
- **Test:** `tests/security/account-enumeration.spec.ts`

#### 1.1.3 — Remove Demo Registration Fallback
**Files:** `apps/web/components/auth/register-form.tsx`, `apps/web/components/auth/auth-client.ts`
- Delete `demoSessionFor()` function
- Remove demo fallback try/catch in registration handler
- API failure → show real error, never redirect to `/app/home?demo=1`
- Production guard: fail build if `NEXT_PUBLIC_ENABLE_DEMO_MODE=true`

#### 1.1.4 — Remove Fixture Fallback for Unauthenticated States
**Files:** `apps/web/lib/data-layer/resource-hooks.ts`, `apps/web/lib/data-layer/feature-flags.ts`
- Never return fixture data when user is unauthenticated
- API error → show error UI, not fallback data
- Detail lookup returns `null` instead of first fixture
- **Test:** fixture data never renders in production mode

#### 1.1.5 — Harden Artifact MIME/Magic Validation
**Files:** `apps/api/src/files/file-storage.service.ts`
- Validate actual file magic bytes against declared MIME type
- Use `file-type` package or manual magic byte check (PNG: `89 50 4E 47`, PDF: `25 50 44 46`)
- Reject upload on mismatch
- Streaming size check before full buffer (cap to `MAX_FILE_SIZE`)
- **Test:** `tests/security/file-mime-validation.spec.ts`

#### 1.1.6 — Unify Worker Audit with API Audit Service
**Files:** `apps/worker/src/audit/worker-audit.service.ts`
- Remove direct Prisma audit writes from worker
- Route all worker audit events through `POST /internal/runs/:id/events`
- API-side redaction and hash chaining applies to worker events
- **Test:** worker audit events are redacted and hash-chained identically

#### 1.1.7 — Harden Container Images (Non-Root User)
**Files:** `Dockerfile`
- Add `USER node` to all final stages (`api`, `worker`, `vendor-sandbox`, `web`)
- Add `RUN chown -R node:node /app` before switching user
- Use `COPY --chown=node:node` for all copies
- Read-only root filesystem where possible (`--read-only`)

#### 1.1.8 — Add Remaining Security Tests
Create files:
- `tests/security/cross-org-isolation.spec.ts` — every resource type
- `tests/security/secret-redaction.spec.ts` — nested objects, arrays, all sensitive keys
- `tests/security/screenshot-redaction.spec.ts` — credential fields masked
- `tests/security/demo-fixture-production.spec.ts` — demo/fixture impossible in prod

### 1.2 — Remediate P3 Audit Findings (Week 1, Days 3-4)

#### 1.2.1 — Error Response Hardening
**Files:** `apps/api/src/errors/domain-exception.filter.ts`
- Production mode: return generic `Internal Server Error` for unhandled exceptions
- Log full error with request ID server-side
- Add `X-Request-Id` to all error responses

#### 1.2.2 — JWT Validation Hardening
**Files:** `apps/api/src/auth/token.service.ts`
- Validate decoded header `alg` (reject `none`), `typ`, `kid`
- Add `iss` (issuer) and `aud` (audience) claims to tokens
- Verify claims on every protected request
- Denylist access tokens on logout (Bloom filter or Redis set, 15m TTL)

#### 1.2.3 — HMAC Refresh Token Hashes
**Files:** `apps/api/src/auth/refresh-token.service.ts`
- Hash refresh tokens with HMAC-SHA256 using `JWT_REFRESH_SECRET`
- Migration: re-hash all existing tokens
- **Test:** token hash without secret cannot be forged

#### 1.2.4 — SMTP Library with STARTTLS/Auth
**Files:** `apps/api/src/notifications/email-notification.adapter.ts`
- Replace raw `node:net` SMTP with `nodemailer` (full-featured)
- Add STARTTLS, SMTP auth, connection pool
- Strict email validation using `validator` library
- CRLF injection prevention in all headers
- **Test:** email delivery with TLS, CRLF injection rejected

#### 1.2.5 — File DTO Object-Key Redaction
**Files:** `apps/api/src/files/files.types.ts`
- Remove `storageKey`, `bucket` from public DTOs
- Return only `id`, `originalName`, `mimeType`, `size`, `createdAt`

#### 1.2.6 — Dependency Audit & Remediation
- Run `pnpm audit --prod` — resolve remaining moderate advisories
- Add Dependabot/Renovate config
- Add `pnpm audit --prod --audit-level moderate` to CI
- Generate SBOM on release (`pnpm sbom` or `cyclonedx-npm`)

### 1.3 — Credential Vault Production Model (Week 2, Days 1-3)

#### 1.3.1 — Enforce Production-Grade Master Key
**Files:** `libs/vault/src/vault.service.ts`, `apps/api/src/config/api-config.service.ts`
- Production mode: reject passphrase-style keys (< 32 bytes entropy)
- Require base64-encoded 32 random bytes
- Add key format migration utility
- Production config validation: fail boot if `VAULT_MASTER_KEY` is weak

#### 1.3.2 — AAD (Additional Authenticated Data) Binding
- Bind AES-GCM AAD to `organizationId + credentialId`
- Decrypt fails if AAD doesn't match, preventing ciphertext migration

#### 1.3.3 — Worker Transport Encryption Requirement
**Files:** `apps/worker/src/config/worker-config.service.ts`
- Production mode: fail worker boot if `API_BASE_URL` is `http://`
- Support HTTPS, mTLS, or Unix socket in production
- Dev mode: allow `http://localhost` only

### 1.4 — Penetration Testing & Validation (Week 2, Days 3-5)

#### 1.4.1 — Run Full DB-Backed Security Regression Suite
```bash
pnpm db:reset
pnpm test tests/security/
```

#### 1.4.2 — Third-Party Penetration Test
- OWASP Top 10 automated scan (ZAP/Burp)
- Manual session management review
- Browser runtime SSRF testing
- Credential vault binary extraction testing

#### 1.4.3 — Security Score Audit
- Re-run full audit scorecard
- Target: 4.5/5 in every category

---

## Phase 2: Auth & Session Production Model (Week 3-4)

**Goal:** Eliminate JS-accessible tokens, add BFF pattern, prepare for MFA.

### 2.1 — Backend-For-Frontend (BFF) Pattern (Week 3)

#### 2.1.1 — Add Next.js API Route Proxy
**Files:** `apps/web/app/api/auth/[...nextauth]/route.ts` (new)
- `/api/auth/login` → proxies `POST /auth/login`, sets HttpOnly secure cookie
- `/api/auth/refresh` → proxies `POST /auth/refresh`, rotates cookie
- `/api/auth/logout` → proxies `POST /auth/logout`, clears cookie
- `/api/auth/me` → proxies `GET /auth/me`
- `/api/proxy/*` → generic API proxy with session cookie

#### 2.1.2 — Remove Client-Side Token Storage
**Files:** `apps/web/lib/auth/token-storage.ts`
- Delete `localStorage` and `globalThis` token storage
- Remove `accessToken` from client-side state
- API client reads session from HttpOnly cookie via BFF proxy
- Refresh happens transparently in the BFF, not in JS

#### 2.1.3 — Harden Session Cookie
- `HttpOnly`, `Secure`, `SameSite=Lax`
- `__Host-` prefix for domain locking
- Signed with server-side secret
- Path-restricted to `/api/auth`

#### 2.1.4 — Update API Client
**Files:** `apps/web/lib/api/client.ts`
- All requests go through `/api/proxy/*` (BFF)
- No `Authorization` header set by JS
- 401 handling: BFF auto-refreshes, only redirects to login on refresh failure
- Rate-limit awareness: 429 → backoff + retry

#### 2.1.5 — Update Auth Context / Middleware
- Middleware checks BFF session marker (server-signed cookie, not JS-writable)
- Auth context reads from `/api/auth/me` instead of stored token
- No token state in React context

### 2.2 — MFA for Human Users (Week 4, Days 1-3)

#### 2.2.1 — TOTP Enrollment & Verification
- Add `mfa_secret`, `mfa_enabled`, `mfa_backup_codes` to user model
- `POST /auth/mfa/enroll` — generate TOTP secret, return QR code
- `POST /auth/mfa/verify` — verify TOTP + enable MFA
- `POST /auth/mfa/disable` — admin or owner with current TOTP
- `POST /auth/mfa/recovery` — use backup code

#### 2.2.2 — MFA Challenge on Login
- Login with MFA returns `mfa_required` + temp token
- `POST /auth/mfa/challenge` with TOTP code → returns access/refresh tokens
- Owner/Admin/Approver roles: MFA required in production

#### 2.2.3 — MFA UI
- MFA enrollment page in settings (`/app/settings/security`)
- QR code display using `qrcode` library
- Backup codes display (one-time)
- TOTP challenge page after login when MFA enabled

### 2.3 — Step-Up Auth for Risky Actions (Week 4, Days 4-5)

#### 2.3.1 — Step-Up Endpoints
- `POST /auth/step-up` — re-authenticate with password or TOTP
- Returns short-lived step-up token (5 minutes)
- Required for: credential create, policy override, org settings change

#### 2.3.2 — Step-Up UI Integration
- Approve/reject dialogs for sensitive actions
- Step-up challenge embedded in modal
- Fallback to email verification if MFA not configured

---

## Phase 3: Production Infrastructure & CI/CD (Week 5-6)

**Goal:** Repeatable, secure, observable deployment pipeline.

### 3.1 — CI/CD Pipeline (Week 5, Days 1-3)

#### 3.1.1 — GitHub Actions Workflow
**File:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-typecheck:
    - pnpm install
    - pnpm db:generate
    - pnpm typecheck
    - pnpm lint

  audit:
    - pnpm audit --prod --audit-level moderate

  test:
    - pnpm infra:up
    - pnpm db:migrate
    - pnpm test
    - pnpm infra:down

  build:
    - pnpm build
    - Build Docker images (api, worker, web)

  security-scan:
    - Trivy container scan
    - Gitleaks secret scan
    - CodeQL analysis
```

#### 3.1.2 — CD Pipeline
**File:** `.github/workflows/deploy.yml`
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-staging:
    - Build Docker images
    - Run migrations (pnpm db:deploy)
    - Deploy to staging environment
    - Run smoke tests
    - Run E2E happy path

  deploy-production:
    needs: [deploy-staging]
    environment: production
    - Promote staging images to production
    - Run migrations
    - Blue-green deployment
    - Smoke tests
    - Health check monitoring
```

#### 3.1.3 — Environment Management
- Staging: `staging.aegisweb.com`, separate DB/Redis/S3
- Production: `app.aegisweb.com`, `api.aegisweb.com`
- Secrets in GitHub Environments (not in repo)
- Terraform/Pulumi infrastructure-as-code

### 3.2 — Monitoring & Observability (Week 5, Days 3-5)

#### 3.2.1 — Structured Logging
**Files:** `apps/api/src/logging/`, `apps/worker/src/logging/`
- JSON-structured logs (pino or nestjs-pino)
- Fields: `requestId`, `orgId`, `userId`, `runId`, `duration`, `status`
- Worker: `jobId`, `queueName`, `workflowTemplate`
- Log levels: debug, info, warn, error, fatal

#### 3.2.2 — Metrics
- Prometheus metrics endpoint (`GET /metrics`)
- API: request count, latency p50/p95/p99, error rate by endpoint
- Worker: job processing time, queue depth, success/fail rate
- Business: runs started/completed/failed, approvals pending/approved/rejected
- Credential: decrypt count, grant count, revoke count

#### 3.2.3 — Alerting Rules
- API error rate > 5% (5xx)
- Worker job failure rate > 10%
- Queue depth > 100 (stuck jobs)
- Approval request older than 1 hour (escalate)
- Credential decrypt failure > 3 in 5 minutes
- Disk space < 20% (Postgres, S3, logs)

#### 3.2.4 — Health Dashboard
- Grafana dashboard (or Datadog/NewRelic)
- Panels: API latency, worker throughput, queue depth, error rate by type
- Business: active runs, pending approvals, success rate

### 3.3 — Infrastructure Hardening (Week 6, Days 1-3)

#### 3.3.1 — Docker Compose for Production
**File:** `infra/docker-compose.prod.yml`
- No host port binding for stateful services (internal network only)
- Redis password + TLS
- Postgres: non-default user, TLS, backup volume
- MinIO: KMS encryption, private bucket policy
- All services: resource limits, health checks, restart policy

#### 3.3.2 — Database Operations
- Automated daily backups (pg_dump to S3)
- Point-in-time recovery configuration
- Read replicas for audit/analytics queries
- Connection pooling (PgBouncer)

#### 3.3.3 — Redis Operations
- Redis Cluster or Sentinel for HA
- Persistence (AOF + RDB)
- Memory limits and eviction policy
- ACL-based access control

#### 3.3.4 — Secret Rotation Process
Create `docs/secret-rotation-runbook.md`:
- JWT_ACCESS_SECRET rotation (zero-downtime, overlap period)
- JWT_REFRESH_SECRET rotation
- VAULT_MASTER_KEY rotation (re-encrypt all credentials)
- WORKER_INTERNAL_TOKEN rotation
- Database credential rotation

### 3.4 — Disaster Recovery (Week 6, Days 3-5)

#### 3.4.1 — Backup Strategy
| Asset | Frequency | Retention | Restore RTO | Restore RPO |
|-------|-----------|-----------|-------------|-------------|
| PostgreSQL | Daily full + WAL streaming | 30 days | 1 hour | 5 minutes |
| S3/MinIO objects | Continuous replication | 90 days | 2 hours | 15 minutes |
| Redis | AOF + daily RDB | 7 days | 15 minutes | 1 minute |
| Docker images | Per deploy | 30 releases | 10 minutes | N/A |

#### 3.4.2 — Disaster Recovery Runbook
Create `docs/disaster-recovery-runbook.md`:
- Scenario 1: Database corruption
- Scenario 2: Credential vault compromise
- Scenario 3: Worker runtime compromise
- Scenario 4: Full region failure
- Scenario 5: Security incident (credential leak)

#### 3.4.3 — Incident Response Plan
Create `docs/incident-response-plan.md`:
- Triage checklist (severity, impact, affected assets)
- Communication template
- Evidence preservation steps
- Post-mortem template

---

## Phase 4: Product Completeness (Week 7-8)

**Goal:** Every screen, feature, and flow works end-to-end without demo shortcuts.

### 4.1 — Settings Page Completion (Week 7, Days 1-2)

#### 4.1.1 — Organization Profile
**File:** `apps/web/app/app/settings/page.tsx`
- Org name, slug, domain (display + edit)
- Billing email
- Plan info (read-only until billing is built)

#### 4.1.2 — User Management
- User table with role, status, last login
- Invite user flow (email → create → send invite link)
- Role change with confirmation
- Disable/re-enable user
- Current user's own profile (change name, password)

#### 4.1.3 — Security Settings
- MFA enable/disable (Phase 2 integration)
- Active sessions list
- API keys (future)
- Webhooks (future)

#### 4.1.4 — Notification Preferences
- Email notification toggle for: approval requests, run completions, failures
- Slack webhook URL (future)

### 4.2 — Onboarding Flow (Week 7, Days 2-4)

#### 4.2.1 — Registration → First Run Flow
1. Register workspace
2. Email verification (send verification link)
3. Create first agent (guided wizard)
4. Add first vendor
5. Store first credential
6. Create first workflow
7. Start first run
8. See receipt

#### 4.2.2 — Empty States
Every list page with first-time guidance:
- Agents: "Create your first agent to start automating vendor workflows"
- Vendors: "Add a vendor portal to connect your SaaS accounts"
- Credentials: "Store your first credential securely in the vault"
- Policies: "Set rules that govern your agents' behavior"
- Workflows: "Create a workflow to automate a task"
- Runs: "Start a workflow to see your first run"
- Approvals: "No pending approvals"
- Receipts: "Completed runs generate receipts here"
- Audit: "Events appear here as agents execute workflows"

#### 4.2.3 — Getting Started Wizard
- `/app/getting-started` — 5-step wizard
- Step 1: Create agent
- Step 2: Add vendor
- Step 3: Store credential
- Step 4: Create workflow
- Step 5: Start run
- Progress indicator and skip option

#### 4.2.4 — Email Verification Flow
- `POST /auth/register` → sends verification email
- `GET /auth/verify?token=xxx` → marks email verified
- Unverified users: banner warning, limited functionality
- Resend verification button

### 4.3 — Password Reset Flow (Week 7, Days 4-5)

#### 4.3.1 — Backend Endpoints
- `POST /auth/forgot-password` — sends reset link
- `POST /auth/reset-password` — validates token + sets new password

#### 4.3.2 — Frontend Pages
- `/forgot-password` — email input
- `/reset-password?token=xxx` — new password + confirmation
- Success page with login link
- Expired/invalid token error handling

### 4.4 — Loading & Error States (Week 8, Days 1-2)

#### 4.4.1 — Skeleton Screens
Every list and detail page:
- Table skeleton: 5 rows with shimmer animation
- Detail skeleton: header + 3 content blocks
- Dashboard skeleton: 4 metric cards + 2 panels

#### 4.4.2 — Error Boundaries
- Route-level error boundary (`error.tsx`)
- Component-level error boundary for panels
- Global error boundary with "Report issue" action

#### 4.4.3 — Network Error Handling
- Offline indicator banner
- Retry button on failed requests
- Stale data indicator (last updated timestamp)
- Optimistic updates with rollback on failure

### 4.5 — Accessibility Audit (Week 8, Days 2-3)

#### 4.5.1 — Automated Audit
- `pa11y-ci` or `axe-core` in CI
- Target: 0 critical violations, < 5 serious violations

#### 4.5.2 — Manual Audit Checklist
- Keyboard navigation for all interactive elements
- Screen reader testing (NVDA/VoiceOver)
- Color contrast (WCAG AA minimum)
- Focus management (dialogs, modals, page transitions)
- `aria-live` regions for status updates
- Reduced motion support
- Zoom to 200% without breakage

### 4.6 — Pagination & Performance (Week 8, Days 3-4)

#### 4.6.1 — Backend Pagination
- All list endpoints: `page`, `limit`, `sort`, `filter` params
- Return `{ data, meta: { total, page, limit, totalPages } }`
- Default limit: 20, max limit: 100

#### 4.6.2 — Frontend Pagination
- Server-side pagination for all tables
- Previous/next with page numbers
- Result count display ("Showing 1-20 of 156")
- URL query param sync (`/app/agents?page=2&status=active`)

#### 4.6.3 — Virtual Scrolling for Audit
- `@tanstack/react-virtual` for large audit event lists
- Load-on-scroll for audit events
- Debounced search input

#### 4.6.4 — Query Optimization
- N+1 query detection and fix
- React Query stale times: dashboard 30s, lists 10s, detail 5s
- Prefetching on hover for detail pages
- Paginated queries with `keepPreviousData`

### 4.7 — Dark Mode Parity (Week 8, Days 4-5)

#### 4.7.1 — Theme System
- System preference detection (prefers-color-scheme)
- Manual toggle in settings
- Persist to cookie (server-compatible)
- CSS variables for all colors

#### 4.7.2 — Dark Mode Audit
- Every component reviewed in dark mode
- Screenshot viewer dark backdrop
- Chart colors adapted for dark
- No hardcoded light colors

---

## Phase 5: Testing & Quality (Week 9)

**Goal:** Comprehensive test coverage that prevents regressions.

### 5.1 — Frontend Test Suite (Week 9, Days 1-3)

#### 5.1.1 — Component Tests (Vitest + Testing Library)
- 40+ UI primitives: Button, Card, Input, Table, Dialog, etc.
- Dashboard components: MetricCard, StatusBadge, etc.
- Form components: validation, submission, error display
- Auth components: login, register, MFA, password reset
- Target: 30+ component tests

#### 5.1.2 — Integration Tests
- Auth flow: login, register, refresh, logout, MFA
- Dashboard: home loads metrics, approvals panel, active runs
- Page navigation: every route loads without error
- Data layer: API client success/error/refresh flow
- Target: 20+ integration tests

#### 5.1.3 — Playwright E2E Tests
- `tests/e2e/` directory
- Login → dashboard → navigate all pages
- Start workflow → wait for approval → approve → verify receipt
- Create/read/update/delete for each resource type
- Mobile responsive check
- Target: 10 E2E scenarios

### 5.2 — Load & Performance Tests (Week 9, Days 3-4)

#### 5.2.1 — API Load Test (k6/Artillery)
- Auth endpoints: 100 req/s login/register
- CRUD endpoints: 500 req/s read, 100 req/s write
- Queue endpoints: 50 concurrent workflow starts
- File endpoints: 20 concurrent uploads (1MB each)
- Targets: p95 < 500ms, no errors, no memory leak

#### 5.2.2 — Worker Load Test
- 20 concurrent workflow executions
- 50 concurrent approval processing
- Memory: stable under load (no leak)
- Redis queue: no job loss

#### 5.2.3 — Frontend Performance
- Lighthouse score > 90 (mobile + desktop)
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Bundle size audit (code splitting, dynamic imports)

### 5.3 — Regression Test Suite (Week 9, Days 4-5)

#### 5.3.1 — Backend Regression Tests
- All 27 API modules: CRUD + auth + audit for each
- All 3 workflow templates: end-to-end
- Policy engine truth table: 50+ scenarios
- State machine: all transitions tested
- Every audit event type emitted correctly

#### 5.3.2 — Security Regression Tests
- Cross-org isolation (every resource type)
- Queue diagnostics redaction
- Credential exfiltration attempt
- Admin escalation attempt
- Refresh race condition
- SSRF via browser runtime
- Secret leakage (API, worker, UI, receipts, audit, email)

---

## Phase 6: Operations & Observability (Week 9-10)

**Goal:** Operate the product with confidence.

### 6.1 — Structured Logging Implementation

#### 6.1.1 — pino Integration
- Replace `console.log` with structured pino logger
- Request-scoped logging (auto-attach `requestId`, `orgId`, `userId`)
- Worker-scoped logging (auto-attach `jobId`, `runId`, `workflowTemplate`)
- Log redaction: strip `authorization`, `cookie`, `secret*`, `password*`, `token*`

#### 6.1.2 — Centralized Log Aggregation
- Loki + Grafana (self-hosted) or Papertrail/Logtail
- Log queries by requestId, orgId, runId, error type
- Log retention: 30 days hot, 90 days cold

### 6.2 — Metrics & Alerting Setup

#### 6.2.1 — Prometheus Endpoint
**File:** `apps/api/src/metrics/metrics.controller.ts`
- Standard Node.js metrics (event loop lag, heap, GC)
- HTTP metrics (request count, duration, status code)
- Business metrics (runs, approvals, credentials)

#### 6.2.2 — Grafana Dashboards
- Operations dashboard: API health, worker health, queue depth
- Business dashboard: runs/hour, approval rate, success rate
- Security dashboard: auth failures, rate limit hits, credential decryption

#### 6.2.3 — Alert Channels
- PagerDuty/OpsGenie for P0/P1 incidents
- Slack for warnings and information
- Email digest for daily summary

### 6.3 — Rate Limiting Production Configuration

#### 6.3.1 — Redis-Backed Rate Limits
**Files:** `apps/api/src/rate-limit/`
- Global: 1000 req/min per IP
- Auth: 10 req/min per IP (login, register, refresh, forgot-password)
- API: 100 req/min per user (per endpoint group)
- Worker internal: 500 req/min per worker token
- File upload: 50 req/min per org
- BullMQ job creation: 30 req/min per org

#### 6.3.2 — Rate Limit Response
- 429 response with `Retry-After` header
- Rate limit exceeded body: `{ error: { code: "RATE_LIMITED", retryAfter: 30 } }`
- Frontend: auto-backoff + user notification

### 6.4 — Incident Response Readiness

#### 6.4.1 — Runbook Automation
- Scripts for common operations:
  - `scripts/rotate-jwt-secrets.sh`
  - `scripts/rotate-vault-key.sh`
  - `scripts/emergency-disable-agent.sh`
  - `scripts/db-failover.sh`

#### 6.4.2 — Communication Templates
- Status page template (internal + external)
- Customer notification template for security incidents
- Post-mortem template

---

## Phase 7: Compliance & Enterprise (Week 10-11)

**Goal:** Meet enterprise security and compliance requirements.

### 7.1 — Audit & Compliance Features (Week 10, Days 1-3)

#### 7.1.1 — Audit Exports
- `GET /audit/export` — CSV, JSON, PDF
- Date range filter, event type filter
- Include hash chain verification
- Email export for long-running exports (> 100k events)

#### 7.1.2 — Immutable Audit Storage
- WORM (Write-Once-Read-Many) storage for audit events
- Append-only database table (trigger-based protection)
- External anchoring to blockchain or AWS CloudTrail (future)

#### 7.1.3 — Data Retention Policies
- Per-org configurable retention:
  - Audit events: 90 days / 1 year / 7 years
  - Receipts: 1 year / 3 years / permanent
  - Screenshots: 30 days / 90 days / 1 year
  - Credential usage log: 90 days / 1 year
- Automated archival job (cron + BullMQ)

#### 7.1.4 — Compliance Reporting
- SOC 2 evidence collection (automated)
- Data processing agreement (DPA) generation
- Security questionnaire auto-fill (future)

### 7.2 — Enterprise SSO/SAML (Week 10, Days 3-5)

#### 7.2.1 — SAML 2.0 Integration
- `POST /auth/saml/metadata` — upload IdP metadata
- `GET /auth/saml/login` — initiate SP-initiated SSO
- `POST /auth/saml/acs` — Assertion Consumer Service
- Auto-provision users from SAML attributes

#### 7.2.2 — OIDC/Google Workspace
- Google Workspace OIDC as identity provider
- Auto-provision from Google directory
- SCIM provisioning (future)

### 7.3 — Billing & Subscription (Week 11, Days 1-3)

#### 7.3.1 — Stripe Integration
- `POST /billing/create-checkout` — Stripe Checkout session
- `POST /billing/webhook` — Stripe webhook handler (idempotent)
- `GET /billing/portal` — Stripe Customer Portal
- Plans: Starter ($99/mo), Business ($499/mo), Enterprise (custom)

#### 7.3.2 — Usage-Based Billing
- Track active agents per org
- Track workflow runs per org (included vs. overage)
- Track storage (included vs. overage)
- Usage dashboard in settings

### 7.4 — Data Privacy Features (Week 11, Days 3-5)

#### 7.4.1 — Data Export
- `POST /account/export` — GDPR data export
- Async job: gather all org data → ZIP → S3 → email link

#### 7.4.2 — Account Deletion
- `POST /account/delete` — GDPR deletion request
- 30-day grace period before permanent deletion
- Audit record preserved (anonymized)
- Cascade deletion with configurable exclusions

#### 7.4.3 — Data Processing Agreement
- In-app DPA acceptance flow
- DPA document generation with org details
- Audit log of DPA acceptance

---

## Phase 8: Pilot & Launch Preparation (Week 11-12)

**Goal:** Convert design partners to paying customers.

### 8.1 — Design Partner Onboarding Kit (Week 11, Days 4-5)

#### 8.1.1 — Documentation
- User guide: `docs/user-guide.md`
- Admin guide: `docs/admin-guide.md`
- Quick start: `docs/quick-start.md`
- Integration guide: `docs/integration-guide.md`

#### 8.1.2 — In-App Help
- Contextual help tooltips
- Documentation links in empty states
- Feedback widget (Intercom or in-app)

#### 8.1.3 — Support Channels
- Email support: support@aegisweb.com
- In-app chat (Intercom/Crisp)
- Status page: status.aegisweb.com

### 8.2 — Production Launch Checklist (Week 12, Days 1-3)

#### 8.2.1 — Final Security Validation
- [ ] All P0/P1/P2 findings fixed
- [ ] Penetration test passed (no critical/high findings)
- [ ] `pnpm audit --prod --audit-level moderate` passes
- [ ] Cross-org isolation tests pass
- [ ] Secret leakage tests pass
- [ ] SSRF protection validated
- [ ] Rate limiting configured and tested
- [ ] HTTPS enforced everywhere
- [ ] CSP/security headers present on all responses
- [ ] Demo mode impossible in production
- [ ] Fixture fallback impossible in production

#### 8.2.2 — Infrastructure Validation
- [ ] CI/CD pipeline passing
- [ ] Docker images built and pushed to registry
- [ ] Staging environment deployed and tested
- [ ] Production environment provisioned
- [ ] Database backups configured and tested
- [ ] Disaster recovery plan documented
- [ ] Monitoring and alerting configured
- [ ] Incident response runbook published

#### 8.2.3 — Product Validation
- [ ] All 198 + new tests passing
- [ ] Frontend tests passing (>100)
- [ ] E2E happy path passing (all workflows)
- [ ] Load test targets met
- [ ] Lighthouse scores > 90
- [ ] Accessibility audit passed
- [ ] Mobile responsive validated
- [ ] Dark mode/light mode both working

#### 8.2.4 — Operational Readiness
- [ ] Production runbook complete
- [ ] Secret rotation runbook complete
- [ ] On-call rotation established
- [ ] Escalation path documented
- [ ] Status page live
- [ ] Support channels active

### 8.3 — Pilot Launch (Week 12, Days 3-5)

#### 8.3.1 — Pilot Selection Criteria
- 3-5 design partners
- SaaS-heavy teams (10+ vendor portals)
- Existing approval workflow problems
- Willing to provide feedback weekly

#### 8.3.2 — Pilot Success Metrics
- Workflow success rate > 95%
- Approval response time < 30 minutes
- Credential vault: zero leaks
- Receipt trust: zero integrity failures
- NPS > 40

#### 8.3.3 — Feedback Loop
- Weekly check-in calls
- In-app feedback collection
- Usage analytics (opt-in)
- Feature request tracking

---

## Dependency Tree

```
Phase 1 (Security) ─────────────────────────────────────┐
                                                         │
Phase 2 (Auth Model) ─── depends on Phase 1 ────────────┤
                                                         │
Phase 3 (Infra/CI/CD) ─── depends on Phase 1 ───────────┤
                                                         │
Phase 4 (Product) ─────── depends on Phase 2 ───────────┤
                                                         │
Phase 5 (Testing) ─────── depends on Phase 1, 2, 4 ─────┤
                                                         │
Phase 6 (Operations) ──── depends on Phase 3 ───────────┤
                                                         │
Phase 7 (Compliance) ──── depends on Phase 1, 2, 3 ─────┤
                                                         │
Phase 8 (Launch) ──────── depends on ALL ────────────────┘
```

## Parallelizable Work

| Track A (Backend-heavy) | Track B (Frontend-heavy) |
|--------------------------|--------------------------|
| Phase 1.1-1.3 (Security) | Phase 4.1 (Settings) |
| Phase 2.1 (BFF proxy) | Phase 4.2 (Onboarding) |
| Phase 3.1 (CI/CD) | Phase 4.3 (Password reset) |
| Phase 3.3 (Infrastructure) | Phase 4.4 (Loading/error states) |
| Phase 5.2 (Load tests) | Phase 4.5 (Accessibility) |
| Phase 6 (Operations) | Phase 4.7 (Dark mode) |
| Phase 7.3 (Billing) | Phase 5.1 (Frontend tests) |

## Total File Changes by Phase

| Phase | Files Created | Files Modified | Files Deleted |
|-------|--------------|----------------|---------------|
| 1 | 15 | 25 | 2 |
| 2 | 10 | 15 | 3 |
| 3 | 20 | 10 | 0 |
| 4 | 30 | 25 | 0 |
| 5 | 40 | 10 | 0 |
| 6 | 15 | 10 | 1 |
| 7 | 20 | 10 | 0 |
| 8 | 10 | 5 | 0 |
| **Total** | **160** | **110** | **6** |
