# AgentPass Technical Conception

Generated: 2026-06-06

Repository: `AegisWeb`

Product name: `AgentPass`

## 1. Objective

AgentPass is a local-first development project for building the identity, permission, approval, credential, browser-runtime, and audit layer for AI agents that take actions on the web.

The first product wedge is narrow and practical:

> Safely let an AI procurement agent manage SaaS invoices and renewals without giving it unrestricted passwords, payment authority, or silent destructive power.

This document defines the complete technical conception for a free, local development environment, with Angular as the frontend.

## 2. Non-Negotiable Constraints

- Frontend must be Angular.
- Development must be runnable locally without paid services.
- All core infrastructure must be free or open source for development.
- The MVP must be demoable without real vendor credentials.
- Credentials must never be exposed to the LLM or browser agent planner.
- Every important browser action must produce an audit event.
- Risky actions must pause for human approval.
- The system must be designed as infrastructure later, but built as a narrow SaaS-renewal workflow first.

## 3. Recommended Stack

### 3.1 Monorepo

Use an Nx-style TypeScript monorepo.

Reason:

- Angular frontend, NestJS backend, worker, shared types, and test utilities can live together.
- Shared build/test/lint commands reduce setup pain.
- It supports a modular architecture without forcing microservices too early.

Package manager:

- `pnpm`

Why:

- Fast installs.
- Good workspace support.
- Disk-efficient local development.

### 3.2 Frontend

Use:

- Angular
- Angular standalone components
- Angular Router with lazy feature routes
- Angular Signals for local UI state
- RxJS for streams, long polling, websocket events, and HTTP composition
- Angular Material/CDK for accessible enterprise UI primitives
- SCSS design tokens
- `lucide-angular` for icons
- Playwright for E2E tests

Avoid for MVP:

- SSR
- microfrontends
- heavy animation frameworks
- complex global state libraries

The dashboard is an operational tool, not a landing page. It should feel dense, calm, inspectable, and trustworthy.

### 3.3 Backend API

Use:

- NestJS
- TypeScript
- REST API
- OpenAPI generation
- DTO validation with `class-validator` / `class-transformer`
- JWT access tokens
- refresh token stored as an HTTP-only cookie
- Argon2id password hashing

Why NestJS:

- Strong module boundaries.
- Familiar Angular-like dependency injection patterns.
- Good fit for policies, vault, approvals, workers, and audit modules.
- Easy to split into services later if needed.

### 3.4 Database

Use:

- PostgreSQL
- Prisma ORM
- Prisma migrations
- JSONB for policy rules, browser traces, and receipt timelines

Why:

- Strong relational model for organizations, agents, users, credentials, policies, workflows, approvals, and audit events.
- JSONB handles browser/event payloads without over-normalizing early.
- Prisma makes schema iteration fast during MVP development.

### 3.5 Queue And Jobs

Use:

- Redis
- BullMQ

Why:

- Workflow runs are naturally background jobs.
- Browser automation must not block API requests.
- Approval-gated actions need pause/resume behavior.
- Retries and failure states need to be explicit.

### 3.6 Object Storage

Use:

- MinIO locally
- S3-compatible SDK

Store:

- screenshots
- Playwright traces
- downloaded invoices
- generated receipt PDFs later
- exported audit bundles

Why:

- Fully local.
- S3-compatible, so production migration to S3/R2/Backblaze is straightforward.

### 3.7 Browser Runtime

Use:

- Playwright
- Chromium first
- isolated browser context per workflow run
- optional Playwright tracing
- request interception for allowlist enforcement

Why:

- Playwright is mature for browser automation.
- The worker can capture screenshots, DOM snapshots, downloads, network metadata, and action timing.
- It is ideal for the controlled browser runtime described in the product spec.

### 3.8 Local Email And Notifications

Use:

- Mailpit for local email inbox
- dashboard approvals as the primary local approval channel
- Slack adapter as an optional integration later

Why:

- Slack requires an external workspace and app setup.
- Mailpit keeps local development fully free.
- The product should not depend on Slack to prove the core approval loop.

### 3.9 Optional Local AI

Use optional adapters:

- deterministic workflow templates first
- Ollama adapter later for local page summarization or action classification

Important rule:

- The first MVP should not depend on an LLM for the core workflow.

Reason:

- The trust layer is the product.
- The first demo can use deterministic browser workflows against a local vendor sandbox.
- Optional local AI can summarize sanitized pages, but must never receive raw credentials.

## 4. High-Level Architecture

```mermaid
flowchart LR
  User["User / Approver"] --> Web["Angular Dashboard"]
  Web --> API["NestJS API"]

  API --> DB["PostgreSQL"]
  API --> Redis["Redis"]
  API --> MinIO["MinIO Object Storage"]
  API --> Mailpit["Mailpit"]

  Redis --> Worker["Workflow Worker"]
  Worker --> Runtime["Playwright Runtime"]
  Runtime --> VendorSandbox["Local Vendor Sandbox"]
  Runtime --> RealVendor["Real Vendor Portal Later"]

  Worker --> API
  Worker --> DB
  Worker --> MinIO

  API --> Policy["Policy Engine"]
  API --> Vault["Credential Vault"]
  API --> Audit["Audit Log"]
  API --> Approvals["Approval Service"]
```

## 5. Local Development Services

All development services should run with Docker Compose.

```yaml
services:
  postgres:
    image: postgres:17
    ports:
      - "5432:5432"

  redis:
    image: redis:8
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"
```

The actual `docker-compose.yml` can be added when the app is scaffolded.

## 6. Proposed Repository Structure

```text
AegisWeb/
  apps/
    web/                         # Angular dashboard
    api/                         # NestJS API
    worker/                      # BullMQ + Playwright worker
    vendor-sandbox/              # Local fake SaaS vendor portal

  libs/
    domain/                      # Shared domain enums and pure types
    api-contracts/               # Generated/OpenAPI client output
    database/                    # Prisma schema, migrations, seed helpers
    policy-engine/               # Pure policy evaluation logic
    vault/                       # Encryption helpers and secret models
    browser-runtime/             # Playwright control primitives
    audit/                       # Audit event helpers and hash chain logic
    ui/                          # Reusable Angular UI components
    testing/                     # Factories, fixtures, E2E utilities

  infra/
    docker-compose.yml
    minio/
    scripts/

  docs/
    TECHNICAL_CONCEPTION.md
    ADR/

  .env.example
  package.json
  pnpm-workspace.yaml
  nx.json
```

## 7. Applications

### 7.1 `apps/web`

The Angular dashboard is the main user interface.

Core routes:

```text
/login
/app
/app/home
/app/agents
/app/agents/:agentId
/app/policies
/app/credentials
/app/vendors
/app/workflows
/app/workflows/:workflowId
/app/runs/:runId
/app/approvals
/app/approvals/:approvalId
/app/receipts/:receiptId
/app/audit
/app/settings
```

Frontend principles:

- Lazy-load each main feature route.
- Use route guards for authentication and role access.
- Use standalone components by default.
- Use Signals for local component state.
- Use services for API access.
- Use generated API types from OpenAPI where possible.
- Use `HttpInterceptor` for auth, request IDs, and error normalization.
- Use CDK overlays/dialogs for approval, credential, and policy forms.
- Never display raw credential values.

Feature modules/directories:

```text
apps/web/src/app/
  core/
    auth/
    http/
    layout/
    guards/
    error-handling/

  features/
    home/
    agents/
    policies/
    credentials/
    vendors/
    workflows/
    approvals/
    receipts/
    audit/
    settings/

  shared/
    components/
    pipes/
    directives/
    tokens/
```

Key UI components:

- `AppShellComponent`
- `SideNavComponent`
- `TopBarComponent`
- `MetricTileComponent`
- `AgentStatusBadgeComponent`
- `RiskLevelBadgeComponent`
- `PolicyDecisionBadgeComponent`
- `ApprovalRequestPanelComponent`
- `ReceiptTimelineComponent`
- `ScreenshotViewerComponent`
- `AuditEventTableComponent`
- `CredentialSecretFormComponent`
- `PolicyRuleEditorComponent`
- `ActionMatrixComponent`

### 7.2 `apps/api`

The NestJS API is the central control plane.

Modules:

```text
AuthModule
OrganizationsModule
UsersModule
AgentsModule
VendorsModule
PoliciesModule
CredentialsModule
WorkflowsModule
WorkflowRunsModule
ActionAttemptsModule
ApprovalsModule
ReceiptsModule
AuditModule
FilesModule
NotificationsModule
InternalWorkerModule
```

Important API responsibilities:

- Authenticate users.
- Enforce organization isolation.
- Enforce RBAC.
- Create and manage agents.
- Store and evaluate policies.
- Store encrypted credentials.
- Create workflow runs.
- Dispatch workflow jobs to BullMQ.
- Receive worker events.
- Create approval requests.
- Resume approved jobs.
- Produce receipts.
- Serve signed local file URLs for screenshots and downloads.

### 7.3 `apps/worker`

The worker executes workflow jobs.

Responsibilities:

- Pull `workflow_run` jobs from BullMQ.
- Load workflow template and agent policy.
- Start isolated Playwright browser context.
- Request credential injection through secure vault service.
- Navigate only to allowed domains.
- Emit audit events at every step.
- Capture screenshots and traces.
- Pause when approval is required.
- Resume after approval.
- Mark runs complete/failed.
- Generate receipt data.

Worker modules:

```text
QueueModule
RuntimeModule
WorkflowExecutorModule
PolicyClientModule
VaultClientModule
AuditClientModule
FileStorageModule
ConnectorModule
```

### 7.4 `apps/vendor-sandbox`

This is a fake SaaS portal for local development and demos.

It should simulate:

- login page
- optional 2FA screen
- dashboard
- billing page
- invoice download
- renewal date
- current plan
- seat count
- price increase
- downgrade action
- cancellation action

This lets the MVP demonstrate the full product loop without touching a real vendor website.

Example sandbox data:

```text
Vendor: Acme Analytics
Current plan: Growth
Current price: $800/month
Renewal price: $1,100/month
Unused seats: 5
Suggested action: downgrade to Starter
Approval required: yes
Estimated savings: $480/month
```

## 8. Domain Model

### 8.1 Core Entities

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Agent : owns
  Organization ||--o{ Vendor : tracks
  Organization ||--o{ Policy : defines
  Organization ||--o{ Credential : stores
  Agent ||--o{ Workflow : runs
  Workflow ||--o{ WorkflowRun : creates
  WorkflowRun ||--o{ ActionAttempt : records
  ActionAttempt ||--o| ApprovalRequest : may_require
  WorkflowRun ||--o| Receipt : produces
  WorkflowRun ||--o{ AuditEvent : emits
```

### 8.2 Tables

#### `organizations`

```text
id
name
domain
plan
created_at
updated_at
```

#### `users`

```text
id
organization_id
email
name
role
password_hash
status
created_at
updated_at
last_login_at
```

Roles:

```text
owner
admin
approver
auditor
developer
```

MVP roles:

```text
owner
approver
```

#### `agents`

```text
id
organization_id
name
identifier
purpose
status
created_by_user_id
created_at
updated_at
revoked_at
```

Statuses:

```text
active
paused
revoked
```

#### `vendors`

```text
id
organization_id
name
website
category
renewal_date
monthly_cost_cents
owner_user_id
created_at
updated_at
```

#### `policies`

```text
id
organization_id
agent_id
name
type
version
status
rules_json
created_by_user_id
created_at
updated_at
```

Types:

```text
website_allowlist
action_permissions
spending_limits
data_access
time_window
approval_rules
```

MVP can store all rules in one policy document per agent, but keep the table flexible.

#### `credentials`

```text
id
organization_id
vendor_id
label
credential_type
encrypted_payload
encryption_version
status
last_used_at
created_by_user_id
created_at
updated_at
revoked_at
```

Types:

```text
username_password
totp_secret_later
api_token_later
oauth_token_later
session_cookie_later
```

#### `credential_agent_grants`

```text
id
credential_id
agent_id
scope
created_by_user_id
created_at
revoked_at
```

This prevents a credential from automatically being available to every agent.

#### `workflows`

```text
id
organization_id
agent_id
vendor_id
name
template
status
configuration_json
created_by_user_id
created_at
updated_at
```

Templates:

```text
vendor_invoice_download
saas_renewal_check
plan_downgrade_request
```

#### `workflow_runs`

```text
id
organization_id
workflow_id
agent_id
vendor_id
status
started_at
completed_at
current_step
result_summary
error_message
created_at
updated_at
```

Statuses:

```text
queued
running
waiting_for_approval
completed
failed
canceled
denied
```

#### `action_attempts`

```text
id
organization_id
workflow_run_id
agent_id
vendor_id
website
action_type
risk_level
policy_decision
policy_reason
approval_request_id
input_summary
output_summary
amount_cents
created_at
completed_at
```

Action types:

```text
open_page
read_page
fill_form
click_button
download_file
submit_form
change_plan
cancel_subscription
invite_user
change_billing_details
make_purchase
credential_injection
```

Policy decisions:

```text
allow
deny
require_approval
require_step_up_auth
pause_agent
```

Risk levels:

```text
low
medium
high
critical
```

#### `approval_requests`

```text
id
organization_id
workflow_run_id
action_attempt_id
status
requested_by_agent_id
approver_user_id
summary
risk_level
amount_cents
screenshot_file_id
policy_triggered_json
expires_at
approved_at
rejected_at
comment
created_at
updated_at
```

Statuses:

```text
pending
approved
rejected
expired
auto_approved
escalated
```

#### `audit_events`

```text
id
organization_id
workflow_run_id
agent_id
actor_type
actor_id
event_type
event_data_json
prev_hash
event_hash
created_at
```

The hash chain makes local audit tampering visible.

Actor types:

```text
user
agent
worker
system
integration
```

#### `files`

```text
id
organization_id
workflow_run_id
kind
bucket
object_key
mime_type
size_bytes
sha256
created_at
```

Kinds:

```text
screenshot
invoice
playwright_trace
receipt_export
download
```

#### `receipts`

```text
id
organization_id
workflow_run_id
agent_id
final_status
summary
timeline_json
screenshots_json
files_json
policy_decisions_json
approval_details_json
created_at
```

## 9. Policy Engine

### 9.1 MVP Approach

Build the first policy engine as a pure TypeScript library in `libs/policy-engine`.

Do not add Open Policy Agent or a separate policy language in the MVP.

Reason:

- The initial policy set is small.
- A pure function is easy to unit test.
- Every policy decision can be recorded with inputs and outputs.

### 9.2 Policy Input

```ts
type PolicyEvaluationInput = {
  organizationId: string;
  agentId: string;
  website: string;
  actionType: ActionType;
  amountCents?: number;
  riskSignals: RiskSignal[];
  policySnapshot: AgentPolicySnapshot;
  now: string;
};
```

### 9.3 Policy Output

```ts
type PolicyEvaluationResult = {
  decision:
    | 'allow'
    | 'deny'
    | 'require_approval'
    | 'require_step_up_auth'
    | 'pause_agent';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  matchedRules: string[];
};
```

### 9.4 MVP Rules

Website rules:

- Deny navigation to unknown domains.
- Allow exact domains and approved subdomains.
- Block banking, payroll, and unknown payment pages by default.

Action rules:

- Allow read-only navigation and invoice downloads on approved vendor domains.
- Require approval for plan change, cancellation, purchase, or billing update.
- Deny admin invitation and bank detail changes in MVP.

Spending rules:

- Auto-allow below configured threshold.
- Require approval between threshold and hard limit.
- Deny above hard limit.

Time rules:

- Allow read-only actions anytime.
- Restrict submit/change actions to configured business hours later.

### 9.5 Risk Signals

Initial risk signals:

```text
unknown_domain
destructive_keyword
financial_amount_present
credential_used
new_vendor
first_run_for_agent
submit_button
download_sensitive_file
plan_change_detected
cancel_detected
payment_detected
```

## 10. Credential Vault

### 10.1 MVP Secret Format

Store credentials as encrypted JSON.

Example plaintext before encryption:

```json
{
  "username": "finance@example.com",
  "password": "never-return-this-to-ui"
}
```

Encrypted payload:

```json
{
  "alg": "aes-256-gcm",
  "key_version": "local-v1",
  "iv": "...",
  "auth_tag": "...",
  "ciphertext": "..."
}
```

### 10.2 Local Key Management

Use:

- `VAULT_MASTER_KEY` in `.env`
- 32-byte base64 key
- AES-256-GCM

Rules:

- Never log plaintext secrets.
- Never return plaintext secrets to Angular.
- Only the worker can request decrypted values during an authorized run.
- Every credential use creates an audit event.
- Credential injection screenshots must mask password fields.

### 10.3 Future Production Upgrade

Later replace local master key with:

- cloud KMS
- HashiCorp Vault
- Doppler
- Infisical
- hardware-backed key storage

For local development, `.env` is enough if it is never committed.

## 11. Browser Runtime Design

### 11.1 Runtime Lifecycle

```mermaid
sequenceDiagram
  participant U as User
  participant W as Angular Dashboard
  participant A as API
  participant Q as BullMQ
  participant R as Worker
  participant B as Playwright
  participant P as Policy Engine
  participant V as Vault
  participant S as Storage

  U->>W: Start workflow
  W->>A: POST /workflow-runs
  A->>Q: enqueue run
  Q->>R: run job
  R->>B: create isolated context
  R->>P: evaluate open_page
  P-->>R: allow
  R->>B: navigate to vendor
  R->>V: request credential for run
  V-->>R: decrypted credential
  R->>B: inject credentials
  R->>S: store screenshot
  R->>P: evaluate risky action
  P-->>R: require_approval
  R->>A: create approval request
  A-->>W: pending approval visible
```

### 11.2 Browser Guardrails

The runtime must enforce:

- allowed domains only
- blocked downloads unless policy allows
- no credential entry outside approved login forms
- no destructive submit without policy decision
- no plan change/cancel/purchase without approval
- screenshot capture before and after important actions
- trace capture for debugging
- timeout on stuck pages
- hard cancel if agent status becomes paused/revoked

### 11.3 Screenshot Strategy

Capture screenshots:

- before login
- after login success
- before downloaded invoice
- before risky action
- after approval
- after final action
- on error

Mask:

- password inputs
- TOTP fields
- obvious secret/token fields

### 11.4 DOM Metadata

For each action attempt, store lightweight metadata:

```json
{
  "url": "http://localhost:4202/billing",
  "title": "Billing - Acme Analytics",
  "action_selector": "button[data-action='downgrade']",
  "visible_text_excerpt": "Downgrade Growth to Starter",
  "form_fields": ["plan", "seat_count"],
  "danger_words": ["downgrade", "confirm"]
}
```

Do not store full page HTML by default because it can contain sensitive data.

## 12. Workflow Execution

### 12.1 MVP Workflow Templates

#### Vendor invoice download

Steps:

1. Verify agent is active.
2. Load vendor and credential grant.
3. Check website allowlist.
4. Open vendor login page.
5. Inject credential.
6. Navigate to billing page.
7. Download latest invoice.
8. Store invoice in MinIO.
9. Create receipt.

#### SaaS renewal check

Steps:

1. Open billing page.
2. Read current plan.
3. Read renewal date.
4. Read current monthly price.
5. Read upcoming renewal price.
6. Calculate increase.
7. Store extracted result.
8. Create receipt.

#### Plan downgrade request

Steps:

1. Run renewal check.
2. Detect unused seats or price increase.
3. Prepare proposed downgrade.
4. Evaluate policy.
5. Create approval request.
6. Pause run.
7. Resume when approved.
8. Submit downgrade.
9. Store final screenshot.
10. Create receipt.

### 12.2 Workflow State

The run must be resumable.

Store:

- current step
- step input
- step output
- browser state needed to resume
- approval request ID
- last screenshot ID

For MVP, it is acceptable to restart the browser after approval and navigate back to the required page if session persistence is unreliable.

## 13. Approval System

### 13.1 Local MVP Approval Channels

Primary:

- dashboard approval page

Secondary:

- Mailpit email approval link

Optional later:

- Slack app

### 13.2 Approval Request Content

Each approval request must show:

- agent name
- vendor
- website
- proposed action
- risk level
- amount/savings
- policy rule triggered
- screenshot
- extracted summary
- approve button
- reject button
- comment field
- expiration time

### 13.3 Approval Decision Rules

- Only `owner`, `admin`, or `approver` can approve.
- The same user who created the workflow can approve in MVP, but this should be configurable later.
- Approval tokens must be single-use.
- Rejected approval permanently stops that action attempt.
- Expired approval marks the workflow run as `failed` or `canceled`.

## 14. Audit And Receipts

### 14.1 Audit Events

Every significant event becomes an append-only audit event.

Examples:

```text
organization_created
user_invited
agent_created
agent_paused
policy_updated
credential_created
credential_granted_to_agent
credential_used
workflow_run_created
workflow_step_started
browser_page_opened
browser_element_clicked
file_downloaded
policy_evaluated
approval_requested
approval_approved
approval_rejected
workflow_completed
workflow_failed
receipt_created
```

### 14.2 Hash Chain

Each audit event should include:

```text
prev_hash
event_hash
```

Hash input:

```text
organization_id + workflow_run_id + event_type + event_data_json + created_at + prev_hash
```

This is not full cryptographic immutability, but it makes accidental or manual database edits detectable in local/dev and is a good foundation for stronger receipts later.

### 14.3 Receipt Page

The receipt page is the core trust artifact.

It should show:

- final status
- run summary
- agent identity
- vendor
- timeline
- screenshots
- files downloaded
- policy decisions
- approval record
- credential usage marker, without secret value
- error details if failed

## 15. API Design

### 15.1 Auth

```http
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

### 15.2 Agents

```http
GET    /agents
POST   /agents
GET    /agents/:id
PATCH  /agents/:id
POST   /agents/:id/pause
POST   /agents/:id/resume
POST   /agents/:id/revoke
GET    /agents/:id/activity
```

### 15.3 Policies

```http
GET    /policies
POST   /policies
GET    /policies/:id
PATCH  /policies/:id
POST   /policies/evaluate
```

The public `POST /policies/evaluate` endpoint can be internal/admin only during MVP.

### 15.4 Credentials

```http
GET    /credentials
POST   /credentials
GET    /credentials/:id
PATCH  /credentials/:id
POST   /credentials/:id/grants
DELETE /credentials/:id/grants/:grantId
POST   /credentials/:id/revoke
```

Never implement:

```http
GET /credentials/:id/plaintext
```

### 15.5 Vendors

```http
GET    /vendors
POST   /vendors
GET    /vendors/:id
PATCH  /vendors/:id
DELETE /vendors/:id
```

### 15.6 Workflows And Runs

```http
GET  /workflows
POST /workflows
GET  /workflows/:id
POST /workflows/:id/runs

GET  /workflow-runs
GET  /workflow-runs/:id
POST /workflow-runs/:id/cancel
GET  /workflow-runs/:id/events
```

### 15.7 Approvals

```http
GET  /approvals
GET  /approvals/:id
POST /approvals/:id/approve
POST /approvals/:id/reject
```

### 15.8 Receipts

```http
GET /receipts
GET /receipts/:id
GET /receipts/:id/export
```

PDF export is nice-to-have, not MVP-critical.

### 15.9 Audit

```http
GET /audit-events
GET /audit-events/:id
```

Filters:

```text
agent_id
workflow_run_id
event_type
actor_type
from
to
```

### 15.10 Internal Worker API

```http
POST /internal/workers/runs/:runId/events
POST /internal/workers/runs/:runId/screenshots
POST /internal/workers/runs/:runId/files
POST /internal/workers/runs/:runId/action-attempts
POST /internal/workers/runs/:runId/approval-requests
POST /internal/workers/runs/:runId/complete
POST /internal/workers/runs/:runId/fail
```

Protect internal endpoints with a worker token and local network assumptions during development.

## 16. Frontend Screen Conception

### 16.1 Home

Purpose:

- Show operational state at a glance.

Content:

- active agents
- pending approvals
- recent workflow runs
- savings detected
- failed runs
- high-risk events

### 16.2 Agents

Purpose:

- Manage non-human identities.

Actions:

- create agent
- edit purpose
- pause
- revoke
- view activity
- attach workflows
- attach policies

### 16.3 Policies

Purpose:

- Make authority visible and editable.

Sections:

- website allowlist
- blocked domains
- action permission matrix
- spending threshold
- approval rules
- risk defaults

### 16.4 Credentials

Purpose:

- Store vendor credentials without exposing secrets.

Actions:

- add credential
- assign credential to agent
- revoke
- rotate later
- view last used

### 16.5 Vendors

Purpose:

- Track vendor portals and renewal metadata.

Fields:

- name
- website
- category
- renewal date
- monthly cost
- owner

### 16.6 Workflows

Purpose:

- Run predefined safe workflows.

Templates:

- download invoice
- check renewal
- plan downgrade request

### 16.7 Approvals

Purpose:

- Human review for risky actions.

The approval detail view is one of the most important screens in the product.

It must show enough evidence for a human to make a confident decision.

### 16.8 Receipts

Purpose:

- Proof of what happened.

This page should feel like a transaction receipt plus a compliance log.

### 16.9 Audit

Purpose:

- Searchable technical history.

This is more detailed than receipts and is aimed at debugging and compliance.

## 17. Security Model

### 17.1 Authentication

MVP:

- local email/password
- Argon2id password hash
- JWT access token
- refresh token cookie
- CSRF protection for cookie endpoints if needed

Later:

- SSO
- passkeys
- WorkOS
- SAML

### 17.2 Authorization

Use RBAC first.

Permission examples:

```text
agent:create
agent:update
agent:pause
policy:update
credential:create
credential:grant
workflow:run
approval:approve
receipt:read
audit:read
```

Every API request must include:

- authenticated user
- organization ID
- role
- permission check

### 17.3 Organization Isolation

All queries must be scoped by `organization_id`.

Create helper APIs in the database layer so developers do not forget org filters.

Future:

- Postgres row-level security

### 17.4 Credential Safety

Rules:

- no raw secrets in logs
- no raw secrets in API responses
- no raw secrets in audit data
- no raw secrets in screenshots
- no raw secrets in LLM prompts
- credential use must be recorded

### 17.5 Browser Session Isolation

Rules:

- one browser context per workflow run
- no shared cookies across organizations
- clear storage after each run unless explicitly persisted
- block navigation outside allowlist
- block file uploads in MVP
- capture trace only when safe

### 17.6 Audit Integrity

Rules:

- audit events are append-only in application logic
- event hash chain
- user-visible receipt generated from audit events
- update/delete audit endpoints should not exist

## 18. Local Environment Variables

Example:

```env
NODE_ENV=development

DATABASE_URL=postgresql://agentpass:agentpass@localhost:5432/agentpass
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=local-dev-access-secret-change-me
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-me

VAULT_MASTER_KEY=base64-32-byte-key-here

S3_ENDPOINT=http://localhost:9000
S3_REGION=local
S3_BUCKET=agentpass-local
S3_ACCESS_KEY=agentpass
S3_SECRET_KEY=agentpass-secret
S3_FORCE_PATH_STYLE=true

MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=AgentPass Local <agentpass@localhost>

WORKER_INTERNAL_TOKEN=local-worker-token-change-me

VENDOR_SANDBOX_URL=http://localhost:4202
```

## 19. Development Commands

Target commands after scaffolding:

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Useful commands:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm dev:vendor
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm format
```

## 20. Testing Strategy

### 20.1 Unit Tests

Highest priority:

- policy engine
- risk scoring
- vault encryption/decryption
- RBAC checks
- audit hash chain
- workflow step planner

### 20.2 Integration Tests

Test:

- API with Postgres test database
- credential creation and grant flow
- workflow run creation
- approval request lifecycle
- receipt generation

### 20.3 E2E Tests

Use Playwright.

Critical E2E:

1. user logs in
2. creates agent
3. adds vendor credential
4. configures policy
5. runs invoice workflow against vendor sandbox
6. sees completed receipt

Approval E2E:

1. run downgrade workflow
2. worker pauses for approval
3. approver approves in dashboard
4. worker resumes
5. receipt records approval and final action

### 20.4 Browser Runtime Tests

Use vendor sandbox for deterministic browser tests.

Test:

- navigation allowlist
- blocked domain
- credential injection
- screenshot creation
- invoice download
- approval pause
- rejected approval
- canceled workflow

## 21. MVP Milestones

### Milestone 1: Local Foundation

Deliver:

- monorepo
- Angular app shell
- NestJS API
- Docker Compose
- Postgres/Redis/MinIO/Mailpit
- Prisma schema
- seed data
- local auth

### Milestone 2: Core Control Plane

Deliver:

- organizations
- users
- agents
- vendors
- policies
- credentials
- RBAC
- audit events

### Milestone 3: Vendor Sandbox

Deliver:

- fake SaaS portal
- login
- billing page
- invoice download
- downgrade/cancel actions

### Milestone 4: Browser Worker

Deliver:

- BullMQ worker
- Playwright runtime
- domain allowlist
- screenshots to MinIO
- workflow run status updates
- first invoice workflow

### Milestone 5: Approval Loop

Deliver:

- policy decision requires approval
- approval request page
- approve/reject
- worker pause/resume
- receipt timeline

### Milestone 6: Demo Polish

Deliver:

- home dashboard
- receipt detail page
- audit log filters
- seeded demo data
- E2E demo script
- 60-second demo flow

## 22. First Build Order

Build in this order:

1. Scaffold monorepo.
2. Add Docker Compose services.
3. Add Prisma schema and seed.
4. Build API auth and org/user seed.
5. Build Angular app shell.
6. Build agents CRUD.
7. Build vendors CRUD.
8. Build credentials vault with encryption.
9. Build policies UI and policy engine.
10. Build vendor sandbox.
11. Build workflow run API.
12. Build worker and Playwright runtime.
13. Build invoice download workflow.
14. Build approval workflow.
15. Build receipt page.
16. Add E2E tests.

## 23. Technical Decisions

### 23.1 REST Instead Of GraphQL

Use REST for MVP.

Reason:

- Simpler for workers.
- Easier to inspect.
- Better fit for OpenAPI-generated frontend clients.
- Lower complexity during fast validation.

### 23.2 Modular Monolith Instead Of Microservices

Use a modular monolith.

Reason:

- Faster local development.
- Easier transactions.
- Easier debugging.
- Can split worker separately while keeping shared code.

### 23.3 Local Auth Instead Of Clerk/Auth0/WorkOS

Use local auth for development.

Reason:

- Free.
- Fully local.
- No vendor dependency.
- Enough for MVP and demo.

### 23.4 Dashboard Approval Before Slack

Build dashboard approvals first.

Reason:

- Fully local.
- Proves core risk loop.
- Slack can be added as a notification adapter later.

### 23.5 Deterministic Workflows Before General Agents

Build workflow templates first.

Reason:

- Reliable demo.
- Clear audit.
- Easier to secure.
- Better for procurement wedge.

## 24. Production Migration Path

Local development choice -> production option:

```text
PostgreSQL local Docker -> managed Postgres
Redis local Docker -> managed Redis
MinIO -> S3, Cloudflare R2, Backblaze B2, or self-hosted MinIO
Mailpit -> Resend/Postmark/SES
Local auth -> WorkOS/Clerk/Auth.js/SAML
Docker Compose -> Fly.io/Render/Railway/AWS
Local vault key -> KMS/Vault/Infisical
Vendor sandbox -> real vendor connectors
Dashboard approval -> Slack/Teams/mobile approvals
```

## 25. Key Engineering Risks

### Risk: Website automation is brittle

Mitigation:

- start with vendor sandbox
- then support 2-3 chosen real vendors
- use deterministic connector scripts
- store traces and screenshots
- keep human fallback

### Risk: Credential handling creates trust issues

Mitigation:

- never show plaintext after creation
- encrypt at rest
- log every credential use
- separate credential grants by agent
- mask screenshots

### Risk: Product becomes too abstract

Mitigation:

- every screen and demo should center SaaS invoices/renewals
- "trust infrastructure" is the platform story, not the first UI story

### Risk: Approval flow blocks automation too much

Mitigation:

- make policy thresholds configurable
- auto-allow low-risk read-only actions
- require approval only for business-impacting actions

### Risk: Audit log grows quickly

Mitigation:

- store event summaries in Postgres
- store heavy artifacts in MinIO
- paginate audit UI
- create receipts as compact materialized summaries

## 26. Definition Of MVP Done

The MVP is done when this local demo works end-to-end:

1. User logs into Angular dashboard.
2. User creates `Procurement Bot`.
3. User adds `Acme Analytics` vendor credentials.
4. User configures policy:
   - allow `localhost` vendor sandbox
   - allow invoice download
   - require approval for plan downgrade
5. User starts renewal workflow.
6. Worker opens vendor sandbox in Playwright.
7. Worker logs in using vault-injected credential.
8. Worker downloads invoice.
9. Worker detects renewal price increase.
10. Worker proposes downgrade.
11. Policy engine requires approval.
12. Dashboard shows approval request with screenshot.
13. Approver approves.
14. Worker resumes and submits downgrade.
15. Receipt page shows:
   - timeline
   - screenshots
   - policy decision
   - approval record
   - downloaded invoice
   - final result

## 27. Recommended First Demo Narrative

Use this demo story:

> A startup pays for too many SaaS seats. AgentPass lets a procurement agent log into a vendor portal, download the latest invoice, detect a price increase, propose a downgrade, ask for human approval, perform the approved change, and generate an audit receipt.

This proves:

- controlled identity
- credential vault
- browser action control
- policy enforcement
- human approval
- auditability
- business value

## 28. Official Reference Links

These are useful when implementing the stack:

- Angular: `https://angular.dev`
- NestJS: `https://docs.nestjs.com`
- Prisma PostgreSQL quickstart: `https://www.prisma.io/docs/prisma-orm/quickstart/postgresql`
- Playwright: `https://playwright.dev/docs/intro`
- BullMQ: `https://docs.bullmq.io`
- Redis: `https://redis.io/docs/latest`
- PostgreSQL: `https://www.postgresql.org`
- Docker Compose: `https://docs.docker.com/compose`
- Nx: `https://nx.dev`

