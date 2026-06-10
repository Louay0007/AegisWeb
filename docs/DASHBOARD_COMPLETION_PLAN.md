# AegisWeb Dashboard Completion Plan

Generated: 2026-06-07

Source files reviewed:

- `docs/FRONTEND_DESIGN_SPEC.md`
- `docs/DASHBOARD_IMPLEMENTATION_PLAN.md`
- `apps/web/app/app/*`
- `apps/web/components/app-shell/*`
- `apps/web/components/dashboard/home-dashboard.tsx`
- `apps/web/components/dashboard/list-pages.tsx`
- `apps/web/components/product/*`
- `apps/web/components/data/*`
- `apps/web/components/display/*`
- `apps/web/components/evidence/*`
- `apps/web/lib/fixtures/dashboard.ts`

## 1. Goal

Complete the AegisWeb protected dashboard so every product route feels like a real operational surface before the final API/auth integration pass.

The dashboard must support the core MVP demo:

1. Owner signs in.
2. Owner starts `Acme Downgrade Request`.
3. Run moves through queued/running/waiting states.
4. Approver reviews policy, evidence, and run context.
5. Approver approves or rejects.
6. Run completes or is denied.
7. Receipt shows the final trust artifact.
8. Audit exposes the technical event trail.

## 2. Current Dashboard State

Implemented:

- Product shell under `/app`.
- Sidebar navigation.
- Topbar with current page title, refresh button, pending approvals button, user menu.
- Mobile navigation.
- Skip link.
- Demo session fallback.
- Routes:
  - `/app/home`
  - `/app/agents`
  - `/app/agents/[agentId]`
  - `/app/vendors`
  - `/app/vendors/[vendorId]`
  - `/app/credentials`
  - `/app/credentials/[credentialId]`
  - `/app/policies`
  - `/app/policies/[policyId]`
  - `/app/workflows`
  - `/app/workflows/[workflowId]`
  - `/app/runs`
  - `/app/runs/[runId]`
  - `/app/approvals`
  - `/app/approvals/[approvalId]`
  - `/app/receipts`
  - `/app/receipts/[receiptId]`
  - `/app/audit`
  - `/app/settings`
- Fixture-backed dashboard data.
- Management pages for agents, vendors, credentials, policies, and workflows.
- Detail screens for workflow runs, approvals, and receipts.
- Basic data/display/evidence primitives.

Main gaps:

- Start workflow flow does not yet create or simulate a run.
- Dashboard home is useful but not yet the command center for the full demo loop.
- Missing dedicated `WorkflowRunStatusBadge`.
- Missing reusable `ScreenshotViewer`, `ReceiptTimeline`, and `AuditEventDrawer`.
- Tables lack full empty/loading/error/mobile-card states.
- Approval and receipt details contain evidence UI, but some parts should be extracted into reusable evidence components.
- Audit page needs filters, drawer, and redacted JSON inspection.
- API client, auth boot, refresh-cookie flow, permissions, and polling are not complete.

## 3. Product UI Direction

The dashboard should feel like a controlled evidence room:

- Monochrome, precise, quiet.
- Evidence-first.
- Dense enough for operators, not cramped.
- Security serious: no plaintext secrets, no encrypted payload display, no token display.
- Risky actions require explicit confirmation.
- Status color is only a small accent; icon plus text is required.
- Use the landing/auth visual rhythm, but avoid marketing hero layouts inside the app.

Avoid:

- Generic admin template styling.
- Decorative gradients, blobs, or loud colors.
- Nested cards.
- Large hero typography inside product panels.
- Any UI that suggests credentials are visible or recoverable.

## 4. Design Rules

Use semantic Tailwind tokens:

- `bg-background`
- `text-foreground`
- `bg-muted`
- `text-muted-foreground`
- `bg-primary`
- `text-primary-foreground`
- `border-border`
- `ring-ring`
- `text-destructive`

Dashboard component rules:

- Product panels: `rounded-lg border border-border bg-background`.
- Prefer borders over shadows.
- Use `tabular-nums` for counters, prices, run durations, dates, and hashes.
- Use `text-balance` for page headings.
- Use `text-pretty` for descriptions.
- Use `lucide-react` icons.
- Use `min-h-10` or `h-10` for normal controls.
- Use 44px touch targets on mobile decision actions.
- Use explicit transitions, not `transition-all`.

## 5. Shared Components To Complete

### 5.1 Display

Already present:

- `components/display/status-badge.tsx`
- `components/display/risk-level-badge.tsx`
- `components/display/policy-decision-badge.tsx`
- `components/display/hash-integrity-indicator.tsx`

Add:

```text
components/display/workflow-run-status-badge.tsx
components/display/role-badge.tsx
```

`WorkflowRunStatusBadge` requirements:

- Values: queued, running, waiting, approved, rejected, completed, failed, denied, canceled.
- Icon plus label.
- Compact and regular size.
- Running state uses a tiny pulse/spinner.
- `aria-live="polite"` when used in live run surfaces.
- Unknown values render `Unknown`.

`RoleBadge` requirements:

- Roles: Owner, Admin, Approver, Auditor, Developer.
- Neutral monochrome base.
- Small icon or initial.
- No role should rely on color alone.

### 5.2 Data

Already present:

- `components/data/data-table.tsx`
- `components/data/entity-list.tsx`
- `components/data/metric-tile.tsx`
- `components/data/search-input.tsx`
- `components/data/timeline.tsx`

Add or upgrade:

```text
components/data/filter-bar.tsx
components/data/pagination-controls.tsx
components/data/state-panel.tsx
```

`DataTable` upgrades:

- Keyboard row activation.
- Empty state.
- Loading skeleton.
- Error state with retry action.
- Mobile card-list fallback.
- Stable row heights.
- Optional row action menu.

`FilterBar` requirements:

- Search slot.
- Status/risk/vendor filters.
- Clear filters action.
- Works stacked on mobile.

`PaginationControls` requirements:

- Previous/next.
- Page count.
- Result count.
- Disabled states.

`StatePanel` requirements:

- Reusable empty/loading/error block.
- Icon plus concise copy.
- Optional action.

### 5.3 Evidence

Already present:

- `components/evidence/evidence-summary.tsx`
- `components/evidence/file-list.tsx`

Add:

```text
components/evidence/screenshot-viewer.tsx
components/evidence/receipt-timeline.tsx
components/evidence/audit-event-drawer.tsx
components/evidence/policy-evidence-panel.tsx
```

`ScreenshotViewer` requirements:

- 16:9 reserved frame.
- Sensitive evidence label.
- Timestamp and source URL/domain metadata.
- Thumbnail strip when multiple screenshots exist.
- Keyboard previous/next.
- Fullscreen dialog.
- Never load real screenshots until visible when API-backed.

`ReceiptTimeline` requirements:

- Group phases:
  - Initialization
  - Browser actions
  - Policy decision
  - Approval
  - Receipt generation
- Each event has time, actor, status, summary, optional hash.
- Mobile-friendly stacked layout.

`AuditEventDrawer` requirements:

- Uses shadcn `Sheet`.
- Opens from audit table row.
- Shows event metadata.
- Shows redacted JSON payload in escaped `pre`.
- Copy event ID/hash actions.
- Secret-like keys visibly redacted.

`PolicyEvidencePanel` requirements:

- Shows decision, risk, matched rules, policy version.
- Clear reason for allow/deny/approval-required.
- Links to policy detail.

### 5.4 Forms

Add:

```text
components/forms/field.tsx
components/forms/password-input.tsx
components/forms/currency-input.tsx
components/forms/form-actions.tsx
components/forms/confirm-dialog.tsx
components/forms/radio-card-group.tsx
components/forms/action-matrix.tsx
```

Requirements:

- Every input has visible label.
- Errors connect with `aria-describedby`.
- Errors use `role="alert"`.
- Secret values are write-only.
- Existing credentials are never prefilled.
- Destructive actions require confirmation.
- Buttons support loading and disabled states.

## 6. Product Components To Complete

Add or extract:

```text
components/product/start-workflow-flow.tsx
components/product/workflow-readiness-panel.tsx
components/product/live-run-panel.tsx
components/product/approval-decision-panel.tsx
components/product/receipt-summary-panel.tsx
components/product/agent-identity-card.tsx
components/product/vendor-summary-card.tsx
components/product/policy-summary-card.tsx
components/product/credential-grant-list.tsx
components/product/workflow-template-card.tsx
components/product/run-status-strip.tsx
```

Priority product components:

1. `StartWorkflowFlow`
2. `WorkflowReadinessPanel`
3. `LiveRunPanel`
4. `ScreenshotViewer`
5. `ReceiptTimeline`
6. `AuditEventDrawer`

## 7. Fixtures To Split And Expand

Current state:

- Most fixtures live in `apps/web/lib/fixtures/dashboard.ts`.

Target:

```text
apps/web/lib/fixtures/
  dashboard.ts
  agents.ts
  vendors.ts
  credentials.ts
  policies.ts
  workflows.ts
  workflow-runs.ts
  approvals.ts
  receipts.ts
  audit-events.ts
```

Fixture expansion requirements:

- Include active, paused, revoked, failed, completed, denied, and waiting states.
- Include long IDs and long vendor names to test wrapping.
- Include at least one empty-state scenario per page.
- Include evidence screenshots as placeholder metadata, not decorative files.
- Include realistic Northstar Labs / Acme Analytics demo data.
- Never include real secrets.

## 8. Dashboard Home Completion

Current dashboard home sections:

- Metrics row.
- Active workflow runs.
- Approval queue.
- Current evidence timeline.
- Recent receipts.
- Risk events.

Make `/app/home` the operating center.

Add:

- Start workflow button opens `StartWorkflowFlow`.
- Pending approval count links to approvals.
- Active run preview links to live run.
- Risk events preview opens `AuditEventDrawer`.
- Recent receipts show hash integrity marker.
- Loading, empty, and error states.
- Role-aware callouts:
  - Owner: start workflow, manage policies/credentials.
  - Approver: review pending approvals.
  - Auditor: inspect receipts and audit.
  - Developer: inspect API/event surfaces.

Home acceptance:

- User can understand what is happening in under 10 seconds.
- The primary CTA is obvious.
- Pending approval and active run are visually dominant.
- Mobile layout has no overlapping panels.
- All cards link to the correct detail pages.

## 9. Page Completion Plan

### Phase 1: Workflow Start And Live Run

Routes:

- `/app/workflows`
- `/app/workflows/[workflowId]`
- `/app/runs/[runId]`

Build:

- `StartWorkflowFlow`.
- `WorkflowTemplateCard`.
- `WorkflowReadinessPanel`.
- `LiveRunPanel`.
- `WorkflowRunStatusBadge`.

Start flow steps:

1. Select template.
2. Select agent.
3. Select vendor.
4. Confirm policy summary.
5. Confirm credential grant readiness.
6. Start fixture run.
7. Navigate to run detail.

Run detail states:

- Queued.
- Running.
- Waiting for approval.
- Completed.
- Failed.
- Denied.

Acceptance:

- The flagship Acme downgrade workflow can be started from UI fixtures.
- The run detail shows a believable live status progression.
- Waiting state links to approval detail.
- Status updates use `aria-live="polite"`.

### Phase 2: Approvals

Routes:

- `/app/approvals`
- `/app/approvals/[approvalId]`

Upgrade:

- Queue tabs: pending, approved, rejected, expired, all.
- Decision panel extracted to `ApprovalDecisionPanel`.
- Evidence panel uses `ScreenshotViewer` and `PolicyEvidencePanel`.
- Reject requires comment.
- Approve/reject state persists locally during the session.
- Mobile sticky decision bar remains.

Acceptance:

- This is the highest-quality decision screen.
- A human can decide from policy, screenshot, matched rules, and run context.
- Approve/reject actions are visually and semantically distinct.

### Phase 3: Receipts

Routes:

- `/app/receipts`
- `/app/receipts/[receiptId]`

Upgrade:

- Use `ReceiptTimeline`.
- Use `ScreenshotViewer`.
- Make hash/copy interactions consistent.
- Add receipt export preview button state.
- Add approval record block.
- Add credential usage marker.

Acceptance:

- Receipt feels like a final trust artifact.
- Timeline is grouped and easy to audit.
- Files, screenshots, policy, approval, and hash integrity are visible.

### Phase 4: Audit

Route:

- `/app/audit`

Upgrade:

- `FilterBar`.
- Event type filter.
- Actor filter.
- Date range placeholder.
- Row opens `AuditEventDrawer`.
- Redacted JSON payload.
- Copy event ID/hash.
- Empty/loading/error states.

Acceptance:

- Audit is searchable and inspectable.
- Secret-like keys are redacted.
- Drawer is usable on mobile.

### Phase 5: Policies

Routes:

- `/app/policies`
- `/app/policies/[policyId]`

Upgrade:

- Action matrix.
- Website allowlist editor.
- Blocked domains editor.
- Spending thresholds.
- Business hours.
- Danger keywords.
- Policy test panel.
- Dirty state.
- Sticky save bar.

Acceptance:

- Authority is visible and testable.
- Test panel explains allow/deny/approval-required.

### Phase 6: Credentials

Routes:

- `/app/credentials`
- `/app/credentials/[credentialId]`

Upgrade:

- Add credential dialog.
- Grant credential to agent dialog.
- Revoke grant confirmation.
- Revoke credential confirmation.
- Usage history.
- Credential health marker.

Acceptance:

- No plaintext secret is displayed.
- Existing secret values never appear.
- Write-only secret input is obvious.

### Phase 7: Agents And Vendors

Routes:

- `/app/agents`
- `/app/agents/[agentId]`
- `/app/vendors`
- `/app/vendors/[vendorId]`

Upgrade:

- Better filters.
- Agent identity cards.
- Vendor renewal risk cards.
- Related workflows, credentials, policies, runs.
- Pause/resume/revoke flows with confirmation.

Acceptance:

- Agent and vendor pages explain operational ownership and risk.
- Terminal states are clear.

### Phase 8: Settings

Route:

- `/app/settings`

Build:

- Organization profile.
- Users and roles.
- Local environment status.
- Notification settings placeholder.
- API docs link.

Acceptance:

- Owner-only controls are separated.
- Local system status is scannable.

## 10. API/Auth Integration Plan

Do this after fixture UI is complete.

Create:

```text
apps/web/lib/api/api-client.ts
apps/web/lib/api/api-errors.ts
apps/web/lib/api/query-keys.ts
apps/web/lib/api/pagination.ts
apps/web/lib/auth/auth-session.tsx
apps/web/lib/auth/token-storage.ts
apps/web/lib/permissions/permissions.ts
apps/web/components/auth/can.tsx
```

API client rules:

- Base URL from `NEXT_PUBLIC_API_URL`, fallback `http://localhost:3001`.
- Include `credentials: "include"` where refresh cookie is needed.
- Add `X-Request-ID`.
- Normalize `{ data, meta }`.
- Normalize `{ error: { code, message, requestId } }`.
- `401`: refresh once, then redirect to login.
- `403`: permission feedback.
- `404`: not found state.
- `409`: inline conflict state.
- `422`: map validation errors to fields.
- `5xx`: recovery state with request ID.

Auth boot:

1. Start booting.
2. Try `/auth/me`.
3. If missing/expired, call `/auth/refresh`.
4. Retry `/auth/me`.
5. If unauthorized, redirect to `/login`.

Polling:

- Dashboard metrics: 30 seconds.
- Pending approvals: 30 seconds.
- Active run detail: 2 seconds.
- Stop active run polling on terminal states.

## 11. RBAC And Permissions

MVP roles:

- Owner: all actions.
- Approver: read approvals, approve/reject, read workflows and receipts.
- Auditor: read receipts, audit events, and evidence.
- Developer: read agents/workflows and integration surfaces.

Frontend permission behavior:

- Hide actions that are irrelevant.
- Disable sensitive forbidden actions with explanation.
- Backend remains the source of truth.
- Handle backend `403` gracefully.

## 12. Loading, Empty, And Error States

Every page must have:

- Populated fixture state.
- Loading skeleton.
- Empty state.
- Error state with retry.

Page-specific empty states:

- Home: no active runs, no approvals, no receipts.
- Agents: no agents yet, create first agent.
- Vendors: no vendors yet, add vendor.
- Credentials: no credentials, add write-only credential.
- Policies: no policies, create policy.
- Workflows: no workflows, create workflow template.
- Runs: no runs yet, start workflow.
- Approvals: no pending approvals.
- Receipts: no receipts yet.
- Audit: no events match filters.
- Settings: missing organization profile.

## 13. Accessibility Checklist

Required:

- Semantic landmarks.
- Ordered headings.
- Visible labels.
- Icon-only buttons have `aria-label`.
- Errors use `role="alert"`.
- Live workflow status uses `aria-live="polite"`.
- Color is never the only indicator.
- Row-click tables support keyboard activation.
- Dialogs/sheets restore focus.
- Reduced motion respected.
- Mobile sticky bars do not hide focused inputs.

## 14. Responsive QA

Check after every phase:

```text
375x812
768x1024
1440x900
```

Expected:

- Desktop: sidebar and multi-column dashboards.
- Tablet: stacked detail sections.
- Mobile: drawer nav, card list fallbacks, sticky approval actions.
- No horizontal overflow.
- No clipped button text.
- Long IDs wrap or truncate intentionally.

## 15. Playwright Smoke Tests

Add smoke tests for:

1. `/login`
2. `/register`
3. `/app/home`
4. `/app/workflows`
5. `/app/runs/run-acme-2048`
6. `/app/approvals/apr-acme-downgrade`
7. `/app/receipts/rcpt-invoice-2047`
8. `/app/audit`

Happy path:

1. Login as owner.
2. Open dashboard.
3. Start Acme Downgrade Request.
4. Open run detail.
5. Open pending approval.
6. Add comment.
7. Approve.
8. Open receipt.
9. Verify timeline/evidence/hash sections exist.

RBAC path:

1. Login as approver.
2. Approvals visible.
3. Owner-only controls hidden/disabled.
4. Approval decision flow works.

## 16. Recommended Immediate Implementation

Start with these files:

```text
apps/web/components/display/workflow-run-status-badge.tsx
apps/web/components/evidence/screenshot-viewer.tsx
apps/web/components/evidence/receipt-timeline.tsx
apps/web/components/evidence/audit-event-drawer.tsx
apps/web/components/product/workflow-readiness-panel.tsx
apps/web/components/product/start-workflow-flow.tsx
apps/web/components/product/live-run-panel.tsx
apps/web/components/dashboard/home-dashboard.tsx
apps/web/components/product/workflow-run-detail-screen.tsx
```

Why:

- These files complete the core demo spine.
- They improve home, workflows, runs, approvals, and receipts together.
- They establish the evidence component model needed by the rest of the app.

## 17. Definition Of Dashboard Complete

Dashboard UI is complete when:

- Every `/app/*` route exists and renders in the shell.
- Every page has populated, empty, loading, and error states.
- Start workflow flow works with fixtures.
- Run detail simulates or displays live states.
- Approval detail is decision-ready on desktop and mobile.
- Receipt detail is evidence-grade.
- Audit has filters and event drawer.
- No secrets are displayed.
- Role-aware actions exist.
- Build and typecheck pass.
- Playwright smoke tests pass.
- Mobile/tablet/desktop layouts are usable.
- API/auth integration is the only major remaining layer.
