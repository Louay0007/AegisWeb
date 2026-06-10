# AegisWeb Frontend Design Specification

Generated: 2026-06-06

Project: `AegisWeb`

Product: `AegisWeb`

Frontend stack: Next.js App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/Radix UI

Source documents:

- `docs/WEB_DESIGN_SYSTEM.md`
- `docs/TECHNICAL_CONCEPTION.md`
- `docs/BACKEND_IMPLEMENTATION_PLAN.md`

## 1. Purpose

This document is the current implementation plan for the AegisWeb frontend. It replaces the older Vite/React Router/AgentPass direction and aligns the product dashboard with the live web app under `apps/web`.

AegisWeb is the identity, permission, approval, credential, and receipt layer for AI agents acting on the web. The frontend must make non-human identity, policy decisions, credential grants, approvals, browser evidence, receipts, and audit history clear enough that a human can confidently approve or reject risky web-agent actions.

The MVP frontend must support this demo:

1. A user logs in as an owner or approver.
2. The owner can inspect seeded agents, vendors, credentials, policies, workflows, runs, approvals, receipts, and audit events.
3. The owner starts the `Acme Downgrade Request` workflow.
4. The dashboard shows the run moving through queued and running states.
5. The workflow pauses for approval.
6. The approver reviews policy context, screenshot evidence, and run context.
7. The approver approves or rejects.
8. The run completes or is denied.
9. The receipt page shows the final trust artifact.
10. The audit log exposes the technical event trail.

## 2. Current Implementation State

Already implemented in `apps/web`:

- Next.js App Router app with `app/layout.tsx`, `app/page.tsx`, and `app/globals.css`.
- AegisWeb landing page with cinematic monochrome design.
- Shared shadcn/Radix component library in `components/ui`.
- Floating landing header and section-based marketing page.
- Auth frontend routes:
  - `/login`
  - `/register`
  - `/app/home`
- Auth UI talks to backend `/auth/login` and `/auth/register`.
- Seeded demo role picker with local fallback for:
  - `founder@northstarlabs.dev`
  - `finance@northstarlabs.dev`
  - `auditor@northstarlabs.dev`
  - `dev@northstarlabs.dev`
- `pnpm --filter my-v0-project build` passes.

Important mismatch to keep in mind:

- The backend package and some older docs still contain `AgentPass` names.
- The frontend brand and user-facing product name must be `AegisWeb`.
- `docs/WEB_DESIGN_SYSTEM.md` still contains some older MONO/architecture language, but its tokens, layout patterns, component inventory, and current `apps/web` source map are the source of truth for visual implementation.

## 3. Frontend Stack

Use the stack that already exists in `apps/web`:

- Framework: Next.js App Router.
- Runtime UI: React 19.
- Language: TypeScript.
- Styling: Tailwind CSS 4 with CSS variables in `app/globals.css`.
- UI primitives: local shadcn/Radix components in `components/ui`.
- Icons: `lucide-react`.
- Images: `next/image` for local/public assets.
- Forms: React state for small auth forms; React Hook Form plus Zod for larger CRUD forms.
- Data fetching: start with a typed `fetch` wrapper; add TanStack Query when dashboard/server-state screens become broad enough to need cache, polling, invalidation, and mutations.
- Tables: add TanStack Table when implementing list-heavy app screens.
- Virtualization: add TanStack Virtual for audit/event lists.
- Charts: Recharts only when metrics need real trends.
- Browser verification: Playwright.

Avoid for this app:

- Re-scaffolding to Vite.
- React Router.
- CSS Modules or BEM systems that bypass the active Tailwind token system.
- New visual component libraries that fight shadcn/Radix.
- Decorative gradient blobs, one-note color themes, or generic SaaS dashboard styling.
- Showing raw credential values, encrypted payloads, refresh tokens, access tokens, password hashes, or secrets.

## 4. Repository Placement

Current app structure:

```text
apps/web/
  app/
    layout.tsx
    page.tsx
    globals.css
    login/page.tsx
    register/page.tsx
    app/home/page.tsx
  components/
    auth/
    sections/
    ui/
    header.tsx
    fade-image.tsx
  hooks/
  lib/
  public/
```

Recommended next structure as the product app expands:

```text
apps/web/
  app/
    app/
      layout.tsx              # protected product shell
      home/page.tsx
      agents/page.tsx
      agents/[agentId]/page.tsx
      vendors/page.tsx
      policies/page.tsx
      credentials/page.tsx
      workflows/page.tsx
      runs/page.tsx
      approvals/page.tsx
      receipts/page.tsx
      audit/page.tsx
      settings/page.tsx
  components/
    app-shell/
    auth/
    data/
    display/
    evidence/
    forms/
    sections/
    ui/
  lib/
    api/
    auth/
    display/
    fixtures/
    permissions/
```

Rules:

- Keep route files thin.
- Put reusable product surfaces in `components/*`.
- Put API behavior in `lib/api`.
- Put auth/session behavior in `lib/auth` once it grows beyond the current auth components.
- Keep landing-page sections in `components/sections`.
- Do not create a separate `src` tree unless the app is migrated intentionally.

## 5. Visual Direction

AegisWeb has two connected UI modes:

1. Marketing mode: cinematic, monochrome, image-led, editorial, spacious.
2. Product mode: operational, dense, evidence-first, calm, trustworthy.

The product app must inherit the landing page rather than look like a disconnected admin template:

- Use the same monochrome tokens from `app/globals.css`.
- Use Inter and the same quiet typography rhythm.
- Use large brand/type moments only on auth, onboarding, and empty states.
- Use compact evidence panels, tables, timelines, and inspectors for daily work.
- Use full-width page structure, not nested card piles.
- Use images and screenshots only when they carry product evidence.
- Use lucide icons in buttons and status labels.
- Keep primary actions black-on-white or white-on-black depending on surface.

The dashboard should feel like a controlled evidence room: minimal, sharp, legible, and serious.

## 6. Visual System

### 6.1 Color

Use the active semantic tokens from `apps/web/app/globals.css`:

```css
:root {
  --background: #FFFFFF;
  --foreground: #0A0A0A;
  --primary: #0A0A0A;
  --primary-foreground: #FFFFFF;
  --secondary: #F5F5F5;
  --muted: #F5F5F5;
  --muted-foreground: #737373;
  --border: #E5E5E5;
  --input: #F5F5F5;
  --ring: #0A0A0A;
  --destructive: #DC2626;
}
```

Use Tailwind semantic classes:

- `bg-background`
- `text-foreground`
- `bg-primary`
- `text-primary-foreground`
- `bg-muted`
- `text-muted-foreground`
- `border-border`
- `ring-ring`
- `text-destructive`

Status colors may be introduced only as small accents:

- Allow/success: green accent for icons, thin badges, and status dots.
- Approval/waiting: amber accent.
- Deny/failure: destructive red.
- Running/system: cyan or neutral animated indicator.

Do not turn the product dashboard into a colored theme. The base remains monochrome.

### 6.2 Typography

Use Inter from `next/font/google`.

Rules:

- Letter spacing is `0` by default.
- Use `tracking-normal` for product headings.
- Use small uppercase metadata sparingly with `tracking-[0.18em]` or lower.
- Product page titles: `text-2xl` to `text-3xl`.
- Dense table text: `text-sm`.
- Evidence metadata, IDs, hashes, and event types may use `font-mono`.
- Avoid huge hero text inside dense dashboard panels.

### 6.3 Radius, Borders, And Surfaces

Use square or lightly rounded geometry:

- Product panels: `rounded-lg`.
- Inputs/buttons: shadcn defaults, usually `rounded-md`.
- Dialogs/drawers: `rounded-lg`.
- Floating landing header and auth pills may use `rounded-full`.
- Do not nest cards inside cards.
- Use borders more than heavy shadows.
- Use subtle shadows only for floating auth panels, dialogs, popovers, and drawers.

### 6.4 Spacing And Layout

Use the active landing gutters for public/auth pages:

- `px-5 sm:px-8` for auth/product shell pages.
- `px-6 md:px-12 lg:px-20` for landing sections.
- `max-w-7xl` for wide product surfaces.

Product app layout:

- Desktop: fixed sidebar plus topbar.
- Main content: constrained `max-w-7xl` or full available width for tables.
- Detail pages: split pane when evidence must sit next to a decision.
- Mobile: drawer navigation, stacked panels, sticky primary action bars for approval decisions.

### 6.5 Motion

Landing pages can keep cinematic scroll motion.

Product app motion must be functional:

- Route content: subtle opacity/translate reveal.
- Drawers: slide from right.
- Dialogs: fade/scale.
- Running workflow status: compact pulse/spinner.
- Toasts: slide and fade.

All new motion must respect `prefers-reduced-motion`.

## 7. App Architecture

### 7.1 Providers

Add providers only when needed:

- Tooltip provider when tooltips become common in the product shell.
- Toast/Sonner provider for API feedback.
- Query provider when implementing live dashboard and list pages.
- Auth/session provider when route protection and refresh flow are moved out of local component state.

### 7.2 Routing

Use App Router routes:

```text
/
/login
/register
/app/home
/app/agents
/app/agents/[agentId]
/app/vendors
/app/vendors/[vendorId]
/app/policies
/app/policies/[policyId]
/app/credentials
/app/credentials/[credentialId]
/app/workflows
/app/workflows/[workflowId]
/app/runs
/app/runs/[runId]
/app/approvals
/app/approvals/[approvalId]
/app/receipts
/app/receipts/[receiptId]
/app/audit
/app/settings
```

Protected route behavior:

- Unauthenticated users redirect to `/login`.
- Authenticated users visiting `/login` can redirect to `/app/home`.
- Unauthorized users see a compact 403 page with a link back to Home.
- Route permissions must be enforced by backend and mirrored in frontend for UX.

### 7.3 Auth State

Current local auth exists in `components/auth/auth-client.ts`.

Next auth implementation should move toward:

```text
lib/auth/
  auth-client.ts
  auth-session.tsx
  token-storage.ts
  permissions.ts
```

Rules:

- Access token should live in memory first.
- Refresh token must stay in HTTP-only cookie.
- LocalStorage is acceptable only as an isolated local-development fallback.
- Demo fallback must be clearly scoped and easy to remove.
- Never log credentials or tokens.

Auth boot flow:

1. Start in `booting`.
2. Try current access token against `/auth/me`.
3. If missing or expired, call `POST /auth/refresh` with credentials included.
4. Retry `/auth/me`.
5. If still unauthorized, set anonymous and redirect to `/login`.

### 7.4 API Client

Create:

```text
apps/web/lib/api/
  api-client.ts
  api-errors.ts
  query-keys.ts
  pagination.ts
```

Request behavior:

- Base URL: `NEXT_PUBLIC_API_URL`, fallback `http://localhost:3001`.
- Include `credentials: "include"` for auth refresh-cookie endpoints.
- Add `Authorization: Bearer <accessToken>` for protected endpoints.
- Add `X-Request-ID` for traceability.
- Parse backend response shape:

```json
{
  "data": {},
  "meta": {}
}
```

- Normalize backend error shape:

```json
{
  "error": {
    "code": "AGENT_NOT_ACTIVE",
    "message": "Agent must be active to run workflows.",
    "requestId": "req_..."
  }
}
```

Error handling:

- `401`: attempt refresh once, then redirect to login.
- `403`: show permission feedback and keep route stable.
- `404`: route-level not found state.
- `409`: inline conflict near the triggering action.
- `422`: map validation errors to fields.
- `5xx`: recovery state with request ID.

## 8. Product Shell

Create `app/app/layout.tsx` and shared shell components:

```text
components/app-shell/
  app-shell.tsx
  side-nav.tsx
  top-bar.tsx
  mobile-nav.tsx
  page-header.tsx
  page-section.tsx
```

Side nav:

```text
Home          /app/home          LayoutDashboard
Agents        /app/agents        Bot
Policies      /app/policies      ShieldCheck
Credentials   /app/credentials   KeyRound
Vendors       /app/vendors       Building2
Workflows     /app/workflows     Workflow
Runs          /app/runs          ListChecks
Approvals     /app/approvals     CircleCheckBig
Receipts      /app/receipts      Receipt
Audit         /app/audit         ScrollText
Settings      /app/settings      Settings
```

Topbar:

- Current page title.
- Search or command trigger.
- Refresh action where relevant.
- Pending approvals indicator.
- Current user menu.

Shell design:

- Sidebar should be dark or very light monochrome, not colored.
- Active nav state should use contrast, border, and icon weight.
- Main area should feel quiet and data-first.
- Include a skip link to main content.

## 9. Shared Components To Build Next

Build these before the feature pages:

```text
components/display/
  status-badge.tsx
  risk-level-badge.tsx
  policy-decision-badge.tsx
  workflow-run-status-badge.tsx
  hash-integrity-indicator.tsx

components/data/
  data-table.tsx
  filter-bar.tsx
  search-input.tsx
  pagination-controls.tsx
  metric-tile.tsx
  timeline.tsx

components/evidence/
  screenshot-viewer.tsx
  file-list.tsx
  receipt-timeline.tsx
  audit-event-drawer.tsx

components/forms/
  field.tsx
  password-input.tsx
  currency-input.tsx
  form-actions.tsx
  confirm-dialog.tsx
```

Rules:

- Every input has a visible label.
- Icon-only buttons have accessible labels.
- Color is never the only indicator.
- Badges include icon plus label for risk and policy decisions.
- Tables support keyboard row activation.
- Evidence viewers treat screenshots and files as sensitive.

## 10. Feature Pages

### 10.1 Login

Route: `/login`

Current state:

- Implemented.
- Uses AegisWeb branding.
- Supports seeded demo roles and `Password123!`.
- Calls `/auth/login` and falls back to local demo session when API is unavailable.

Next improvements:

- Move session logic into `lib/auth`.
- Add refresh-cookie boot flow.
- Redirect authenticated users to `/app/home`.
- Improve field-level validation with Zod.

### 10.2 Register

Route: `/register`

Current state:

- Implemented.
- Calls `/auth/register`.

Next improvements:

- Add field-level validation.
- Add domain normalization helper.
- Show backend validation errors beside the relevant field.

### 10.3 Home Dashboard

Route: `/app/home`

Current state:

- Implemented as a lightweight authenticated landing point.

Next implementation:

- Replace placeholder metrics with API-backed dashboard data.
- Show pending approvals preview.
- Show active workflow runs.
- Show recent receipts.
- Show risk events preview.
- Add polling every 30 seconds for dashboard metrics and pending approvals.

Primary data:

- `GET /workflow-runs`
- `GET /approvals?status=pending`
- `GET /agents`
- `GET /receipts`
- `GET /audit-events`

### 10.4 Agents

Routes:

- `/app/agents`
- `/app/agents/[agentId]`

Purpose:

- Manage non-human identities.

List columns:

- Name
- Identifier
- Status
- Purpose
- Recent runs
- Policy
- Last activity
- Actions

Actions:

- Create agent
- Edit
- Pause
- Resume
- Revoke
- Open activity

### 10.5 Vendors

Routes:

- `/app/vendors`
- `/app/vendors/[vendorId]`

Purpose:

- Track SaaS vendor portals and renewal metadata.

Fields:

- Name
- Website
- Category
- Renewal date
- Monthly cost
- Renewal cost
- Unused seats
- Risk profile
- Owner

### 10.6 Credentials

Routes:

- `/app/credentials`
- `/app/credentials/[credentialId]`

Purpose:

- Store vendor credentials without exposing secrets.

Rules:

- Never show plaintext password.
- Never show encrypted payload.
- Secret fields are write-only.
- Existing secret values are never fetched or prefilled.

### 10.7 Policies

Routes:

- `/app/policies`
- `/app/policies/[policyId]`

Purpose:

- Make agent authority visible, editable, and testable.

Editor sections:

- Website allowlist.
- Blocked domains.
- Action permissions.
- Spending thresholds.
- Danger keywords.
- Business hours.
- Policy test panel.

Policy test panel:

- Calls `POST /policies/evaluate`.
- Shows decision, risk level, reason, and matched rules.

### 10.8 Workflows

Routes:

- `/app/workflows`
- `/app/workflows/[workflowId]`

Workflow templates:

- Vendor invoice download.
- SaaS renewal check.
- Plan downgrade request.

Start flow:

1. Select template.
2. Select agent.
3. Select vendor.
4. Confirm policy summary and credential grant availability.
5. Start run.
6. Navigate to `/app/runs/[runId]`.

### 10.9 Workflow Runs

Routes:

- `/app/runs`
- `/app/runs/[runId]`

Run detail layout:

- Header: status, workflow, vendor, agent, duration, cancel action.
- Left: step timeline and audit events.
- Right: screenshots, files, current policy decision, run metadata.

Active run behavior:

- Poll run every 2 seconds while active.
- Poll events every 2 seconds while active.
- Stop polling on terminal status.
- If status becomes `waiting_for_approval`, show approval CTA.

### 10.10 Approvals

Routes:

- `/app/approvals`
- `/app/approvals/[approvalId]`

Approval detail is the most important decision screen.

Desktop layout:

- Left: decision panel.
- Right: evidence panel.

Mobile layout:

- Evidence summary first.
- Sticky bottom approve/reject bar.

Decision panel:

- Approval status.
- Action summary.
- Agent identity.
- Vendor and website.
- Risk level.
- Amount or estimated savings.
- Policy trigger.
- Expiration countdown.
- Comment field.
- Approve and reject buttons.

Evidence panel:

- Screenshot viewer.
- Extracted summary.
- DOM/action metadata.
- Policy decision card.
- Matched rules.
- Workflow run link.
- Previous related audit events.

### 10.11 Receipts

Routes:

- `/app/receipts`
- `/app/receipts/[receiptId]`

Receipt detail must show:

- Natural language summary.
- Timeline grouped by phase.
- Screenshots.
- Downloaded files.
- Approval record.
- Policy decisions.
- Credential usage marker without secret value.
- Hash chain integrity indicator.
- Error details for failed or denied runs.

### 10.12 Audit

Route: `/app/audit`

Purpose:

- Searchable technical event history for debugging and compliance.

Requirements:

- Virtualized rows for large event lists.
- Filters for event type, actor type, agent, run, date range, and text.
- Row opens event drawer.
- Drawer shows JSON payload with secrets redacted.
- Hash fields are copyable.

### 10.13 Settings

Route: `/app/settings`

Sections:

- Organization profile.
- Users and roles.
- Local environment status.
- Notification settings.
- API documentation link.

## 11. Permissions And RBAC

Create:

```text
lib/permissions/
  permissions.ts
  use-can.ts
components/auth/can.tsx
```

Rules:

- Frontend permission checks improve UX but do not replace backend checks.
- Hide or disable actions the user cannot perform.
- Disabled security-sensitive actions should include a tooltip explaining the required permission.
- Backend `403` must still be handled gracefully.

MVP roles:

- Owner: all actions.
- Approver: read approvals, approve/reject, read workflows and receipts.
- Auditor: read receipts, audit events, and evidence.
- Developer: read agents/workflows and test integration-oriented flows where allowed.

## 12. Security Requirements

The frontend must enforce:

- Never display raw credentials.
- Never log tokens, passwords, encrypted payloads, or credential input values.
- Never include secrets in error toasts.
- Screenshots are treated as sensitive artifacts.
- File downloads go through authorized backend endpoints.
- Authenticated API requests include access token only over the configured API base URL.
- Do not send credentials to analytics or third-party services.
- Disable browser autocomplete for credential password creation fields where appropriate.
- Keep demo helpers clearly local-development only.
- Avoid `dangerouslySetInnerHTML`.
- Render JSON payloads as escaped text in `pre` elements.
- External links opening new tabs use `rel="noreferrer"`.

## 13. Accessibility Requirements

Target WCAG 2.2 AA.

Requirements:

- Use semantic landmarks: `header`, `nav`, `main`, `section`, `aside`.
- Provide a skip link in the product shell.
- Keep heading levels ordered.
- Every input has a visible label connected by `htmlFor`.
- Error messages use `aria-describedby` and `role="alert"` where appropriate.
- Icon-only buttons have `aria-label`.
- Dialogs trap focus and restore focus after close.
- Menus, tabs, switches, popovers, and tooltips use Radix primitives or native semantics.
- Row-click tables also provide keyboard activation.
- Dynamic workflow status updates use `aria-live="polite"`.
- Color is never the only state indicator.
- Text contrast meets AA.
- Reduced motion is respected.

## 14. Responsive Behavior

Desktop:

- Fixed sidebar.
- Topbar starts after sidebar.
- Multi-column dashboard.
- Approval and receipt details use split-pane layouts.

Tablet:

- Sidebar collapses to icon rail or drawer.
- Tables keep important columns and move secondary metadata into row expansion.
- Detail pages use stacked sections.

Mobile:

- Sidebar becomes drawer.
- Topbar has menu button and compact title.
- Tables become card lists when needed.
- Approval decision buttons become sticky bottom action bar.
- Screenshot viewer keeps 16:9 aspect ratio and horizontal thumbnail scroll.

Required viewport checks:

```text
375x812
768x1024
1440x900
```

## 15. Testing Strategy

Use Playwright for critical route and visual checks. Add component/unit testing when feature complexity grows.

Unit tests should cover:

- Display enum mapping.
- Permission helpers.
- API error normalization.
- Form schema validation.
- Query key factories.
- Utility formatters.

Component tests should cover:

- Login form validation and submit.
- Side nav active state.
- Status badges.
- Policy action matrix.
- Credential form never displays secret after create.
- Approval decision form requires rejection comment.
- Screenshot viewer keyboard navigation.
- Receipt timeline renders grouped events.
- Audit event drawer redacts secret-like keys.

E2E happy path:

1. Login as owner.
2. View home dashboard.
3. Start Acme Downgrade Request workflow.
4. Observe run detail reaches waiting for approval.
5. Login as approver.
6. Review pending approval.
7. Approve approval.
8. Observe run completes.
9. Open receipt and verify timeline, screenshot, file, policy decision, and approval record.

## 16. Performance Targets

Targets:

- Initial web app load under 2 seconds after dev server warmup.
- Dashboard data loaded under 1 second against seeded local API.
- Route transition interactive under 250ms after chunk load.
- Audit table remains smooth with 5,000 events through virtualization.
- Workflow run polling does not refetch unrelated dashboard data.

Implementation:

- Split heavy product sections into route-level components.
- Use cache and polling intentionally.
- Virtualize audit/event lists.
- Memoize expensive timeline grouping.
- Avoid loading screenshot binaries until visible.

## 17. Assets

Use assets that support the product and evidence story:

- AegisWeb logo mark SVG.
- Workflow template icons, preferably lucide-based unless custom marks are needed.
- Screenshot placeholder SVG.
- Receipt trust seal SVG.
- Empty states for agents, policies, credentials, and audit.
- Product evidence screenshots from backend file URLs.

Rules:

- SVGs are acceptable for icons and simple diagrams.
- Product evidence screenshots come from backend file URLs, not decorative placeholders.
- No dark blurred stock imagery.
- Decorative assets must have `alt=""` and `aria-hidden="true"`.

## 18. Build Order From Current State

The old scaffold steps are complete or obsolete. Continue in this order:

1. Clean up docs and naming from AgentPass to AegisWeb where user-facing.
2. Move auth client/session logic from `components/auth` into `lib/auth`.
3. Add `app/app/layout.tsx` protected product shell with sidebar, topbar, skip link, and responsive mobile drawer.
4. Add API client wrapper, normalized errors, request IDs, and refresh-cookie boot flow.
5. Replace `/app/home` placeholder with API-backed dashboard cards, pending approvals preview, active runs, recent receipts, and risk events.
6. Add shared status/risk/policy badges.
7. Add reusable data table, filter bar, search input, pagination, timeline, and metric tile.
8. Build agents list/detail.
9. Build vendors list/detail.
10. Build credentials list/forms/grants with write-only secret handling.
11. Build policies list/editor/evaluate panel.
12. Build workflows list/start flow.
13. Build workflow runs list/detail with polling.
14. Build approvals list/detail and approve/reject flow.
15. Build receipts list/detail.
16. Build audit log with filters and virtualization.
17. Build settings/users/organization.
18. Add Playwright E2E happy path and RBAC path.
19. Add accessibility checks for auth, shell, approval detail, receipt detail, and audit.
20. Add visual screenshots for 375, 768, and 1440 widths.

## 19. What To Implement Next

The next frontend implementation should be the protected product shell and real dashboard foundation.

### Next Milestone: Product Shell

Implement:

- `apps/web/app/app/layout.tsx`
- `components/app-shell/app-shell.tsx`
- `components/app-shell/side-nav.tsx`
- `components/app-shell/top-bar.tsx`
- `components/app-shell/mobile-nav.tsx`
- `components/app-shell/page-header.tsx`

Acceptance:

- `/app/home` renders inside the product shell.
- Sidebar has all MVP routes.
- Mobile nav opens as a drawer.
- Topbar shows current user and pending approvals placeholder.
- Sign out clears session and returns home or login.
- Shell follows the monochrome AegisWeb landing style.
- No nested cards, no decorative blobs, no unrelated color theme.

### Then: API And Auth Hardening

Implement:

- `lib/api/api-client.ts`
- `lib/api/api-errors.ts`
- `lib/auth/auth-session.tsx`
- `lib/auth/token-storage.ts`
- Refresh-cookie boot flow.
- Protected route redirect behavior.

Acceptance:

- Reloading `/app/home` attempts `/auth/me`, then `/auth/refresh`, then retries `/auth/me`.
- Unauthenticated protected routes redirect to `/login`.
- Authenticated users can leave and return without manually selecting demo credentials if backend refresh cookie exists.
- Errors show request IDs when backend provides them.

### Then: Dashboard MVP

Implement:

- API-backed metrics.
- Pending approvals preview.
- Active workflow runs preview.
- Recent receipts preview.
- Risk/audit events preview.

Acceptance:

- Dashboard is useful immediately after login.
- Empty/loading/error states look intentional.
- Owner and approver see role-appropriate actions.

## 20. Frontend Definition Of Done

The frontend MVP is done when:

- `pnpm --filter my-v0-project dev` starts the Next app.
- `pnpm --filter my-v0-project build` passes.
- Login works with seeded demo users.
- Refresh-cookie auth flow works after page reload.
- Protected routes redirect correctly.
- Owner can inspect and manage agents, vendors, policies, credentials, workflows, runs, approvals, receipts, audit, and settings.
- Approver can review and decide approvals without owner-only controls.
- The flagship approval flow works end-to-end against the backend.
- Running workflow runs update without page refresh.
- Receipt detail page shows timeline, screenshots, files, policy decisions, approval details, and hash integrity state.
- Audit log is filterable and virtualized.
- No page displays plaintext credentials, encrypted payloads, password hashes, refresh tokens, or access tokens.
- Playwright E2E tests pass for the happy path and RBAC path.
- Axe checks pass for key flows.
- Desktop, tablet, and mobile layouts are usable.

## 21. Backend Contract Dependencies

Frontend implementation depends on:

- OpenAPI document at `/docs-json`.
- Auth endpoints with refresh cookie support.
- Standard response shape with `data` and `meta`.
- Standard error shape with request ID.
- Pagination metadata on list endpoints.
- Permission-aware `GET /auth/me`.
- File download endpoint or signed URL response.
- Workflow run detail endpoint with enough status metadata for polling.
- Approval detail endpoint containing screenshot, policy, run, and action context.
- Receipt endpoint containing complete materialized trust artifact.
- Audit event endpoint with filters and stable pagination.

If a backend endpoint is not ready, use local fixtures shaped exactly like the planned API contract. Add MSW only when component tests or isolated demo flows require it.

## 22. Demo Script Supported By Frontend

Run:

```bash
pnpm infra:up
pnpm db:reset
pnpm dev:api
pnpm dev:worker
pnpm dev:vendor
pnpm --filter my-v0-project dev
```

Then:

1. Open the Next.js web app.
2. Login as `founder@northstarlabs.dev`.
3. Start `Acme Downgrade Request`.
4. Watch the run become `running`.
5. Watch the run become `waiting_for_approval`.
6. Open pending approval.
7. Review screenshot, policy reason, matched rules, and run context.
8. Login as `finance@northstarlabs.dev`.
9. Approve the request.
10. Return to the run and observe completion.
11. Open the receipt.
12. Verify timeline, screenshots, invoice file, approval record, policy decisions, and audit hash state.

## 23. Future Production Hardening

Later improvements:

- Replace local auth with SSO or passkeys.
- Add WebSocket/SSE updates instead of polling.
- Add organization-level audit export.
- Add receipt PDF export preview.
- Add real vendor connector status pages.
- Add anomaly summaries using sanitized local AI.
- Add row-level permission explanations in the UI.
- Add saved audit filters.

Do not add these before the local MVP approval loop is reliable.
