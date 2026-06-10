# Phase 28 Completion Notes: NotificationsModule

Implemented: 2026-06-06

## Summary

Phase 28 adds local approval-request email notifications.

When an internal worker creates an approval request, the API now builds an approval email, sends it through local SMTP, and records the notification outcome in the approval audit payload. Delivery failure does not block workflow execution or approval creation.

## Added Files

```text
apps/api/src/notifications/approval-email.builder.ts
apps/api/src/notifications/email-notification.adapter.ts
apps/api/src/notifications/index.ts
apps/api/src/notifications/notification.service.ts
apps/api/src/notifications/notifications.module.ts
apps/api/src/notifications/notifications.types.ts
tests/phase28-notifications.spec.ts
docs/PHASE_28_COMPLETION_NOTES.md
```

## Updated Files

```text
.env.example
apps/api/src/app.module.ts
apps/api/src/approvals/approvals.module.ts
apps/api/src/approvals/approvals.service.ts
apps/api/src/approvals/index.ts
apps/api/src/config/config.service.ts
tests/phase3-api-foundation.spec.ts
```

## Configuration

Added:

```text
DASHBOARD_BASE_URL=http://localhost:4200
```

Existing local mail settings are used:

```text
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=AgentPass Local <agentpass@localhost>
```

## Notification Flow

Approval request creation now:

1. Creates the pending approval.
2. Loads approval context with workflow, agent, vendor, and action attempt metadata.
3. Finds active owner and approver users in the organization.
4. Builds a local email containing summary, risk, amount, policy reason, matched rules, and dashboard link.
5. Sends the email through local SMTP.
6. Records delivery result in the `approval_requested` audit event.

If SMTP fails, approval creation still succeeds and the audit payload includes `notification.delivered: false` with a warning.

## Email Safety

The email builder intentionally includes approval context and matched policy rules, not raw credential material.

Secret-like policy fields are excluded from email content, including values under keys such as:

```text
token
password
secret
authorization
cookie
credential
```

## Tests

Added:

```text
tests/phase28-notifications.spec.ts
```

Coverage:

- Approval email is sent through a mocked SMTP adapter.
- Active owners and approvers receive the email.
- Auditors and disabled approvers do not receive the email.
- Email contains the approval dashboard link.
- Email excludes secret policy values.
- SMTP failure does not break approval creation.
- SMTP failure records an audit warning.

## Acceptance

Phase 28 acceptance is satisfied:

- Local approval notifications are wired to approval request creation.
- Emails are compatible with Mailpit through local SMTP.
- Notification failures are non-blocking.
- Notification outcome is auditable.
- Notification content avoids raw secrets.
