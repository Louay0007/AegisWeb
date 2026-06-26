# AegisWeb Admin Guide

This guide is for workspace owners and administrators responsible for users, security settings, and pilot operations.

## Workspace Setup

Open **Settings** and confirm:

- Organization name
- Workspace slug/domain
- Billing email
- Plan information

## User Management

Admins can invite users, change roles, and disable accounts.

Roles:

- **Owner**: Full workspace control and organization settings.
- **Admin**: User and operational management without owner-only controls.
- **Approver**: Can review and decide approvals.
- **Auditor**: Read-only evidence and audit access.
- **Developer**: Builds and runs governed workflows.

Recommended pilot setup:

- 1-2 Owners
- 1 Admin
- 2+ Approvers
- 1 Auditor or security reviewer

## Security Configuration

Owners and admins should require MFA for high-privilege users.

Checklist:

- MFA enabled for owners, admins, and approvers.
- Disabled users reviewed weekly.
- Active sessions reviewed after role changes.
- Credentials granted only to required agents.
- Policies reviewed before production-like runs.

## Notification Preferences

Each user can control email notifications for:

- Approval requests
- Run completions
- Failures

Approval recipients should keep approval request notifications enabled during pilots.

## Operating a Pilot

Before each weekly check-in, export or review:

- Workflow success rate
- Pending and completed approvals
- Failed runs by reason
- Receipt integrity issues
- Credential usage events
- Product feedback submissions

## Incident Handling

For suspected credential exposure or unauthorized action:
1. Pause affected agents.
2. Revoke affected credentials.
3. Review audit events and receipts.
4. Rotate secrets using `docs/secret-rotation-runbook.md`.
5. Follow `docs/incident-response-plan.md`.

## Support

- Email: support@aegisweb.com
- Status: https://status.aegisweb.com
