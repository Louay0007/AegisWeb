# AegisWeb Detailed Product Specification

Generated: 2026-06-06

## 1. Product Summary

### Name

**AegisWeb**

### One-Liner

**AegisWeb is the identity, permissions, approval, and audit layer that lets AI agents safely take actions on the web.**

### Short Description

AI agents are becoming capable of browsing websites, filling forms, logging into portals, downloading files, buying products, booking services, changing settings, and operating across business tools. But companies cannot safely give autonomous agents raw passwords, credit cards, admin access, or unrestricted browser control.

AegisWeb solves this by giving each AI agent a controlled identity, limited permissions, approval rules, credential access, spending limits, and a complete audit trail for every web action.

### Core Idea

The web was built for humans and traditional bots. AI agents are a new actor type. They need a trust layer.

AegisWeb becomes that trust layer:

- Who is this agent?
- Who owns it?
- What is it allowed to do?
- Which websites can it access?
- Which credentials can it use?
- What actions require human approval?
- What did it actually do?
- Can the action be replayed, audited, or revoked?

## 2. The Problem

### The Current Situation

AI agents can already operate browsers through tools like browser automation, AI browsing, web agents, and agent frameworks. However, companies are hesitant to use them in production workflows because agents are hard to control.

Current approaches are risky:

- Share a real employee password with the agent.
- Give the agent unrestricted browser access.
- Put raw credentials in environment variables.
- Let the agent use a human credit card.
- Trust screenshots or logs that are incomplete.
- Manually review everything after the fact.
- Block agents entirely from real business actions.

### Core Pain

Companies want agents to do useful work, but they do not trust them with authority.

The bottleneck is not only intelligence. The bottleneck is permission.

### Examples Of Risky Agent Actions

- Buying a SaaS subscription.
- Canceling an account.
- Changing billing details.
- Submitting a compliance form.
- Sending a customer email.
- Creating support tickets.
- Downloading sensitive invoices.
- Updating HR or payroll data.
- Inviting a new admin user.
- Changing security settings.
- Accepting legal terms.

## 3. Why Now

AegisWeb exists because several trends are converging:

1. AI agents are becoming good enough to use web interfaces.
2. Companies want automation across fragmented vendor portals.
3. Many websites do not expose complete APIs.
4. Browser automation is becoming a normal agent capability.
5. Security and compliance teams will not approve uncontrolled agents.
6. The web lacks a native permission model for non-human AI actors.

The next wave of agent adoption needs infrastructure for trust.

## 4. Vision

### Long-Term Vision

AegisWeb becomes the standard trust layer for the agentic web.

Every company can issue controlled identities to AI agents. Every website can recognize trusted agent identities. Every important action can be permissioned, approved, logged, replayed, and audited.

### What AegisWeb Could Become

- OAuth for AI agents.
- Stripe Radar for agent actions.
- Okta for non-human web workers.
- Plaid-like infrastructure for permissioned agent access.
- Vercel-style developer platform for agent trust.

## 5. Initial Wedge

### First Market

**AI procurement and finance operations for SaaS vendor management.**

### Why This Wedge

SaaS vendor management is painful, repetitive, fragmented, and high-value. Companies deal with many vendor portals, invoices, renewal dates, plan changes, billing pages, seat counts, and cancellation flows.

These tasks are perfect for agents, but too risky without controls.

### First Workflow

AegisWeb lets a company safely use an AI agent to:

- Detect upcoming SaaS renewals.
- Log into vendor portals.
- Download invoices.
- Check seat usage.
- Compare plans.
- Identify price increases.
- Prepare cancellation or downgrade requests.
- Ask for approval before making changes.
- Submit approved actions.
- Produce an audit receipt.

### First Customer Profile

Best early customers:

- 20-500 person SaaS companies.
- Startups with many SaaS tools.
- Finance or operations teams.
- AI-native companies already experimenting with agents.
- Companies with no dedicated procurement department.

Initial buyer:

- Founder.
- Head of Operations.
- Finance Lead.
- Controller.

Initial user:

- Operations manager.
- Finance associate.
- Founder doing ops manually.

## 6. Product Principles

### Principle 1: Permission Before Autonomy

Agents should only act inside explicit boundaries.

### Principle 2: Human Approval For Risk

Low-risk actions can be automated. High-risk actions need human approval.

### Principle 3: Every Action Leaves A Receipt

AegisWeb should produce a clear record of what happened, who approved it, when it happened, and what changed.

### Principle 4: Start With A Narrow Workflow

The first product should not try to control every agent on the internet. It should solve one painful workflow extremely well.

### Principle 5: Become Infrastructure Later

The wedge is SaaS procurement. The platform is agent identity and permission infrastructure.

## 7. Product Modules

## Module 1: Organization Workspace

### Purpose

The organization workspace is the home for a company using AegisWeb.

### Features

- Create organization.
- Invite team members.
- Assign roles.
- Manage billing.
- Configure global security settings.
- View all agents.
- View all workflows.
- View all audit logs.

### User Roles

| Role | Permissions |
|---|---|
| Owner | Full access, billing, security, delete organization |
| Admin | Manage agents, policies, workflows, integrations |
| Approver | Approve or reject agent actions |
| Auditor | Read-only access to logs and receipts |
| Developer | Use API keys, SDKs, webhooks |

### MVP Scope

For MVP, support:

- One organization.
- Owner and approver roles.
- Basic invite by email.

## Module 2: Agent Identity

### Purpose

Each AI agent needs its own identity instead of pretending to be a human user.

### What An Agent Identity Contains

- Agent name.
- Agent email-like identifier.
- Owning organization.
- Purpose.
- Allowed workflows.
- Allowed websites.
- Linked policies.
- Linked credentials.
- Status: active, paused, revoked.
- Created by.
- Created at.

### Example

Agent:

`procurement-bot@AegisWeb.company.com`

Purpose:

Manage SaaS invoices, renewals, and vendor portal actions.

Allowed:

- Download invoices.
- Read billing pages.
- Prepare cancellation requests.
- Request quote changes.

Not allowed:

- Change bank details.
- Add admin users.
- Delete accounts.
- Purchase above approved limits.

### MVP Scope

Create, list, edit, pause, and revoke agents.

## Module 3: Policy Engine

### Purpose

The policy engine decides whether an agent action is allowed, denied, or requires approval.

### Policy Types

#### Website Policy

Controls which websites an agent can access.

Example:

- Allowed: `notion.so`, `slack.com`, `stripe.com`, `linear.app`
- Blocked: banking portals, payroll portals, unknown domains

#### Action Policy

Controls what type of actions the agent can perform.

Action categories:

- Read page.
- Fill form.
- Download file.
- Upload file.
- Submit form.
- Click destructive button.
- Change plan.
- Cancel subscription.
- Invite user.
- Change billing details.
- Make purchase.

#### Spending Policy

Controls financial actions.

Example:

- Auto-approve purchases below $100.
- Require approval between $100 and $1,000.
- Block above $1,000 unless owner approves.

#### Data Access Policy

Controls sensitive data.

Example:

- Can read invoice PDFs.
- Cannot download employee payroll files.
- Cannot access pages with SSNs.

#### Time Policy

Controls when agents can act.

Example:

- Only run on weekdays.
- Only submit actions between 9am and 6pm.

### Policy Decision Output

Every attempted action returns one of:

- `allow`
- `deny`
- `require_approval`
- `require_step_up_auth`
- `pause_agent`

### MVP Scope

Start with:

- Website allowlist.
- Action type allow/deny.
- Approval threshold.
- Manual policy editor.

## Module 4: Credential Vault

### Purpose

Agents need controlled access to credentials without seeing raw secrets.

### Features

- Store vendor portal credentials.
- Store API keys if needed.
- Store payment method reference, not raw card details if possible.
- Inject credentials only inside controlled sessions.
- Rotate credentials.
- Revoke access.
- Track credential usage.

### Credential Types

- Username/password.
- TOTP/2FA shared secret.
- API token.
- Session cookie.
- OAuth token.
- Payment method token.

### Security Requirements

- Encrypt secrets at rest.
- Never expose raw credentials to the LLM.
- Only browser runtime can request credential injection.
- Log every credential access.
- Support manual revocation.

### MVP Scope

For MVP:

- Store username/password credentials.
- Manual 2FA handoff.
- Inject credentials into browser session.
- Log usage.

## Module 5: Controlled Browser Runtime

### Purpose

The controlled browser runtime is where agent actions happen.

### Responsibilities

- Open approved websites.
- Execute browser actions.
- Capture screenshots.
- Capture DOM/action traces.
- Detect risky actions.
- Ask policy engine before executing actions.
- Pause when approval is required.
- Resume after approval.
- Store action receipts.

### Browser Runtime Events

- Page opened.
- Element clicked.
- Text entered.
- File downloaded.
- Form submitted.
- Credential injected.
- Approval requested.
- Approval granted.
- Approval rejected.
- Action completed.
- Action failed.

### Integration Options

AegisWeb can integrate with:

- Playwright.
- Browserbase.
- Skyvern-like systems.
- Internal browser automation.
- Agent frameworks through SDK.

### MVP Scope

Use Playwright for first controlled runs.

Support:

- Screenshots.
- Step logs.
- Basic DOM metadata.
- Policy checks before submit/click actions.

## Module 6: Approval Workflow

### Purpose

When an action is risky, AegisWeb should pause and ask a human.

### Approval Channels

- Slack.
- Email.
- AegisWeb dashboard.
- Later: Microsoft Teams, mobile push, SMS.

### Approval Request Contains

- Agent name.
- Website.
- Proposed action.
- Risk level.
- Amount of money involved.
- Screenshot.
- Extracted summary.
- Policy triggered.
- Approve button.
- Reject button.
- Comment field.

### Example

Agent wants to downgrade a SaaS plan:

> Procurement Bot wants to downgrade `Acme Analytics` from Growth plan to Starter plan. Estimated savings: $480/month. This will remove 5 unused seats. Approve?

### Approval States

- Pending.
- Approved.
- Rejected.
- Expired.
- Auto-approved.
- Escalated.

### MVP Scope

Slack approval and dashboard approval.

## Module 7: Audit Log And Receipts

### Purpose

Every agent action should produce evidence.

### Receipt Contents

- Receipt ID.
- Organization ID.
- Agent ID.
- Workflow ID.
- Website.
- Action type.
- Human approver if any.
- Timestamp.
- Browser screenshots.
- DOM/action trace.
- Input summary.
- Output summary.
- Policy decision.
- Credential used.
- Files downloaded.
- Final status.

### Receipt Use Cases

- Compliance.
- Debugging.
- Internal review.
- Customer trust.
- Replaying failures.
- Proving what the agent did.

### MVP Scope

Create a receipt page for every workflow run.

Must include:

- Timeline.
- Screenshots.
- Policy decisions.
- Approval details.
- Final result.

## Module 8: Workflow Builder

### Purpose

Users need to define what agent workflows should accomplish.

### Workflow Types

Initial:

- Download invoice.
- Check renewal date.
- Detect price increase.
- Prepare cancellation.
- Update seat count.
- Request quote.

Later:

- Book travel.
- Submit insurance forms.
- Update CRM records.
- File compliance reports.
- Handle support tickets.

### Workflow Definition

A workflow includes:

- Goal.
- Agent identity.
- Allowed websites.
- Required credentials.
- Input data.
- Approval policy.
- Success condition.
- Output format.

### MVP Scope

No visual builder at first.

Use predefined workflow templates:

- Vendor invoice download.
- SaaS renewal check.
- Plan downgrade request.

## Module 9: Integrations

### Purpose

AegisWeb must fit into existing company workflows.

### MVP Integrations

#### Slack

- Approval requests.
- Workflow notifications.
- Daily summary.

#### Gmail Or Google Workspace

- Detect renewal emails.
- Find invoices.
- Trigger vendor workflow.

#### Browser Runtime

- Playwright-based controlled session.

### Future Integrations

- Microsoft Teams.
- Okta.
- Google Drive.
- Dropbox.
- QuickBooks.
- Xero.
- NetSuite.
- Ramp.
- Brex.
- Jira.
- Linear.
- Salesforce.
- Zapier.
- Workato.

## Module 10: Developer API And SDK

### Purpose

Agent builders should be able to use AegisWeb as infrastructure.

### SDK Use Case

An external AI agent wants to perform an action:

1. Agent calls AegisWeb before action.
2. AegisWeb checks policy.
3. AegisWeb returns allow, deny, or approval required.
4. Agent executes only if allowed.
5. Agent sends receipt data back.

### API Concepts

Endpoints:

- Create agent.
- Get policy decision.
- Create action attempt.
- Request approval.
- Submit action result.
- Create receipt.
- Query audit logs.

### Example API Flow

```http
POST /v1/action-attempts
```

Request:

```json
{
  "agent_id": "agt_123",
  "website": "vendor.com",
  "action_type": "change_subscription_plan",
  "amount": 480,
  "summary": "Downgrade plan from Growth to Starter"
}
```

Response:

```json
{
  "decision": "require_approval",
  "approval_request_id": "apr_456",
  "reason": "Plan changes require approval"
}
```

### MVP Scope

Internal API first. Public SDK after first pilots.

## Module 11: Risk Scoring

### Purpose

AegisWeb should assign risk levels to actions.

### Risk Factors

- Financial amount.
- Unknown website.
- Destructive action.
- New credential access.
- Sensitive data.
- First-time workflow.
- Agent confidence.
- Human approval history.
- Website reputation.
- Text on page, such as "delete", "cancel", "confirm", "wire", "bank".

### Risk Levels

- Low.
- Medium.
- High.
- Critical.

### MVP Scope

Rule-based scoring.

Later:

- ML-based anomaly detection.
- Organization-specific risk tuning.

## Module 12: Admin Dashboard

### Purpose

The dashboard is where users manage AegisWeb.

### Main Screens

#### Home

- Active agents.
- Pending approvals.
- Recent workflows.
- Savings detected.
- Risk events.

#### Agents

- List agents.
- Create agent.
- Pause/revoke agent.
- View agent activity.

#### Policies

- Website allowlist.
- Action permissions.
- Spending thresholds.
- Approval rules.

#### Credentials

- Vendor credentials.
- Credential status.
- Last used.
- Revoke/rotate.

#### Workflows

- Run workflow.
- View past runs.
- See failures.
- Retry workflow.

#### Approvals

- Pending approvals.
- Approved/rejected history.

#### Audit Logs

- Search by agent, website, action, date, approver.
- Export CSV/PDF.

#### Settings

- Team members.
- Integrations.
- Billing.
- Security.

### MVP Scope

Build:

- Home.
- Agents.
- Policies.
- Credentials.
- Workflow runs.
- Receipts.

## 8. Core User Flows

## Flow 1: Create A New Agent

1. User signs up.
2. User creates organization.
3. User clicks "New Agent".
4. User enters name and purpose.
5. User selects workflow template.
6. User adds website allowlist.
7. User sets approval thresholds.
8. User saves agent.
9. Agent appears as active.

## Flow 2: Add Vendor Credentials

1. User opens credentials page.
2. User chooses vendor website.
3. User enters username and password.
4. AegisWeb encrypts credential.
5. User assigns credential to an agent.
6. AegisWeb logs credential creation.

## Flow 3: Run Invoice Download Workflow

1. User selects vendor.
2. Agent opens controlled browser session.
3. Agent logs into vendor portal.
4. Agent navigates to billing page.
5. Agent downloads invoice.
6. AegisWeb stores invoice metadata.
7. AegisWeb creates receipt.
8. User sees completed workflow.

## Flow 4: Risky Action Requires Approval

1. Agent detects upcoming renewal.
2. Agent proposes downgrade or cancellation.
3. Policy engine marks action as approval required.
4. Slack approval request is sent.
5. Human reviews screenshot and summary.
6. Human approves.
7. Agent resumes action.
8. Receipt records approval and final action.

## Flow 5: Action Denied

1. Agent attempts blocked action.
2. Policy engine denies action.
3. Browser runtime stops action.
4. User receives notification.
5. Receipt records denial reason.

## 9. Data Model

### Organization

Fields:

- `id`
- `name`
- `domain`
- `plan`
- `created_at`
- `updated_at`

### User

Fields:

- `id`
- `organization_id`
- `email`
- `name`
- `role`
- `created_at`

### Agent

Fields:

- `id`
- `organization_id`
- `name`
- `identifier`
- `purpose`
- `status`
- `created_by`
- `created_at`
- `revoked_at`

### Policy

Fields:

- `id`
- `organization_id`
- `agent_id`
- `name`
- `type`
- `rules_json`
- `created_at`
- `updated_at`

### Credential

Fields:

- `id`
- `organization_id`
- `vendor_id`
- `credential_type`
- `encrypted_secret`
- `status`
- `last_used_at`
- `created_at`

### Vendor

Fields:

- `id`
- `organization_id`
- `name`
- `website`
- `category`
- `renewal_date`
- `monthly_cost`
- `owner`

### Workflow

Fields:

- `id`
- `organization_id`
- `agent_id`
- `name`
- `template`
- `status`
- `created_at`

### Workflow Run

Fields:

- `id`
- `workflow_id`
- `agent_id`
- `status`
- `started_at`
- `completed_at`
- `result_summary`
- `error_message`

### Action Attempt

Fields:

- `id`
- `workflow_run_id`
- `agent_id`
- `website`
- `action_type`
- `risk_level`
- `policy_decision`
- `approval_request_id`
- `created_at`

### Approval Request

Fields:

- `id`
- `organization_id`
- `action_attempt_id`
- `status`
- `requested_by_agent_id`
- `approver_user_id`
- `summary`
- `screenshot_url`
- `expires_at`
- `approved_at`
- `rejected_at`

### Receipt

Fields:

- `id`
- `workflow_run_id`
- `organization_id`
- `agent_id`
- `final_status`
- `summary`
- `timeline_json`
- `screenshots_json`
- `files_json`
- `created_at`

## 10. System Architecture

### High-Level Architecture

Components:

- Web dashboard.
- Backend API.
- Policy engine.
- Credential vault.
- Browser runtime worker.
- Approval service.
- Audit log service.
- Integration service.
- Database.
- Object storage.
- Queue.

### Suggested MVP Stack

Frontend:

- Next.js or React.
- Tailwind or shadcn/ui.

Backend:

- Node.js/TypeScript.
- PostgreSQL.
- Prisma or Drizzle ORM.

Browser automation:

- Playwright.

Queue:

- BullMQ with Redis.

Storage:

- S3-compatible storage for screenshots, receipts, downloaded files.

Auth:

- Clerk, Auth.js, or WorkOS later.

Secrets:

- Managed KMS if available.
- At minimum encrypted database fields for MVP.

Approvals:

- Slack API.
- Email fallback.

Deployment:

- Vercel for frontend.
- Render/Fly.io/Railway/AWS for workers.

## 11. Security Model

### Security Goals

- LLM never sees raw credentials.
- Agents only act inside policies.
- Every sensitive action is logged.
- Every high-risk action requires approval.
- Credentials can be revoked.
- Agents can be paused instantly.

### Security Controls

- Encryption at rest.
- Secrets isolated from LLM context.
- Role-based access control.
- Audit logging.
- Browser session isolation.
- Domain allowlists.
- Action classification.
- Approval thresholds.
- Session recording.
- Rate limits.
- API key scopes.

### MVP Security Minimum

Before giving this to real customers:

- HTTPS everywhere.
- Encrypted credentials.
- No raw secrets in logs.
- Per-org data isolation.
- Admin-only credential access.
- Receipt logs cannot be silently edited.

## 12. MVP Definition

### MVP Goal

Let a company safely run an AI agent that logs into a SaaS vendor portal, downloads an invoice, checks renewal information, and requests approval before changing anything.

### MVP Must-Have Features

- Organization signup.
- Create agent.
- Add vendor credential.
- Website allowlist.
- Basic policy rules.
- Controlled Playwright browser session.
- Invoice download workflow.
- Renewal check workflow.
- Dashboard and email approval.
- Receipt page.
- Audit log.

### MVP Nice-To-Have Features

- Gmail renewal detection.
- Seat usage detection.
- Cost savings report.
- PDF export.
- Public SDK.
- Multiple browser providers.

### MVP Non-Goals

Do not build initially:

- Universal agent marketplace.
- Full OAuth standard.
- Complex visual workflow builder.
- Enterprise SSO.
- Advanced ML risk scoring.
- Support for every website.
- Mobile app.

## 13. First Demo Script

### Demo Story

A founder connects AegisWeb to a vendor portal. The procurement agent logs in, downloads the invoice, detects a renewal price increase, proposes a downgrade, asks for Slack approval, performs the approved action, and generates a receipt.

### Demo Steps

1. Show dashboard with one agent: Procurement Bot.
2. Show policy: can read billing, download invoices, request approval for plan changes.
3. Start workflow: Check Notion renewal.
4. Browser opens controlled session.
5. Agent logs in.
6. Agent downloads invoice.
7. Agent detects renewal increasing from $800/month to $1,100/month.
8. Agent proposes downgrade.
9. Slack approval appears.
10. Human approves.
11. Agent completes action.
12. Receipt appears with screenshots, timestamps, and approval record.

## 14. Go-To-Market

### Initial Positioning

Do not start by saying:

> We are building trust infrastructure for the agentic web.

That sounds too abstract.

Start by saying:

> We help startups safely let AI agents manage SaaS invoices and renewals without giving them unrestricted passwords or credit cards.

Then explain the bigger infrastructure vision.

### Early Outreach Message

Subject:

`Do you trust AI agents with SaaS renewals yet?`

Message:

> Hey, I’m building AegisWeb: a permission and approval layer for AI agents that manage SaaS vendor portals. The first use case is downloading invoices, checking renewals, and preparing cancellations/downgrades with human approval before anything risky happens. Are SaaS renewals or vendor portals annoying enough at your company that you’d try this?

### First 30 Customer Calls

Call targets:

- Startup founders.
- Finance leads.
- Ops managers.
- AI agent builders.

Questions:

- How many SaaS vendors do you manage?
- Who handles invoices and renewals?
- How do you track cancellation dates?
- Have you been surprised by renewals?
- Would you let an AI agent log into vendor portals?
- What would make that safe?
- What actions should always require approval?
- Would you pay for this?

### Traction Goals Before YC Application

Ideal:

- 30 customer calls.
- 5 design partners.
- 3 active pilots.
- 1 paying customer.
- 100+ completed agent actions.
- One clear ROI story.

Example ROI:

> AegisWeb found $12,400/year in unused SaaS renewals and safely executed 16 invoice/renewal workflows with approval logs.

## 15. Pricing

### MVP Pricing

Starter:

- $299/month.
- 3 agents.
- 20 vendors.
- 500 actions/month.

Business:

- $999/month.
- 10 agents.
- 100 vendors.
- Slack approvals.
- Audit exports.
- More actions.

Enterprise:

- Custom.
- SSO.
- Compliance.
- Private deployment.
- Advanced policy controls.

### Early Pilot Pricing

For first customers:

- $200-$500/month.
- Or paid pilot at $1,000 for 30 days.

The goal is not maximum revenue at first. The goal is proof that someone will pay.

## 16. Competitive Landscape

### Existing Categories

- Browser automation platforms.
- Web scraping APIs.
- AI agent frameworks.
- RPA tools.
- Identity providers.
- Password managers.
- SaaS management platforms.
- Procurement tools.

### Differentiation

AegisWeb is not:

- another browser agent
- another scraper
- another password manager
- another SaaS spend dashboard
- another agent framework

AegisWeb is:

- agent identity
- agent permissions
- human approvals
- action receipts
- auditability
- trust infrastructure

### Core Differentiator

The product controls authority, not just execution.

## 17. Risks

### Risk 1: The Product Sounds Too Abstract

Fix:

Always lead with SaaS renewal automation.

### Risk 2: Website Automation Is Brittle

Fix:

Start with a few common vendors. Use human-in-the-loop fallback. Sell the trust layer, not perfect universal automation.

### Risk 3: Security Trust Is Hard

Fix:

Start with low-risk workflows: invoice downloads and renewal checks. Add risky actions only with approval.

### Risk 4: Browser-Agent Companies Build This Themselves

Fix:

Be neutral infrastructure across many agent/browser providers. Build the compliance/audit layer deeper than any one framework wants to.

### Risk 5: Procurement Is Crowded

Fix:

Do not position as procurement software. Position as permissioned agent operations, with procurement as the first workflow.

## 18. Roadmap

### Phase 0: Validation

Timeline: 1 week

- Landing page.
- 30 customer calls.
- Manual demos.
- 3 design partner commitments.

### Phase 1: MVP

Timeline: 2-4 weeks

- Dashboard.
- Agent identity.
- Basic policy engine.
- Credential vault.
- Playwright runtime.
- Slack approval.
- Receipt page.
- First vendor workflows.

### Phase 2: Paid Pilots

Timeline: 4-8 weeks

- 3-5 customers.
- More vendor support.
- Better audit exports.
- Billing.
- Workflow reliability.

### Phase 3: Developer Platform

Timeline: 2-4 months

- Public API.
- SDK.
- Agent framework integrations.
- Policy-as-code.
- Webhooks.

### Phase 4: AegisWeb Network

Timeline: 6-18 months

- Agent identity standard.
- Website-side integration.
- Agent reputation.
- Compliance marketplace.
- Enterprise controls.

## 19. Build Checklist

### Frontend

- Sign in.
- Organization setup.
- Dashboard.
- Agents page.
- Create agent form.
- Policies page.
- Credentials page.
- Workflow runs page.
- Receipt page.
- Approval page.

### Backend

- Auth.
- Organization model.
- User roles.
- Agent CRUD.
- Policy CRUD.
- Credential vault.
- Workflow run creation.
- Action attempt API.
- Approval API.
- Receipt generation.
- Audit logging.

### Worker

- Playwright browser worker.
- Credential injection.
- Screenshot capture.
- Action tracing.
- Policy check calls.
- Download handling.
- Workflow status updates.

### Integrations

- Slack approval app.
- Email notification.
- Optional Gmail parser.

### Security

- Secret encryption.
- Log redaction.
- Org isolation.
- API auth.
- Admin permissions.

## 20. YC Application Narrative

### What Are You Making?

We are building AegisWeb, the permission layer for AI agents on the web. Companies want agents to log into vendor portals, download invoices, manage renewals, and take operational actions, but they cannot safely give agents unrestricted passwords or payment access. AegisWeb gives every agent a controlled identity, scoped permissions, approval workflows, and audit receipts.

### Why Is This Needed?

Agents are becoming capable of using websites, but businesses cannot trust them with authority. The web has no native permission model for AI agents.

### Why Now?

AI agents recently became good enough to operate browsers. The next blocker is trust, not capability.

### Who Is The First Customer?

Startups and mid-market companies with finance/ops teams that manage many SaaS vendors.

### What Is The Big Vision?

If agents become common web users, every company will need a way to control what agents can do, and every website will need a way to recognize trusted agent identities. AegisWeb can become the identity and authorization layer for the agentic web.

## 21. The Final Concept

AegisWeb starts as:

> A safe way to let AI agents manage SaaS invoices and renewals.

AegisWeb becomes:

> The trust infrastructure for AI agents acting on the web.

The wedge is practical. The vision is massive. That is the balance we want for YC.
