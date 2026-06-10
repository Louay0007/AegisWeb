# AegisWeb Security Audit

Audit date: 2026-06-10

Audit status: source-code review, configuration review, dependency audit, and threat-model pass. Updated after the 2026-06-10 remediation pass. This is not a penetration test and does not prove exploitability in a deployed environment, but it identifies concrete code-level risks and tracks which findings were remediated.

## Executive Summary

AegisWeb has the right security architecture direction for its product category: scoped agent identities, RBAC, encrypted credential vault, worker-scoped tokens, controlled browser runtime, approval gates, audit events, receipts, and production environment validation. Those are strong foundations.

The initial audit found one critical trust-boundary break: user-facing queue diagnostics exposed `workerRunToken`, which could be chained into the internal vault decrypt endpoint. That issue has been remediated by removing job `data` from user-facing diagnostics and adding regression coverage. The codebase is materially safer after the remediation pass, but it still needs full DB-backed regression verification against a migrated local database before real customer credentials are used.

Security readiness score:

| Area | Score | Target Before Pilot | Notes |
| --- | ---: | ---: | --- |
| Credential vault design | 4.0/5 | 4.5/5 | AES-GCM and scoped decrypt checks are in place; queue diagnostics no longer expose worker tokens. |
| Auth and session security | 3.8/5 | 4.0/5 | Atomic refresh consumption and spoof-resistant rate identity are implemented; JS-access token exposure remains. |
| Authorization and tenant isolation | 4.0/5 | 4.5/5 | Owner role management was hardened and cross-org coverage exists; full DB-backed regression run still required. |
| Worker/internal API boundary | 3.8/5 | 4.5/5 | User-facing token leak fixed; production worker/API transport still needs deployment-level TLS/mTLS enforcement. |
| Browser runtime safety | 3.8/5 | 4.5/5 | Request routing and private-network blocking are implemented with local sandbox escape hatch. |
| Evidence/files/receipts | 3.3/5 | 4.0/5 | Action metadata/redaction improved; MIME validation and artifact serving hardening remain. |
| Frontend security | 3.8/5 | 4.0/5 | Production localhost defaults removed and nonce CSP/security headers added. |
| Dependencies and supply chain | 3.5/5 | 4.0/5 | High-severity dependency audit gate passes; 2 moderate advisories remain. |
| Observability and incident readiness | 2.5/5 | 3.5/5 | Request IDs/audit exist, but security event coverage and alerting are incomplete. |
| Overall pilot readiness | 3.8/5 | 4.0/5 | Major P0/P1 code fixes are implemented; run DB-backed tests after migration before customer credentials. |

Highest priority fixes:

Remediated top fixes:

- Removed `workerRunToken` and all job `data` from user-facing queue diagnostics.
- Updated `next` and added a high-severity production audit gate.
- Hardened browser egress controls against private-network access by default.
- Replaced production rate limiting with Redis TTL counters and trusted-proxy-aware identity.
- Restricted owner-level role changes to owners only.
- Made refresh-token consumption atomic and added a unique `token_hash` migration.
- Fixed production web Docker config so it cannot bake `localhost` API URLs.
- Added nonce-based web CSP/security headers and removed `unsafe-eval`.
- Added secret-leakage and cross-organization coverage tests.

Remaining before pilot:

- Apply the new Prisma migration and rerun DB-backed security regression suites.
- Assess or override the remaining moderate advisories after confirming non-exploitability in this app.
- Decide whether to move browser access tokens behind a BFF/HttpOnly session model.

## Methodology

The audit used these security references and principles:

- OWASP Top 10: broken access control, cryptographic failures, injection, insecure design, misconfiguration, vulnerable components, authentication failures, data integrity, logging, SSRF.
- Zero-trust and least-privilege principles.
- Secure session and JWT guidance: short-lived access tokens, secure refresh tokens, rotation, revocation, trusted cookies, rate limiting.
- Cryptographic guidance: AES-GCM with random IVs, strong keys, KMS/secret manager preference, no weak passphrase derivation.
- Secure headers guidance: CSP, HSTS, frame protection, `nosniff`, referrer policy, permissions policy.
- STRIDE-style threat modeling: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.

Commands and inspections performed:

```bash
pnpm audit --prod
```

Manual review included:

- `apps/api/src/auth`
- `apps/api/src/authorization`
- `apps/api/src/request-context`
- `apps/api/src/rate-limit`
- `apps/api/src/security`
- `apps/api/src/credentials`
- `apps/api/src/queue`
- `apps/api/src/workflow-runs`
- `apps/api/src/internal-worker`
- `apps/api/src/files`
- `apps/api/src/receipts`
- `apps/api/src/notifications`
- `apps/worker/src`
- `libs/vault`
- `libs/browser-runtime`
- `libs/domain/src/worker-token.ts`
- `apps/web`
- `Dockerfile`
- `infra/docker-compose.yml`
- `.env.example`
- production runbook and project context docs

## Severity Model

| Severity | Meaning | Required Response |
| --- | --- | --- |
| P0 Critical | Direct credential exposure, tenant escape, remote code execution, or a complete trust-boundary break. | Fix immediately before any demo/pilot with real data. |
| P1 High | Likely exploitable vulnerability with meaningful account, credential, data, or service impact. | Fix before customer pilot. |
| P2 Medium | Important weakness, defense-in-depth failure, or misconfiguration likely to become serious in production. | Fix before production launch, preferably before pilot. |
| P3 Low | Hardening, governance, or hygiene improvement. | Schedule into normal security backlog. |

## System Assets

Critical assets:

- Vendor credentials and credential metadata.
- `VAULT_MASTER_KEY`, JWT secrets, `WORKER_INTERNAL_TOKEN`, S3 credentials, database credentials, Redis access.
- Refresh tokens and access tokens.
- Worker run tokens.
- Browser screenshots, invoices, files, traces, receipts, and audit events.
- Organization-scoped business records.
- Workflow queue job data and state.
- Approval decisions and audit hash chain.

Primary trust boundaries:

- Browser user to web app.
- Web app to public API.
- Public API to database, Redis, S3, SMTP.
- API to worker through Redis jobs.
- Worker to internal API endpoints.
- Worker to browser runtime and vendor websites.
- Browser runtime to external network.
- S3 signed URLs to object storage.

## Threat Model Summary

Relevant attacker profiles:

- Unauthenticated internet attacker attempting signup/login abuse or fixture/demo bypass.
- Authenticated low-privilege user attempting cross-organization access or privilege escalation.
- Authenticated user with read permissions attempting to extract internal tokens or secrets.
- Malicious or compromised vendor page attempting SSRF, browser escape, secret capture, or oversized downloads.
- Compromised frontend dependency or XSS attempting token theft.
- Compromised Redis/S3/worker host attempting lateral movement.
- Misconfigured production deployment accidentally exposing local/demo settings.

Highest-risk scenarios:

- A user with `WorkflowRead` retrieves a worker token and decrypts credentials.
- A malicious allowed vendor domain resolves to private network IPs and the worker browser accesses internal services.
- A production web build sends credentials/tokens to a user-local `localhost` API URL.
- Vulnerable Next.js middleware bypasses route protection.
- Secrets appear in receipts, audit payloads, worker metadata, screenshots, or email.

## Findings

### P0-001: Queue Diagnostics Leak Worker Tokens And Enable Vault Credential Exfiltration

Status: Remediated in code. User-facing queue diagnostics no longer include job `data`, and regression assertions were added in `tests/phase18-queue.spec.ts`. DB-backed verification must be rerun after applying migrations.

Severity: P0 Critical

OWASP mapping: A01 Broken Access Control, A02 Cryptographic Failures, A04 Insecure Design, A09 Logging and Monitoring Failures

Files:

- `apps/api/src/workflow-runs/workflow-runs.controller.ts:60-63`
- `apps/api/src/queue/workflow-queue.service.ts:77`, `apps/api/src/queue/workflow-queue.service.ts:95`, `apps/api/src/queue/workflow-queue.service.ts:114`
- `apps/api/src/queue/workflow-queue.service.ts:254-259`
- `apps/api/src/queue/workflow-queue.service.ts:262-274`
- `apps/api/src/queue/workflow-queue.types.ts:40-50`
- `apps/api/src/credentials/credentials.controller.ts:119-128`
- `apps/api/src/credentials/credentials.service.ts:263-335`
- `apps/api/src/workflows/workflows.types.ts:16`, `apps/api/src/workflows/workflows.types.ts:48`

Evidence:

- `POST /workflows/:id/runs` enqueues jobs with `workerRunToken` in `WorkflowQueueJobData`.
- `GET /workflow-runs/:id/queue` requires only `Permission.WorkflowRead` and returns queue diagnostics.
- Queue diagnostics include `data: job.data as Prisma.JsonValue`, which includes `workerRunToken`.
- Workflow DTOs return `configurationJson`, which can include `credentialId`.
- `POST /internal/vault/credentials/:id/decrypt-for-run` accepts `x-worker-token` and returns `secretJson` plaintext when the token is valid for the run and credential is granted.

Exploit chain:

1. Authenticate as any role with `WorkflowRead`, including `Approver`, `Auditor`, or `Developer` depending on permissions.
2. Call `GET /workflows/:id` and read `configurationJson.credentialId`.
3. Call `GET /workflow-runs/:id/queue` and extract `jobs.start.data.workerRunToken` or resume job token.
4. Call `POST /internal/vault/credentials/:credentialId/decrypt-for-run` with `x-worker-token` and body `{ "workflowRunId": "..." }`.
5. Receive plaintext vendor `secretJson`.

Impact:

- Complete compromise of vendor credentials for any workflow visible to the user.
- Breaks the core product claim that credentials are only available to the controlled worker runtime.
- Allows users who should only read workflow status to bypass credential permissions.

Root cause:

- Internal worker authorization tokens are stored in queue job data.
- Queue job data is returned through a user-facing diagnostics endpoint.
- The internal vault decrypt endpoint trusts the leaked token.

Remediation:

- Remove `data` from user-facing `WorkflowQueueJobDiagnostics` entirely, or return a strict allowlist of non-sensitive metadata.
- Never expose `workerRunToken`, `reason`, internal job payloads, worker claims, or credential IDs through diagnostics.
- Store worker tokens server-side by opaque job reference or mint them only inside the worker when it receives a job through a trusted channel.
- Shorten worker-token TTL and consider one-time use tokens for decrypt operations.
- Split queue diagnostics permissions into an admin-only permission and still redact secrets.
- Redact `configurationJson.credentialId` from workflow DTOs unless the user has `CredentialRead` and a legitimate need.

Required tests:

- A user with `WorkflowRead` cannot see `workerRunToken` in `/workflow-runs/:id/queue`.
- A user with `WorkflowRead` cannot call any `/internal/*` route even if they know a run ID.
- Workflow DTOs do not expose credential IDs to roles that cannot read credentials.
- Internal vault decrypt requires a non-exposed scoped token and fails with tokens from diagnostics.

### P1-001: Production Dependency Audit Reports High-Severity Next.js Vulnerabilities

Status: Remediated for high-severity advisories. `next` was upgraded and `pnpm audit --prod --audit-level high` passes. Two moderate advisories remain: `@hono/node-server` through Prisma dev tooling and `postcss` through Next.

Severity: P1 High

OWASP mapping: A06 Vulnerable and Outdated Components

Files:

- `apps/web/package.json:54`
- `pnpm-lock.yaml`
- `package.json:31-37`

Evidence:

- `pnpm audit --prod` reported 24 vulnerabilities: 9 high, 12 moderate, and 3 low.
- Affected package includes `next` at `16.0.10`.
- Reported high advisories include Middleware/Proxy bypasses, Server Components denial of service, WebSocket upgrade SSRF, and dynamic route parameter middleware bypass.
- Root `prod:check` runs typecheck, lint, and build, but no dependency vulnerability gate.

Impact:

- Middleware bypass vulnerabilities are especially relevant because the web app uses middleware to gate `/app/*`.
- SSRF and DoS advisories increase deployment risk for a self-hosted customer-facing dashboard.
- XSS/cache poisoning/moderate vulnerabilities amplify the impact of browser-accessible access tokens.

Remediation:

- Upgrade `next` to a patched version at or above the advisory requirements, currently `>=16.2.6` based on the audit output.
- Upgrade affected transitive packages such as `postcss` and `@hono/node-server` where applicable.
- Add a CI gate: `pnpm audit --prod` with a policy to block high and critical vulnerabilities.
- Add Dependabot or Renovate.
- Generate an SBOM during release.

Required tests:

- `pnpm audit --prod` passes with no high/critical vulnerabilities.
- Web build and dashboard smoke tests pass after dependency upgrades.

### P1-002: Auth Rate Limiting Is Bypassable Via Spoofed `X-Forwarded-For`

Status: Remediated in code. `X-Forwarded-For` is now trusted only when `request.ip`/remote address is listed in `API_TRUSTED_PROXIES`.

Severity: P1 High

OWASP mapping: A07 Identification and Authentication Failures

Files:

- `apps/api/src/rate-limit/rate-limit.middleware.ts:46`
- `apps/api/src/rate-limit/rate-limit.middleware.ts:77-80`
- `apps/api/src/main.ts:15-27`

Evidence:

- Rate limit key uses `clientKey(request)`.
- `clientKey` trusts `x-forwarded-for` directly before `request.ip`.
- There is no trusted proxy allowlist or reverse-proxy configuration in `main.ts`.

Impact:

- Attackers can rotate the `X-Forwarded-For` header to bypass auth throttling.
- Enables credential stuffing, registration abuse, refresh abuse, and API probing.

Remediation:

- Only trust forwarded IP headers from known reverse proxies.
- Use `request.ip` by default.
- Add Redis-backed distributed rate limiting.
- Add per-email/login identifier throttling in addition to IP throttling.
- Add progressive delays or lockouts for repeated failed login attempts.

Required tests:

- Repeated failed login attempts with changing `X-Forwarded-For` still hit the same limit when not behind a trusted proxy.
- Trusted proxy mode only honors forwarded headers from configured proxy IPs.

### P1-003: Admins Can Create, Promote, Or Disable Owner-Level Users

Status: Remediated in code. Admins can no longer invite owners, assign owner role, or manage owner users. Regression tests were added to `tests/phase8-organization-users.spec.ts`.

Severity: P1 High

OWASP mapping: A01 Broken Access Control, Elevation of Privilege

Files:

- `apps/api/src/users/users.controller.ts:38-64`
- `apps/api/src/users/users.service.ts:45-54`
- `apps/api/src/users/users.service.ts:75-83`
- `apps/api/src/users/users.service.ts:110-116`

Evidence:

- User invite, role change, and disable endpoints allow `Owner` or `Admin`.
- `inviteUser` accepts any role from `USER_ROLES` and writes it directly.
- `changeUserRole` only blocks changing self to owner, not admin promoting another user to owner.
- `disableUser` only prevents disabling the last owner.

Impact:

- Admins can create a new owner or promote an accomplice to owner.
- Admins can disable or demote owners when at least one owner remains.
- Weakens owner-only organization authority.

Remediation:

- Only owners may invite, promote, demote, or disable owner-role users.
- Admins may manage non-owner roles only.
- Prevent admins from assigning `Owner` on invite or role change.
- Add explicit service-level checks, not only controller decorators.

Required tests:

- Admin cannot invite owner.
- Admin cannot promote any user to owner.
- Admin cannot disable or demote an owner.
- Owner can perform permitted owner management while last-owner protection still holds.

### P1-004: Refresh Token Rotation Is Non-Atomic And Raceable

Status: Remediated in code and schema. Refresh-token consumption now uses a transaction and conditional update; `tokenHash` is unique in Prisma schema and migration `20260610120000_atomic_refresh_token_hash`.

Severity: P1 High

OWASP mapping: A07 Identification and Authentication Failures

Files:

- `apps/api/src/auth/refresh-token.service.ts:34-46`
- `apps/api/src/auth/refresh-token.service.ts:49-58`
- `apps/api/src/auth/auth.service.ts:114-133`
- `prisma/schema.prisma:592-606`

Evidence:

- `consume()` reads token row with `findFirst`, checks `revokedAt`, then revokes in a separate query.
- `auth.refresh()` issues a new token after `consume()` returns.
- Schema does not define a unique constraint on `tokenHash`.

Impact:

- Concurrent refresh requests can both pass validation and mint multiple replacement refresh tokens.
- Enables session cloning if an attacker obtains a refresh token.

Remediation:

- Add a unique index on `refresh_tokens.token_hash`.
- Consume refresh tokens atomically in a transaction or conditional update where `tokenHash`, `revokedAt: null`, and `expiresAt > now` must match.
- Require exactly one affected row before issuing a replacement token.
- Add refresh-token family reuse detection and revoke the family on reuse.

Required tests:

- Two concurrent refresh calls with the same token result in exactly one success.
- Reuse of an already-consumed refresh token is logged and denied.

### P1-005: Production Web Image Can Send Tokens To `localhost` In The End User Browser

Status: Remediated in code. Production web Docker builds now require an HTTPS `NEXT_PUBLIC_API_URL` and no longer set `NEXT_PUBLIC_ALLOW_LOCAL_API_URL=true`.

Severity: P1 High

OWASP mapping: A05 Security Misconfiguration

Files:

- `Dockerfile:44-48`
- `infra/docker-compose.yml:164-174`
- `apps/web/lib/runtime-config.ts:41-48`
- `docs/production-runbook.md:42-45`

Evidence:

- `runtime-config.ts` rejects localhost API URLs in production unless `NEXT_PUBLIC_ALLOW_LOCAL_API_URL=true`.
- The root production web target sets `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_ALLOW_LOCAL_API_URL=true`.
- Compose app profile builds and runs web with the same production localhost settings.
- The production runbook correctly says `NEXT_PUBLIC_API_URL=https://api.<domain>`.

Impact:

- A real production frontend bundle can send login credentials and bearer tokens to `http://localhost:3001` from the user’s browser, not the server container.
- If a local process is listening on the user’s machine, it can receive requests.
- Otherwise production breaks and encourages insecure overrides.

Remediation:

- Remove localhost API defaults from production Docker targets.
- Remove `NEXT_PUBLIC_ALLOW_LOCAL_API_URL=true` from production web stages.
- Fail the web build if `NODE_ENV=production` and `NEXT_PUBLIC_API_URL` is missing or non-HTTPS.
- Use separate dev-only compose profiles for localhost API.

Required tests:

- Production web build fails with localhost `NEXT_PUBLIC_API_URL` unless explicitly using a dev target.
- Production compose profile cannot set local API URLs.

### P1-006: Worker Internal API Can Transmit Worker Tokens And Plaintext Credentials Over Non-TLS HTTP

Severity: P1 High

OWASP mapping: A02 Cryptographic Failures, A05 Security Misconfiguration

Files:

- `apps/worker/src/config/worker-config.service.ts:85-103`
- `apps/worker/src/config/worker-config.service.ts:92`
- `apps/worker/src/internal-api/internal-api-client.service.ts:145-152`
- `apps/worker/src/internal-api/internal-api-client.service.ts:162-169`

Evidence:

- Worker defaults `apiBaseUrl` to `http://localhost:${API_PORT}`.
- No production check requires HTTPS or a trusted internal transport.
- Internal API client sends `x-worker-token` and receives plaintext `secretJson` from vault decrypt calls.

Impact:

- If API and worker communicate over a network using HTTP, worker tokens and plaintext credentials can be intercepted or modified.

Remediation:

- Require HTTPS, mTLS, service mesh identity, or a same-host Unix socket for production worker-to-API traffic.
- Fail worker boot in production if `API_BASE_URL` is not HTTPS or an explicitly approved local-only transport.
- Avoid returning plaintext credentials over network boundaries where possible; consider worker-side KMS/decrypt or a vault sidecar.

Required tests:

- Worker config validation fails in production for `http://` API URLs.
- Internal API calls require TLS in production configuration tests.

### P1-007: Browser Runtime Allows Private-Network SSRF And DNS-Rebinding Paths

Status: Remediated in code for default browser runtime behavior. Playwright request routing checks destinations, DNS/private IP resolution is blocked by default, and local sandbox use must opt in with `allowPrivateNetwork`.

Severity: P1 High

OWASP mapping: A10 Server-Side Request Forgery, A04 Insecure Design

Files:

- `libs/browser-runtime/src/index.ts:122-128`
- `libs/browser-runtime/src/index.ts:339-349`
- `apps/worker/src/workflow-executor/workflow-executor.service.ts:901-906`
- `apps/api/src/policies/policy-validation.service.ts:164-181`

Evidence:

- Browser runtime allowlist checks only URL hostname string.
- Policy validation explicitly allows `localhost`.
- No DNS resolution, IP range filtering, cloud metadata blocking, or egress firewall rules are present in code.

Impact:

- A malicious configured vendor domain or DNS rebinding attack can cause the worker browser to access private services, metadata endpoints, localhost, Redis, internal APIs, or cloud metadata.
- Browser automation can become an SSRF primitive.

Remediation:

- In production, reject `localhost`, loopback, private, link-local, multicast, reserved, and cloud metadata IP ranges after DNS resolution.
- Pin resolved IPs per navigation where feasible.
- Use Playwright request routing to block disallowed network destinations, not just top-level navigation.
- Enforce worker egress firewall rules at infrastructure level.
- Add a separate explicit dev allowlist for local sandbox only.

Required tests:

- Allowed domain resolving to `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, or `::1` is blocked in production mode.
- Redirects, iframes, popups, downloads, and subresources cannot reach private networks.

### P2-001: Request Context Trusts Client-Supplied Identity And Organization Headers

Severity: P2 Medium

OWASP mapping: A01 Broken Access Control, Spoofing

Files:

- `apps/api/src/request-context/request-context.middleware.ts:13-21`
- `apps/api/src/request-context/current-user.decorator.ts:7-15`
- `apps/api/src/request-context/current-organization-id.decorator.ts:7-10`
- `apps/api/src/authorization/jwt-auth.guard.ts:21-22`
- `apps/api/src/authorization/jwt-auth.guard.ts:63-68`

Evidence:

- Middleware reads `x-user-id`, `x-organization-id`, and `x-user-role` from request headers into context.
- JWT guard overwrites context for protected user routes, but public/internal/future code paths can still see spoofed values.

Impact:

- Future routes or internal logic may accidentally trust unverified identity or organization headers.
- Public or internal routes can receive spoofed context before verification.

Remediation:

- Remove user and organization identity from public request headers.
- Set context only from verified JWT or verified worker-token claims.
- If gateway identity headers are needed, accept them only from trusted internal proxy networks and authenticate them.

### P2-002: Login And Registration Enable Enumeration

Severity: P2 Medium

OWASP mapping: A07 Identification and Authentication Failures

Files:

- `apps/api/src/auth/auth.service.ts:30-43`
- `apps/api/src/auth/auth.service.ts:78-96`

Evidence:

- Registration returns distinct errors for duplicate organization domain and duplicate email.
- Login skips Argon2 verification when the user does not exist, causing a timing difference.

Impact:

- Attackers can discover valid emails and organization domains.
- Helps targeted phishing and password attacks.

Remediation:

- Use generic signup responses and email verification where feasible.
- Perform dummy Argon2 verification for missing users.
- Rate limit by email and IP.

### P2-003: Rate Limiter Is In-Memory, Per-Process, And Potentially Unbounded

Status: Remediated for production. `RateLimitMiddleware` uses Redis TTL counters when `NODE_ENV=production`; in-memory limiting remains only for local/test fallback.

Severity: P2 Medium

OWASP mapping: A07 Identification and Authentication Failures, Denial of Service

Files:

- `apps/api/src/rate-limit/rate-limit.middleware.ts:15`
- `apps/api/src/rate-limit/rate-limit.middleware.ts:46-64`
- `apps/api/src/rate-limit/rate-limit.middleware.ts:70-74`

Evidence:

- Rate limit buckets are stored in a process-local `Map`.
- Limits reset per API instance.
- Keys include raw path and are not proactively evicted.

Impact:

- Horizontal scaling bypasses limits.
- High-cardinality paths can increase memory usage.

Remediation:

- Use Redis with TTLs for shared limits.
- Normalize route templates before keying.
- Add cleanup and global caps.

### P2-004: Vault Accepts Passphrase-Style Master Keys With Unsalted SHA-256 Derivation

Severity: P2 Medium

OWASP mapping: A02 Cryptographic Failures

Files:

- `libs/vault/src/index.ts:107-130`
- `apps/api/src/config/config.service.ts:134-142`
- `apps/api/src/config/config.service.ts:171-178`

Evidence:

- A non-base64 string of length at least 32 is accepted as a master key.
- Such strings are converted to an AES key by `sha256(masterKey)`.
- Production config checks length and obvious local prefixes, not entropy.

Impact:

- If encrypted credential rows are exfiltrated and the master key is human-generated, offline brute forcing is easier than with a random 32-byte key or KMS.

Remediation:

- Require base64-encoded 32 random bytes in production.
- Prefer KMS/HSM envelope encryption.
- If passphrases remain supported, use Argon2id/scrypt with versioned salt and migration.

### P2-005: Worker Metadata And Receipts Can Expose Credential-Adjacent Or Raw Vendor Data

Severity: P2 Medium

OWASP mapping: A02 Cryptographic Failures, A09 Logging and Monitoring Failures

Files:

- `apps/worker/src/connector/sandbox-vendor.connector.ts:40-43`
- `apps/worker/src/connector/sandbox-vendor.connector.ts:216-218`
- `apps/worker/src/connector/sandbox-vendor.connector.ts:225-227`
- `apps/api/src/receipts/receipt-redaction.service.ts:3`
- `apps/api/src/receipts/receipt-redaction.service.ts:19-21`
- `apps/api/src/receipts/receipts.service.ts:176-179`

Evidence:

- Connector stores username in metadata for credential injection attempts.
- Connector stores raw `responseText` after downgrade submission.
- Receipt redaction is key-name based and does not redact keys like `username` or `responseText`.

Impact:

- Users with receipt or workflow read access may see usernames, raw page responses, PII, session details, or tokens if a vendor response changes.

Remediation:

- Do not persist credential usernames or raw response bodies.
- Use allowlisted metadata schemas per action type.
- Extend redaction to sensitive value patterns and additional keys.
- Add tests for action, receipt, audit, and email redaction.

### P2-006: Browser Screenshots And Downloads Need Stronger Redaction And Size Controls

Severity: P2 Medium

OWASP mapping: A02 Cryptographic Failures, Denial of Service

Files:

- `libs/browser-runtime/src/index.ts:154-166`
- `libs/browser-runtime/src/index.ts:185-193`
- `libs/browser-runtime/src/index.ts:261-268`
- `libs/browser-runtime/src/index.ts:281-302`
- `apps/worker/src/workflow-executor/workflow-executor.service.ts:942-960`
- `apps/api/src/internal-worker/internal-worker.service.ts:295-310`

Evidence:

- Screenshot masking only targets password inputs and `data-agentpass-secret` fields.
- Downloads are saved and read into memory before upload API size checks reject them.
- Invoice/screenshot upload reads full files into memory and encodes base64.

Impact:

- Screenshots can capture sensitive account data outside password fields.
- Allowed vendor pages can trigger large downloads that exhaust disk or memory before API quotas apply.

Remediation:

- Add browser download size limits using `Content-Length` and streaming caps.
- Avoid full-buffer base64 upload for large artifacts; stream uploads where possible.
- Redact or crop screenshots to approved regions.
- Mark all credential-related fields, including username, as sensitive where appropriate.
- Add screenshot redaction tests.

### P2-007: File Storage Trusts Declared MIME Type And Relies On External Bucket Security

Severity: P2 Medium

OWASP mapping: A05 Security Misconfiguration, A08 Software and Data Integrity Failures

Files:

- `apps/api/src/internal-worker/internal-worker.service.ts:317-329`
- `apps/api/src/files/file-storage.service.ts:60-69`
- `apps/api/src/files/file-storage.service.ts:102-116`
- `apps/api/src/files/files.controller.ts:17-25`

Evidence:

- MIME allowlist checks the caller-provided `mimeType` string.
- `PutObjectCommand` does not set server-side encryption, KMS key, object lock, ACL, or forced content disposition.
- `GET /files/:id` returns a signed read URL.

Impact:

- Malicious or mislabeled artifacts can be stored and served via signed URL.
- Object encryption and privacy are left to external bucket configuration.

Remediation:

- Validate file magic bytes and expected file structure.
- Add malware scanning for untrusted downloads before customer use.
- Set server-side encryption/KMS where supported.
- Force private bucket policy.
- Prefer authenticated proxy download for sensitive artifacts over signed URLs.
- If signed URLs remain, use very short TTLs and safe response headers.

### P2-008: `/app/*` Middleware Uses An Unsigned JavaScript-Writable Marker Cookie

Severity: P2 Medium

OWASP mapping: A01 Broken Access Control

Files:

- `apps/web/middleware.ts:12-19`
- `apps/web/lib/auth/token-storage.ts:70-80`
- `apps/web/components/app-shell/app-shell.tsx:30-44`

Evidence:

- Middleware redirects based only on presence of `aegisweb_session`.
- The cookie is written by client-side JavaScript and is not `HttpOnly` or signed.
- API still enforces auth, but page route protection is weak.

Impact:

- Any user can set the marker cookie and reach protected routes.
- Future SSR/server-rendered data could leak if developers trust middleware.
- Risk increases if fixture fallback or demo mode is misconfigured.

Remediation:

- Treat marker cookie as UX-only, not access control.
- Use a server-issued signed `HttpOnly; Secure; SameSite` session marker if middleware gating is required.
- Validate session server-side before rendering protected server components.

### P2-009: Access Tokens And Session Material Are Available To Browser JavaScript

Severity: P2 Medium

OWASP mapping: A07 Identification and Authentication Failures, A05 Security Misconfiguration

Files:

- `apps/web/lib/auth/token-storage.ts:20-34`
- `apps/web/lib/auth/token-storage.ts:55-56`
- `apps/web/lib/auth/token-storage.ts:91-103`
- `apps/web/lib/auth/auth-session.tsx:158-180`

Evidence:

- Production access tokens are stored on `globalThis.__aegiswebAccessToken`.
- Non-production access tokens are stored in `localStorage`.
- Legacy session/user data is persisted in `localStorage`.

Impact:

- XSS or malicious dependencies can read access tokens in production memory.
- Non-production local storage tokens are persistent and easy to steal.

Remediation:

- Prefer backend-for-frontend or `HttpOnly` cookie session model.
- If bearer tokens remain in JS, keep TTL short, enforce strong CSP, and remove legacy localStorage session persistence in production.
- Consider refresh-token-only cookie plus server API proxy.

### P2-010: Web App Lacks Production Security Headers And CSP

Status: Remediated in code. Web middleware now emits CSP, HSTS, frame protection, `nosniff`, referrer policy, and permissions policy. CSP removed `unsafe-eval` and uses per-response script nonces.

Severity: P2 Medium

OWASP mapping: A05 Security Misconfiguration, A03 Injection/XSS Defense

Files:

- `apps/web/next.config.mjs:8-15`

Evidence:

- Next config has no `headers()` security header configuration.
- No CSP, HSTS, frame protection, `nosniff`, referrer policy, or permissions policy is defined at app level.

Impact:

- XSS impact is higher because JS can access tokens.
- Clickjacking and content-type sniffing protections depend on upstream infrastructure.

Remediation:

- Add hardened headers in `next.config.mjs` or the deployment edge.
- Recommended minimum: CSP, `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and disabled `X-Powered-By`.
- Start CSP in report-only if needed, then enforce.

### P2-011: Demo Registration Fallback Can Create Demo Session Without Password Validation

Severity: P2 Medium

OWASP mapping: A05 Security Misconfiguration, A07 Identification and Authentication Failures

Files:

- `apps/web/components/auth/register-form.tsx:128-133`
- `apps/web/components/auth/auth-client.ts:38-69`
- `apps/web/components/auth/auth-client.ts:86-116`
- `apps/web/lib/runtime-config.ts:24-31`

Evidence:

- If API registration fails and demo mode is enabled, registration calls `demoSessionFor(email)`.
- `demoSessionFor` only checks email membership; it does not verify the demo password.

Impact:

- If demo mode is enabled in a deployed environment, known demo emails can create demo sessions without password verification.

Remediation:

- Remove demo fallback from registration.
- Put demo mode behind a separate dev-only build/deployment.
- Require demo password for all demo entry paths.
- Fail production builds when demo mode is enabled.

### P2-012: Fixture Fallback Can Serve Operational-Looking Data To Unauthenticated States

Severity: P2 Medium

OWASP mapping: A01 Broken Access Control, A05 Security Misconfiguration

Files:

- `apps/web/lib/data-layer/resource-hooks.ts:89-99`
- `apps/web/lib/data-layer/resource-hooks.ts:107-115`
- `apps/web/lib/fixtures/dashboard.ts:440-441`

Evidence:

- Fixture mode is enabled for `demo` and `unauthenticated` states when fixture fallback is enabled.
- `findById` returns the first item if no item matches.

Impact:

- Misconfigured production can show fake operational data to unauthenticated users.
- Invalid detail URLs can display misleading fixture data.

Remediation:

- Never enable fixture fallback for unauthenticated users outside local development.
- Make detail lookups return not found, not first fixture item.
- Add CI checks blocking `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=true` in production builds.

### P2-013: Client-Side Audit Payload Redaction Is Shallow

Severity: P2 Medium

OWASP mapping: A02 Cryptographic Failures, A09 Logging and Monitoring Failures

Files:

- `apps/web/lib/format/formatters.ts:18-23`
- `apps/web/components/evidence/audit-event-drawer.tsx:111-113`
- `apps/web/components/dashboard/list-pages.tsx:1450-1459`

Evidence:

- Frontend redaction only handles top-level keys.
- Drawer renders `JSON.stringify(redacted)`.
- Audit search indexes `JSON.stringify(event.payload)` directly.

Impact:

- Nested secrets can be displayed or searched client-side.

Remediation:

- Use recursive server-side redaction before audit events reach the UI.
- Search only redacted allowlisted fields.
- Add nested secret and value-pattern tests.

### P2-014: Compose Exposes Stateful Services With Default Credentials

Severity: P2 Medium

OWASP mapping: A05 Security Misconfiguration

Files:

- `infra/docker-compose.yml:3-10`
- `infra/docker-compose.yml:19-23`
- `infra/docker-compose.yml:32-41`
- `infra/docker-compose.yml:50-55`
- `infra/docker-compose.yml:74-89`
- `.env.example:11-17`
- `.env.example:22-23`
- `.env.example:31`

Evidence:

- Postgres, Redis, MinIO, and Mailpit bind to host ports.
- Default passwords and tokens are predictable.
- Redis has no password in compose.

Impact:

- On shared developer hosts or mistakenly exposed infrastructure, services can be accessed with known credentials.

Remediation:

- Bind dev services to `127.0.0.1` where possible.
- Clearly mark compose as dev-only.
- Generate local secrets.
- Use Redis auth/TLS and platform secret injection outside local dev.

### P3-001: Error Responses Can Expose Internal Details Outside Production

Severity: P3 Low

OWASP mapping: A05 Security Misconfiguration

Files:

- `apps/api/src/errors/domain-exception.filter.ts:28-32`
- `apps/api/src/errors/domain-exception.filter.ts:48-55`
- `apps/api/src/errors/domain-exception.filter.ts:71-80`

Impact:

- Misconfigured non-production environments can leak exception messages and details to users.

Remediation:

- Return stable public error codes/messages for all deployed environments.
- Log sensitive details server-side only.
- Redact DomainError details by allowlist.

### P3-002: Token And Session Hardening Gaps

Severity: P3 Low

OWASP mapping: A07 Identification and Authentication Failures

Files:

- `apps/api/src/auth/token.service.ts:37-56`
- `apps/api/src/auth/token.service.ts:59-70`
- `apps/api/src/auth/auth.service.ts:136-153`
- `apps/api/src/auth/refresh-token.service.ts:61-62`

Evidence:

- Access tokens are not denylisted on logout.
- JWT verification does not reject extra segments explicitly and does not validate decoded header `alg` or `typ`.
- Refresh tokens are hashed with plain SHA-256 even though `JWT_REFRESH_SECRET` exists.

Remediation:

- Strictly parse JWTs and validate header fields.
- Add issuer/audience claims.
- Consider session versioning or access-token denylist for logout/high-risk events.
- HMAC refresh-token hashes with a server-side secret.

### P3-003: API Security Headers Are Incomplete

Severity: P3 Low

OWASP mapping: A05 Security Misconfiguration

Files:

- `apps/api/src/security/security-headers.middleware.ts:8-14`

Evidence:

- API sets `nosniff`, `DENY`, referrer policy, and permissions policy.
- It does not set HSTS.

Remediation:

- Add HSTS in production at the TLS terminator or API layer.
- Consider Helmet or equivalent explicit security header middleware.

### P3-004: Worker Audit Path Bypasses API Audit Redaction And Locking

Severity: P3 Low

OWASP mapping: A09 Logging and Monitoring Failures, A08 Data Integrity Failures

Files:

- `apps/worker/src/audit/worker-audit.service.ts:18-51`
- `apps/api/src/audit/audit.service.ts:19-27`
- `apps/api/src/audit/audit.service.ts:60-77`

Evidence:

- Worker writes audit events directly to Prisma with raw `eventDataJson`.
- API audit service redacts payload and serializes per-organization writes with an in-memory lock.

Impact:

- Worker-originated events can store unredacted payloads if future worker code passes secrets.
- Concurrent workers can race the hash chain.

Remediation:

- Route worker audit through internal API audit service or share the same redaction and locking implementation.
- Add secret regression tests for worker audit events.

### P3-005: SMTP Adapter Lacks TLS/Auth And Broad Header Sanitization

Severity: P3 Low

OWASP mapping: A02 Cryptographic Failures, A03 Injection

Files:

- `apps/api/src/notifications/email-notification.adapter.ts:15-23`
- `apps/api/src/notifications/email-notification.adapter.ts:37-45`
- `apps/api/src/notifications/email-notification.adapter.ts:67-82`

Evidence:

- SMTP uses raw `node:net` with no STARTTLS or auth.
- Subject newlines are folded, but names/emails/from are interpolated into SMTP commands and headers.

Impact:

- Plaintext SMTP in production would expose approval details.
- CRLF injection may be possible if upstream validation fails.

Remediation:

- Use a maintained SMTP library with STARTTLS/auth.
- Strictly validate email addresses and reject CRLF in all header and command values.
- Encode display names properly.

### P3-006: File And Receipt DTOs Disclose Bucket And Object Keys

Severity: P3 Low

OWASP mapping: A05 Security Misconfiguration, Information Disclosure

Files:

- `apps/api/src/files/files.types.ts:23-34`
- `apps/api/src/files/files.types.ts:41-53`
- `apps/api/src/receipts/receipts.service.ts:176-179`

Impact:

- Users learn storage bucket names, object path structure, and sometimes organization/run IDs embedded in paths.
- Increases blast radius if storage credentials or signed URLs leak.

Remediation:

- Return file IDs, kind, size, hash, and created time only.
- Keep bucket and object key server-side.
- Redact object paths from receipts/exports.

### P3-007: Runtime Images Run As Root And Include Broad Build Surface

Severity: P3 Low

OWASP mapping: A05 Security Misconfiguration, A06 Vulnerable Components

Files:

- `Dockerfile:9-13`
- `Dockerfile:42-50`

Evidence:

- Dockerfile copies full `apps`, `libs`, and `prisma` into base image.
- Installs non-production dependencies.
- Final web stage does not set a non-root `USER`.

Impact:

- Larger attack surface and higher container compromise blast radius.

Remediation:

- Use pruned production dependencies or Next standalone output.
- Run as non-root.
- Use read-only filesystem where possible.
- Scan container images in CI.

## Strengths

- Passwords are hashed with Argon2id with reasonable memory/time parameters in `apps/api/src/auth/password.service.ts`.
- Refresh cookies are `HttpOnly`, path-scoped, `SameSite=Lax`, and `Secure` in production in `apps/api/src/auth/auth.controller.ts`.
- Refresh/logout include trusted origin checks in `apps/api/src/auth/auth.controller.ts`.
- Production API config rejects weak local secrets, non-HTTPS dashboard URLs, non-HTTPS origins, local production dependencies, and public OpenAPI in `apps/api/src/config/config.service.ts`.
- Global JWT and authorization guards are registered through the API authorization module.
- Credential decrypt checks workflow organization, vendor match, non-revoked credential, and active grant before decrypting.
- Vault encryption uses AES-256-GCM with random 96-bit IVs and optional AAD binding.
- Worker run tokens are HMAC-signed, scoped to organization/run, expiring, and timing-safe compared.
- Browser runtime enforces top-level navigation allowlists and popup blocking.
- Browser runtime masks password and secret-marked fields before screenshots.
- File downloads verify stored SHA-256 before serving.
- Worker uploads have per-file, per-run, and per-organization quota checks.
- Approval decisions verify pending/non-expired state and organization before resume.
- Receipt and audit services already perform recursive key-based redaction on backend paths.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, logs, and test artifacts.
- Production runbook correctly calls out no baked secrets, no demo mode, no fixture fallback, cross-site refresh/logout rejection, and public OpenAPI rejection.

## OWASP Top 10 Coverage

| OWASP Area | Current Status | Key Gaps |
| --- | --- | --- |
| A01 Broken Access Control | Improved | Queue token leak and admin-owner escalation are remediated; unsigned frontend marker remains a UX-only weak gate. |
| A02 Cryptographic Failures | Partial | HTTP internal API risk, passphrase SHA-256 key derivation, JS token exposure, artifact encryption reliance. |
| A03 Injection | Mostly okay | SMTP header/command composition needs strict sanitization; frontend audit JSON display relies on redaction. |
| A04 Insecure Design | Improved | Worker-token diagnostics leak is remediated; browser private-network blocking is implemented by default. |
| A05 Misconfiguration | Improved | Production web localhost bypass and missing web CSP/HSTS are remediated; dev compose remains dev-only with default credentials. |
| A06 Vulnerable Components | Improved | High-severity audit gate passes; 2 moderate advisories remain. |
| A07 Auth Failures | Improved | Rate-limit spoofing and refresh race are remediated; account enumeration and no MFA/step-up remain. |
| A08 Data Integrity Failures | Partial | Worker audit bypasses API redaction/locking; file MIME based on declared type. |
| A09 Logging Failures | Partial | Security events exist, but secret leakage tests and alerting are missing. |
| A10 SSRF | Improved | Browser runtime now blocks private-network destinations by default; infrastructure egress firewalling is still recommended. |

## Remediation Status

### Completed In 2026-06-10 Remediation Pass

- Fixed P0-001 by removing `data` from queue diagnostics.
- Added regression tests proving queue diagnostics never include `workerRunToken`.
- Upgraded `next` and added `pnpm audit --prod --audit-level high` to `prod:check`.
- Removed production localhost API defaults from Docker/compose.
- Replaced production rate limiting with Redis-backed TTL counters.
- Hardened owner role management.
- Made refresh-token consumption atomic and added unique `tokenHash` migration.
- Added nonce-based CSP/security headers to web middleware and removed `unsafe-eval`.
- Implemented browser runtime private-network blocking by default.

### Still Recommended Before Pilot

- Add production worker config validation for HTTPS internal API.
- Remove registration demo fallback and fixture fallback for unauthenticated states.
- Validate file magic bytes and force safe artifact serving behavior.
- Move worker audit writes through API audit service or shared redaction/hash-chain implementation.
- Harden production container images and run as non-root.
- Add CI security gates for dependency audit, secret scan, and production config checks.
- Apply migrations and rerun DB-backed security regression suites.

## Required Security Test Plan

P0/P1 regression tests:

- Queue diagnostics redaction test: no `workerRunToken`, `x-worker-token`, `secretJson`, `credentialId`, or internal job payloads.
- Credential exfiltration test: `WorkflowRead` user cannot derive vault plaintext through any public route.
- Admin escalation test: admin cannot invite/promote/disable owners.
- Refresh race test: concurrent refresh token use yields exactly one valid replacement.
- Rate limit spoof test: changing `X-Forwarded-For` does not bypass limits outside trusted proxy mode.
- Production web config test: localhost API and `NEXT_PUBLIC_ALLOW_LOCAL_API_URL=true` fail production builds.
- Dependency test: `pnpm audit --prod` fails CI on high/critical vulnerabilities.

P2 hardening tests:

- Cross-organization tests for agents, vendors, policies, credentials, workflows, runs, approvals, receipts, files, and audit events.
- SSRF tests for private IPs, loopback, metadata endpoints, redirects, iframes, popups, subresources, and downloads.
- Secret redaction tests for nested objects, arrays, URLs, headers, usernames, tokens, cookies, and raw response bodies.
- Screenshot tests proving password/credential fields are masked before storage.
- File tests verifying MIME magic bytes, size limits, object hash verification, and safe content disposition.
- Demo/fixture production tests proving fixture fallback and demo auth cannot activate in production.

## Pilot Gate Checklist

Do not run real customer credentials until every item below is true:

- All P0 and P1 findings are fixed.
- `pnpm audit --prod` has no high or critical vulnerabilities.
- Queue diagnostics cannot leak worker job payloads.
- Internal vault decrypt cannot be called using any token returned by a user-facing endpoint.
- Browser runtime blocks private-network and metadata endpoint access in production.
- Production web bundle cannot point to localhost API.
- Demo mode and fixture fallback are impossible in production.
- Cross-organization access tests pass.
- Secret-leakage tests pass across API, worker, UI, receipts, audit, files, and email.
- Production deployment uses HTTPS for web/API and trusted internal transport for worker/API.
- S3/MinIO bucket is private, encrypted, and accessed through authorized paths only.
- Security headers are present on web and API responses.
- Rate limiting is distributed and spoof-resistant.
- Incident response owner and token rotation process are documented.

## Recommended Security Backlog

P0/P1 backlog:

- Apply migrations and rerun DB-backed security regression suites.
- Resolve or formally accept remaining moderate dependency advisories.
- Worker internal HTTPS/mTLS requirement.

P2 backlog:

- Strict artifact MIME/magic validation.
- Remove unauthenticated fixture fallback.
- Remove registration demo fallback.
- Signed server session marker or BFF session model.
- KMS/envelope encryption for credentials.
- Worker audit redaction/hash-chain unification.

P3 backlog:

- Access-token denylist or session versioning.
- HMAC refresh-token hashes.
- SMTP library with STARTTLS/auth.
- File DTO object-key redaction.
- Non-root production containers.
- SBOM, license policy, image scanning, and secret scanning in CI.
- MFA/step-up auth for owner/admin and approval decisions.

## Final Assessment

AegisWeb is architecturally promising but security-sensitive by nature. Because the product handles credentials, browser automation, approvals, screenshots, receipts, and audit artifacts, the security bar must be higher than a normal SaaS dashboard.

The current codebase is significantly closer to pilot readiness after the remediation pass. The original P0 queue-token leak and the main P1 code-level blockers have been remediated. The remaining decision points are operational and verification-heavy: apply migrations, rerun DB-backed security regression suites, assess the two moderate dependency advisories, harden artifact handling, and decide whether to move browser token handling behind a BFF/HttpOnly session model.

Once DB-backed tests pass on the migrated schema and the residual advisories are accepted or resolved, AegisWeb will have a credible security foundation for design-partner pilots.
