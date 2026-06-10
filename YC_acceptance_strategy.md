# YC-Focused Startup Strategy And Idea

Generated: 2026-06-06

## Important Reality Check

No idea can be guaranteed to be accepted by Y Combinator. YC accepts teams, evidence, speed, insight, and market timing, not just clever concepts. The goal is therefore not to produce a magical "accepted idea"; it is to produce an idea with the strongest YC-shaped profile and a concrete plan to create proof before the application.

## Dataset Read

This analysis uses the local dataset `yc_recent_startups_2023_2026.csv`, covering 1,840 public YC directory companies from Summer 2023 through Summer 2026.

### Main Signals

| Signal | Dataset Result | Interpretation |
|---|---:|---|
| Total companies analyzed | 1,840 | Large enough to see recent YC preference patterns |
| B2B startups | 1,189 | YC has heavily favored B2B in this window |
| AI-related startups | 1,496 | AI is no longer a category; it is the default substrate |
| Median team size | 3 | Small, fast technical teams are normal |
| Top industry | B2B | Enterprise/internal workflow pain is the clearest theme |
| Top subcategory | B2B -> Engineering, Product and Design | Dev tools and AI engineering workflows are very hot |
| Top tags | AI, B2B, SaaS, Developer Tools, Generative AI | YC likes technical leverage and software distribution |

### Strongest Recent YC Themes

1. AI agents are moving from demos to production.
2. Developer tools and AI infrastructure are saturated but still fundable when the wedge is sharp.
3. Workflow automation is attractive when it replaces paid labor or creates a new primitive.
4. Compliance, auditability, and reliability are rising because agents are beginning to take real actions.
5. "Browser agents" and "API for websites" are crowded in recent YC batches, so a new company needs a differentiated layer.

## The Startup Idea

Name placeholder: **AgentPass**

One-liner:

**AgentPass is the identity, permissions, and audit layer that lets AI agents safely take actions on the web.**

Short version:

Today, AI agents can browse websites, scrape data, and sometimes click buttons. But businesses cannot safely let agents log in, buy things, submit forms, update records, or make commitments because there is no web-native permission system for non-human actors. AgentPass gives each agent a verified identity, scoped permissions, approval rules, payment limits, and cryptographic receipts for every web action.

## Why This Is A YC-Shaped Idea

### It sits exactly where the dataset points

The CSV shows that recent YC batches are full of AI, B2B, developer tools, infrastructure, automation, compliance, and agent companies. However, the crowded zone is "build a browser agent" or "make an API for any website." AgentPass avoids being the 20th browser-agent company by becoming the trust layer all of those companies need.

### It is bigger than a feature

If AI agents become common web users, the web needs new infrastructure:

- agent identity
- delegated permissions
- audit logs
- action receipts
- payment limits
- policy enforcement
- bot-vs-agent distinction
- human approval flows
- revocation
- compliance exports

That is not a chatbot. It is a web primitive.

### It has a narrow wedge

Start with one painful use case:

**AI procurement agents for SMB and mid-market companies.**

These agents need to:

- log in to vendor portals
- compare quotes
- renew subscriptions
- update billing details
- buy SaaS seats
- download invoices
- cancel unused tools
- submit support requests
- track approvals

Companies want the automation, but founders, finance teams, and ops leaders do not want an autonomous agent with raw passwords and credit cards. AgentPass gives them the control layer.

## Product

### V1: Hosted Agent Vault

A secure web app where a company creates an agent identity and grants it limited abilities.

Example policy:

> Agent `procurement-bot@company.com` can log in to approved vendor portals, download invoices, request quotes, and prepare purchases under $500. Purchases over $500 require Slack approval. It cannot change bank details, delete accounts, or invite new admins.

Core features:

- agent identities
- credential vault
- website allowlist
- permission scopes
- spending limits
- approval requests in Slack/email
- action replay
- tamper-resistant audit log
- browser session recording
- receipts for each action
- API for browser-agent frameworks

### V2: Agent Checkout And Delegated Web Sessions

For websites that want to support agents directly:

- "Sign in with AgentPass"
- agent-scoped OAuth-style login
- no password sharing
- scoped actions like `read_invoice`, `create_order`, `cancel_subscription`
- signed receipts sent back to the human owner
- rate limits and abuse protection

### V3: The Agent Trust Network

Once enough agents and websites use the system, AgentPass becomes a reputation and trust graph:

- verified agent developers
- verified companies
- fraud detection
- cross-site permission standards
- compliance reporting
- agent action insurance layer

## Ideal First Customers

The best first customers are not Fortune 500 enterprises. They are fast-moving companies already using AI agents internally and feeling the risk.

Target profiles:

- 20-500 person SaaS companies
- AI-native startups
- finance/ops teams managing many vendor portals
- procurement teams drowning in SaaS renewals
- AI agent startups that need an enterprise-grade control layer
- browser-agent companies that need trust/audit infrastructure

First buyer:

Head of Operations, Finance Lead, or Founder.

First user:

Ops/finance person who currently handles vendor portals manually.

## MVP In 30 Days

### Week 1: Customer Discovery

Talk to 30 companies:

- 10 YC or VC-backed startups
- 10 finance/ops leaders
- 10 AI-agent builders

Ask:

- What web workflows do you want agents to do but do not trust them to do?
- What credentials would you never give an agent?
- What approval/audit would make you comfortable?
- What task do you pay someone to do manually every week?
- What would you pay to make this safe?

Goal:

Find 3 design partners with a repeated workflow.

### Week 2: Build The First Narrow Workflow

Build one vertical demo:

**Agent-controlled SaaS invoice and renewal manager.**

Capabilities:

- connect Gmail/Slack
- identify vendor renewal emails
- log into vendor portals through a controlled browser session
- download invoices
- detect renewal price increases
- prepare cancellation/downgrade/change requests
- ask for human approval before submitting
- produce audit log and receipt

### Week 3: Productionize The Trust Layer

Build:

- agent identity
- vault
- action log
- approval policy engine
- replay UI
- Slack approval
- spending/action limits
- exportable audit report

### Week 4: Get Traction

Target metrics before YC application:

- 3-5 active design partners
- 100+ successful agent actions
- at least 1 paying customer, even at $200-$1,000/month
- 1 quantified ROI case, e.g. "saved 8 hours/week" or "caught $12k in unwanted renewals"
- 2 agent-builder integrations or public SDK usage

## YC Application Positioning

### What are you making?

We are building the identity and permission layer for AI agents on the web. Companies want agents to buy, book, submit, renew, and operate across websites, but today they must either share raw passwords/cards or block agents from taking real actions. AgentPass gives every agent a scoped identity, approval policy, credential vault, spending limit, and audit trail. Our first wedge is procurement agents for SaaS renewals and vendor portals.

### Why now?

AI agents are finally good enough to use websites, but the web has no permission model for non-human actors. The next bottleneck is not browsing; it is trust. Before agents can run real business workflows, companies need identity, delegated authority, approvals, receipts, and revocation.

### Who needs this badly?

Ops and finance teams at fast-growing companies. They manage dozens or hundreds of SaaS vendors through fragmented web portals. They want automation, but they cannot give an autonomous agent unrestricted credentials and payment access.

### Why will this become huge?

If AI agents become common, every company will need a way to control what agents can do online, and every website will need a way to distinguish trusted agents from abusive bots. That makes AgentPass a horizontal layer for the agentic web.

### What is the wedge?

Start with SaaS vendor management: invoices, renewals, quote collection, seat changes, cancellation flows, and approval-gated purchases.

### What is the unfair insight?

Browser agents are not blocked mainly by intelligence. They are blocked by authority. A mediocre agent with safe permissions is more deployable than a brilliant agent with raw credentials and no audit trail.

## Competitive Positioning

Crowded area:

- generic browser agents
- web scraping APIs
- "API for any website"
- AI agent orchestration
- LLM observability

AgentPass positioning:

- not another browser
- not another scraping API
- not another agent framework
- the permission, identity, approval, and audit layer underneath agent actions

Analogy:

- Browserbase/Skyvern/Notte/StableBrowse-like products help agents use websites.
- AgentPass helps companies decide what those agents are allowed to do and prove what happened.

## Pricing

Start simple:

- Free developer tier: 1 agent, 100 actions/month
- Startup plan: $299/month, 5 agents, 2,000 actions/month
- Business plan: $999/month, approval workflows, audit exports, Slack, SSO
- Enterprise: custom, compliance, private deployment, advanced policy controls

For procurement wedge:

- Charge based on vendors monitored and agent actions completed.
- Add success fee for recovered/canceled unwanted spend later, but do not start there.

## Why YC Might Like It

Strong YC signals:

- huge market if agentic web happens
- technical but sellable quickly
- clear B2B pain
- can start tiny
- can show traction fast
- has API/platform potential
- creates a new primitive rather than a thin wrapper
- connects to many recent YC themes without directly copying them

Main risk:

It can sound too abstract.

Fix:

Lead with the concrete wedge: "We help companies safely let AI agents manage SaaS invoices and renewals across vendor websites."

Then explain the bigger trust layer.

## What To Build Tonight

Build a demo with these pieces:

1. Dashboard: create an agent identity.
2. Policy editor: allowed sites, allowed actions, approval thresholds.
3. Controlled browser run: agent logs into a SaaS portal and downloads an invoice.
4. Slack approval: asks before changing plan/canceling/buying.
5. Receipt: shows exactly what happened, with screenshot, DOM/action trace, timestamp, actor, and approval.

The demo should feel real even if some parts are manual behind the scenes.

## The Best YC Pitch

**"AI agents can browse the web, but companies cannot trust them to act. We are building the permission layer for the agentic web, starting with procurement agents that manage SaaS renewals and vendor portals."**

## 7-Day Execution Plan

Day 1:

- Landing page
- 20 outreach messages
- clickable Figma/demo or rough product UI

Day 2:

- Build credential vault prototype
- Build policy object model
- Record first browser action

Day 3:

- Slack approval flow
- Audit log UI
- First vendor portal workflow

Day 4:

- Talk to 10 ops/finance users
- Manually run workflow for 2 design partners

Day 5:

- Add second workflow
- Create SDK stub for agent frameworks

Day 6:

- Convert 1 design partner to paid pilot
- Write YC application draft

Day 7:

- Record a 60-second demo
- Publish technical blog post: "Agents Need Permissions, Not Passwords"

## Final Recommendation

Apply with AgentPass only after you have one concrete customer workflow and proof that someone will use it. YC will not be impressed by "agentic web infrastructure" alone. They may be impressed by:

> "We talked to 37 ops/finance teams, 12 already use AI agents internally, 5 asked for this, 3 are piloting, and one is paying us $500/month to let an agent handle vendor invoices and renewals with human approval."

That is the version that has teeth.
