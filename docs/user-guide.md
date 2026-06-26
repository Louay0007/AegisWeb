# AegisWeb User Guide

AegisWeb is the control gateway for AI agents acting on vendor web portals. Users approve risky actions, inspect evidence, and trust receipts without exposing credentials.

## Core Concepts

- **Agent**: A governed automation identity with a purpose and status.
- **Vendor**: A SaaS or web portal the agent may access.
- **Credential**: A vault-stored secret granted to specific agents.
- **Policy**: Rules that allow, deny, pause, or require approval for actions.
- **Workflow**: A repeatable task using an agent, vendor, credential, and template.
- **Run**: One execution of a workflow.
- **Approval**: A human decision point for risky or policy-controlled actions.
- **Receipt**: Evidence generated after a completed, failed, denied, or canceled run.
- **Audit event**: Immutable event record with hash-chain integrity.

## Daily Workflow

1. Open **Home** to check active runs, pending approvals, and recent receipts.
2. Review **Approvals** when an agent pauses for a decision.
3. Inspect run evidence before approving high-risk actions.
4. Use **Receipts** to verify what happened after a run finishes.
5. Use **Audit** to trace who changed what and when.

## Approving Work

Before approving, review:

- Vendor and workflow name
- Agent identity
- Requested action
- Risk level
- Policy trigger
- Screenshots or files, if present

Approve only when the request matches the expected business intent.

## Receipts

Receipts summarize:

- Final status
- Workflow and agent
- Vendor
- Files produced
- Approval decisions
- Audit references

If a receipt looks incomplete, open the related run and audit trail before relying on it.

## Credential Safety

Users never need to copy secrets into chat, tickets, or screenshots. Store credentials in the vault and grant them only to the agents that need them.

## Getting Help

- Use the in-app feedback widget for product feedback.
- Email support@aegisweb.com for operational support.
- Check https://status.aegisweb.com for incidents.
