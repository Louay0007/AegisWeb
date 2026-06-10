# AegisWeb Dashboard Implementation Plan

Generated: 2026-06-07

Source documents:

- `docs/FRONTEND_DESIGN_SPEC.md`
- `docs/WEB_DESIGN_SYSTEM.md`
- `docs/BACKEND_IMPLEMENTATION_PLAN.md`

Guidance applied:

- `louay-ui-ux-master`
- `make-interfaces-feel-better`

## 1. Goal

Build the complete AegisWeb dashboard UI first: all routes, page layouts, reusable components, empty/loading/error states, responsive behavior, and demo fixtures. API fetching, refresh-cookie auth, and backend wiring come last as a controlled integration pass.

This order is intentional. The product needs a coherent operator experience before the data layer hardens. Every screen should already feel useful, trustworthy, and aligned with the landing page even while it runs on local fixtures.

## 2. Product UI Direction

AegisWeb is not a generic SaaS admin. It is a controlled evidence room for AI agents acting on web systems.

The dashboard should feel:

- Monochrome, precise, and quiet.
- Dense enough for operators, but not cramped.
- Evidence-first: screenshots, receipts, timelines, policy decisions, and audit events are treated as product objects.
- Serious about security: credentials are never visible, destructive actions require confirmation, risky actions show policy context.
- Connected to the landing page: same AegisWeb typography rhythm, high contrast, restrained surfaces, sharp geometry, and shadcn/Radix primitives.

Avoid:

- Purple or blue AI gradients.
- Nested card stacks.
- Decorative blobs.
- Marketing hero layouts inside the app.
- Over-rounded dashboard widgets.
- Colorful admin-template status soup.
- Instructional text that explains the UI instead of doing the job.

## 3. Current Baseline

Already implemented:

- Next.js App Router web app.
- AegisWeb landing page.
- Auth pages:
  - `/login`
  - `/register`
- Product shell:
  - `/app` layout
  - sidebar
  - topbar
  - mobile drawer
  - skip link
  - user menu
- Initial `/app/home` dashboard placeholder.
- Local demo session fallback.

This plan continues from that state.

## 4. Design System Rules For Dashboard Work

Use the active `apps/web/app/globals.css` tokens through Tailwind semantic classes:

- `bg-background`
- `text-foreground`
- `bg-muted`
- `text-muted-foreground`
- `bg-primary`
- `text-primary-foreground`
- `border-border`
- `ring-ring`
- `text-destructive`

Dashboard-specific rules:

- Product panels use `rounded-lg`, `border border-border`, and minimal shadows.
- Buttons, inputs, dropdowns, dialogs, sheets, tabs, and tooltips use existing shadcn components.
- Icons come from `lucide-react`, imported by name.
- Use tabular numbers for counters, timers, prices, run durations, and hashes.
- Use `text-balance` for page headings and `text-pretty` for short descriptions.
- Use explicit transition properties, not `transition-all`, in new custom components.
- Use `min-h-10` or `h-10` for primary controls, and at least `44px` touch targets on mobile.
- Status colors are tiny accents only:
  - success/allow: green accent
  - warning/approval: amber accent
  - danger/deny: destructive red
  - running/system: cyan or neutral pulse
- Color is never the only status indicator. Always pair status color with icon and text.

## 5. Implementation Strategy

Build in three layers:

1. Shared dashboard primitives.
2. All product pages using local fixtures.
3. Final fetch/auth integration.

During layers 1 and 2:

- Use local fixture files shaped like the backend DTOs.
- Build real interactions where possible with client state.
- Buttons can open dialogs, drawers, tabs, and detail states even before fetch exists.
- Mutating actions can update local fixture state or show intentional pending/disabled states.
- Keep route files thin and page composition readable.

During layer 3:

- Replace fixture reads with API hooks.
- Preserve component props and page layouts.
- Add auth boot flow, protected redirects, request IDs, and error normalization.

## 6. Target File Structure

```text
apps/web/
  app/
    app/
      home/page.tsx
      agents/page.tsx
      agents/[agentId]/page.tsx
      vendors/page.tsx
      vendors/[vendorId]/page.tsx
      credentials/page.tsx
      credentials/[credentialId]/page.tsx
      policies/page.tsx
      policies/[policyId]/page.tsx
      workflows/page.tsx
      workflows/[workflowId]/page.tsx
      runs/page.tsx
      runs/[runId]/page.tsx
      approvals/page.tsx
      approvals/[approvalId]/page.tsx
      receipts/page.tsx
      receipts/[receiptId]/page.tsx
      audit/page.tsx
      settings/page.tsx
  components/
    app-shell/
    dashboard/
    data/
    display/
    evidence/
    forms/
    product/
    ui/
  lib/
    fixtures/
    display/
    permissions/
    format/
```

Use `components/product` for AegisWeb-specific domain components and `components/data`, `components/display`, `components/evidence`, and `components/forms` for reusable primitives.

## 7. Shared Components To Build First

### 7.1 Display Components

Create:

```text
components/display/status-badge.tsx
components/display/risk-level-badge.tsx
components/display/policy-decision-badge.tsx
components/display/workflow-run-status-badge.tsx
components/display/hash-integrity-indicator.tsx
components/display/role-badge.tsx
```

Requirements:

- Icon plus text.
- Compact and regular sizes.
- Neutral monochrome base with small status accents.
- Works on light and dark sidebar/sheet surfaces.
- Unknown values render as `Unknown`, not crash.

### 7.2 Data Components

Create:

```text
components/data/data-table.tsx
components/data/filter-bar.tsx
components/data/search-input.tsx
components/data/pagination-controls.tsx
components/data/metric-tile.tsx
components/data/timeline.tsx
components/data/entity-list.tsx
```

Requirements:

- Keyboard row activation.
- Stable row heights.
- Empty, loading, and error states.
- Mobile card-list fallback where tables become too tight.
- Counters use `tabular-nums`.
- Filters use shadcn `Button`, `Input`, `Select`, `Tabs`, `DropdownMenu`, and `Popover` where appropriate.

### 7.3 Evidence Components

Create:

```text
components/evidence/screenshot-viewer.tsx
components/evidence/file-list.tsx
components/evidence/receipt-timeline.tsx
components/evidence/audit-event-drawer.tsx
components/evidence/policy-evidence-panel.tsx
components/evidence/evidence-summary.tsx
```

Requirements:

- Screenshots use stable 16:9 frames.
- Image frames have subtle neutral inset outlines.
- Full-screen screenshot viewer uses shadcn Dialog.
- Audit event drawer uses shadcn Sheet.
- Secret-like JSON keys are redacted in fixture display too.
- Evidence panels should feel like controlled packets, not decorative cards.

### 7.4 Form Components

Create:

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

- Every input has a visible label.
- Errors use `role="alert"` and connect with `aria-describedby`.
- Password/secret fields are write-only where required.
- Destructive actions use confirm dialogs.
- Buttons have loading and disabled states.

### 7.5 Product Components

Create:

```text
components/product/agent-identity-card.tsx
components/product/vendor-summary-card.tsx
components/product/policy-summary-card.tsx
components/product/credential-grant-list.tsx
components/product/workflow-template-card.tsx
components/product/run-status-strip.tsx
components/product/approval-decision-panel.tsx
components/product/receipt-summary-panel.tsx
```

Requirements:

- These are domain-specific and can use AegisWeb product language.
- They compose shared primitives, not duplicate badge/table/timeline logic.
- They should accept fixture-shaped props so API integration later is simple.

## 8. Fixtures And Display Maps

Create:

```text
apps/web/lib/fixtures/
  agents.ts
  vendors.ts
  credentials.ts
  policies.ts
  workflows.ts
  workflow-runs.ts
  approvals.ts
  receipts.ts
  audit-events.ts
  dashboard.ts

apps/web/lib/display/
  action-display.ts
  audit-display.ts
  policy-display.ts
  risk-display.ts
  status-display.ts
  workflow-display.ts

apps/web/lib/format/
  currency.ts
  dates.ts
  duration.ts
  identifiers.ts
  redaction.ts
```

Fixture rules:

- Use realistic seeded demo data from the product concept:
  - Northstar Labs
  - Acme Analytics
  - SaaS invoices
  - renewal checks
  - plan downgrade request
  - approval pause
  - browser evidence
  - receipt hash chain
- Shape fixtures close to planned backend response objects.
- Include happy states, pending states, failed states, and denied states.
- Include long names and IDs to test wrapping.
- Never include real secrets.

## 9. Page Build Order

### Phase 1: Home Dashboard

Routes:

- `/app/home`

Build:

- Metrics row.
- Pending approvals preview.
- Active workflow runs preview.
- Recent receipts preview.
- Risk/audit events preview.
- Agent activity strip.

Components:

- `MetricTile`
- `WorkflowRunStatusBadge`
- `RiskLevelBadge`
- `Timeline`
- `EntityList`

Acceptance:

- The dashboard is useful immediately after login.
- It clearly points to pending approvals and active runs.
- Empty/loading/error variants exist even with fixtures.
- Desktop and mobile layouts do not overlap or clip.

### Phase 2: Agents

Routes:

- `/app/agents`
- `/app/agents/[agentId]`

Build:

- Agents table/list.
- Search and status filter.
- Agent create/edit dialog.
- Pause/resume/revoke confirm dialogs.
- Agent detail with identity, policy, credential grants, workflows, runs, and audit activity.

Acceptance:

- Agent status is clear.
- Revoked state is visually terminal.
- Disabled actions explain why they are disabled.

### Phase 3: Vendors

Routes:

- `/app/vendors`
- `/app/vendors/[vendorId]`

Build:

- Vendor table/list.
- Vendor detail with renewal metadata.
- Related credentials and workflows.
- Renewal risk summary.

Acceptance:

- SaaS renewal context is easy to scan.
- Costs and renewal dates use tabular numeric formatting.

### Phase 4: Credentials

Routes:

- `/app/credentials`
- `/app/credentials/[credentialId]`

Build:

- Credential list.
- Add credential dialog.
- Grant to agent dialog.
- Revoke grant and revoke credential confirmations.
- Detail page that shows grants and usage history.

Acceptance:

- No plaintext or encrypted secret values are displayed.
- Secret inputs are write-only.
- Existing secret fields never appear prefilled.

### Phase 5: Policies

Routes:

- `/app/policies`
- `/app/policies/[policyId]`

Build:

- Policy list.
- Policy editor layout.
- Allowed domains.
- Blocked domains.
- Action permission matrix.
- Spending thresholds.
- Danger keywords.
- Business hours.
- Policy test panel with fixture evaluation result.

Acceptance:

- Authority is visible and testable.
- Dirty state and sticky save bar are designed.
- Policy decisions use badge plus explanation.

### Phase 6: Workflows

Routes:

- `/app/workflows`
- `/app/workflows/[workflowId]`

Build:

- Workflow templates.
- Workflow list.
- Start workflow flow:
  1. Template
  2. Agent
  3. Vendor
  4. Policy and credential confirmation
  5. Fixture run created locally or displayed as preview

Acceptance:

- Users understand why a workflow can or cannot start.
- Credential grant and policy readiness are visible before start.

### Phase 7: Workflow Runs

Routes:

- `/app/runs`
- `/app/runs/[runId]`

Build:

- Runs table/list.
- Run detail:
  - status header
  - step timeline
  - audit event stream
  - screenshots
  - files
  - policy decision
  - run metadata
  - approval CTA when waiting

Acceptance:

- Active, failed, denied, and completed runs are visually distinct.
- The run detail tells a story from start to evidence.

### Phase 8: Approvals

Routes:

- `/app/approvals`
- `/app/approvals/[approvalId]`

Build:

- Approval queue tabs.
- Pending/approved/rejected/expired/all.
- Quick approve/reject states.
- Approval detail with decision panel and evidence panel.
- Rejection comment validation.
- High-risk confirm dialog.
- Mobile sticky decision bar.

Acceptance:

- This is the highest quality screen in the MVP.
- A human can decide from policy, screenshot, run context, and matched rules.
- Approve and reject actions are distinct and accessible.

### Phase 9: Receipts

Routes:

- `/app/receipts`
- `/app/receipts/[receiptId]`

Build:

- Receipt list.
- Receipt detail:
  - final status
  - natural language summary
  - grouped timeline
  - screenshots
  - files
  - approval record
  - policy decisions
  - credential usage marker
  - hash integrity indicator

Acceptance:

- Receipt feels like a final trust artifact.
- Evidence is organized by phase.
- Hashes and IDs are copyable where useful.

### Phase 10: Audit

Routes:

- `/app/audit`

Build:

- Audit event table/list.
- Filters.
- Search.
- Event drawer.
- Redacted JSON viewer.
- Copyable event IDs and hashes.

Acceptance:

- Long event lists remain scannable.
- Secret-like keys are visibly redacted.
- Drawer content is readable on mobile.

### Phase 11: Settings

Routes:

- `/app/settings`

Build:

- Organization profile.
- Users and roles.
- Local environment status.
- Notification settings placeholder.
- API docs link.

Acceptance:

- Owner-only controls are clearly separated.
- Local dev/system status is easy to read.

## 10. Route Skeleton Checklist

Every route should include:

- `PageHeader`.
- Primary action area when relevant.
- Loading skeleton.
- Empty state.
- Error state.
- Fixture-backed populated state.
- Mobile layout.
- Keyboard-accessible actions.
- At least one Playwright smoke route target after implementation.

## 11. UX Polish Checklist

Apply this before considering each phase done:

- No nested cards.
- No `transition-all` in newly written custom components.
- Dynamic numbers use `tabular-nums`.
- Headings use `text-balance`.
- Short descriptions use `text-pretty`.
- Tables and lists have stable row heights.
- Icon buttons have `aria-label`.
- Hover, focus, disabled, selected, and active states exist.
- Mobile touch targets are at least 44px where practical.
- Long IDs and emails truncate or wrap intentionally.
- Dialogs and sheets use shadcn/Radix.
- Evidence screenshots reserve space and have neutral outlines.
- Empty states are useful, not decorative.

## 12. Accessibility Checklist

Every phase must maintain:

- Semantic landmarks.
- Ordered headings.
- Visible labels for inputs.
- `role="alert"` for errors.
- `aria-live="polite"` for meaningful status updates.
- Keyboard activation for row-click patterns.
- Focus ring visibility.
- Reduced-motion compatibility.
- Status text alongside color.

## 13. Responsive QA Targets

Check these viewports after each major phase:

```text
375x812
768x1024
1440x900
```

Dashboard behavior:

- Desktop: sidebar plus multi-column content.
- Tablet: stacked detail sections, tables with fewer columns.
- Mobile: drawer nav, card-list fallbacks, sticky decision bars for approvals.

## 14. Final Integration Phase: Fetch And Auth

Do this only after all pages and components exist with fixtures.

Build:

```text
apps/web/lib/api/api-client.ts
apps/web/lib/api/api-errors.ts
apps/web/lib/api/query-keys.ts
apps/web/lib/api/pagination.ts
apps/web/lib/auth/auth-session.tsx
apps/web/lib/auth/token-storage.ts
```

Integration steps:

1. Move auth helpers out of `components/auth`.
2. Add session boot:
   - `/auth/me`
   - `/auth/refresh`
   - retry `/auth/me`
3. Protect `/app/*`.
4. Redirect authenticated `/login` visits to `/app/home`.
5. Replace fixture reads page by page with API calls.
6. Preserve fixture fallback for demo/dev only if backend is unavailable.
7. Add request IDs.
8. Normalize backend errors.
9. Add polling:
   - dashboard metrics: 30 seconds
   - pending approvals: 30 seconds
   - active run detail: 2 seconds
10. Add Playwright E2E happy path.

Acceptance:

- Fetch integration does not rewrite the UI.
- Empty/loading/error states stay polished.
- Backend errors show request IDs.
- No secrets are logged or displayed.
- Refresh-cookie flow works after reload.

## 15. Recommended Immediate Next Task

Start with shared fixtures and shared components, then rebuild `/app/home` as the real dashboard MVP.

Immediate file targets:

```text
apps/web/lib/fixtures/dashboard.ts
apps/web/lib/fixtures/workflow-runs.ts
apps/web/lib/fixtures/approvals.ts
apps/web/lib/fixtures/receipts.ts
apps/web/lib/fixtures/audit-events.ts
apps/web/components/display/status-badge.tsx
apps/web/components/display/risk-level-badge.tsx
apps/web/components/display/workflow-run-status-badge.tsx
apps/web/components/data/metric-tile.tsx
apps/web/components/data/entity-list.tsx
apps/web/components/data/timeline.tsx
apps/web/components/dashboard/home-dashboard.tsx
apps/web/app/app/home/page.tsx
```

This gives the app its operating center and establishes patterns for every other page.

## 16. Definition Of Dashboard UI Complete

The fixture-first dashboard UI is complete when:

- Every `/app/*` route exists.
- Every route renders in the product shell.
- Each page has populated, empty, loading, and error states.
- All shared display/data/evidence/form components exist.
- The approval detail and receipt detail pages feel evidence-grade.
- Mobile, tablet, and desktop layouts are usable.
- `pnpm --filter my-v0-project build` passes.
- Playwright smoke checks pass for key routes.
- Fetch/API integration remains the only major unfinished layer.
