# AegisWeb Dashboard UI/UX Audit

Audit date: 2026-06-09

## Scope

Reviewed the existing `apps/web` dashboard routes, app shell, list/detail screens, management forms, evidence components, fixture fallback, and API data layer. The audit focuses on dashboard usability, feature completeness, navigation, accessibility, and implementation readiness against the AegisWeb product specification.

## Priority Scale

- **P0**: Blocks a critical workflow or creates a serious trust/security UX risk.
- **P1**: Major friction in a core MVP workflow.
- **P2**: Noticeable usability gap or incomplete secondary workflow.
- **P3**: Polish, consistency, or future enhancement.

## Findings

| Area | Deficiency | Category | Priority | Status |
| --- | --- | --- | --- | --- |
| Global navigation | Top-bar search icon was present but did not open search or navigate anywhere. | Missing functionality | P1 | Fixed |
| Global navigation | Refresh button had no action, making realtime run/approval state feel unreliable. | Missing functionality | P2 | Fixed |
| Global navigation | Pending approvals control displayed a count but was not a navigable path to approvals. | Broken affordance | P1 | Fixed |
| Home dashboard | The first screen showed metrics and lists but did not clearly tell operators what needed immediate action. | Information hierarchy | P1 | Fixed |
| List pages | Search inputs on table pages were decorative and did not filter policies, runs, approvals, receipts, or audit events. | Broken affordance | P1 | Fixed |
| List pages | Search result counts were absent, so users could not tell whether filtering changed the working set. | Feedback gap | P2 | Fixed |
| Management pages | Create/edit dialogs are implemented, but many actions are disabled outside API mode; the UI relies on tooltips for why. | Incomplete backend dependency | P1 | Documented |
| Agent detail | Pause, resume, and revoke controls are rendered but currently no-op in the detail wrapper. | Incomplete functionality | P1 | Fixed |
| Policy editor | Tag editors and action matrix look editable but do not persist local edits before save. | Broken affordance | P1 | Fixed |
| Policy editor | Policy evaluation action is stubbed and does not show a test result. | Missing functionality | P1 | Fixed |
| Workflow detail | Start workflow works through API or fixture redirect, but retry workflow is not exposed from failed run detail. | Missing workflow recovery | P2 | Documented |
| Approvals | Dashboard approval/rejection is API-gated; in demo mode controls communicate local/fixture behavior, but fixture state does not persist across routes. | Demo limitation | P2 | Documented |
| Receipts | Copy hash button is visual only and does not copy to clipboard. | Broken affordance | P2 | Fixed |
| Receipts | Export/download are available only when backed by API file endpoints. Fixture downloads are not materialized. | Incomplete functionality | P2 | Documented |
| Audit | Audit event drawer exists, but audit search previously did not filter event payloads. | Evidence navigation | P1 | Fixed |
| Settings | Settings is read-only and lacks invite member, billing, integrations, and security controls from the spec. | Incomplete page | P2 | Documented |
| Integrations | Slack, Gmail/Workspace, email fallback, and webhook settings are not represented as configured dashboard surfaces. | Missing module | P2 | Documented |
| Empty states | Generic table empty states do not always explain the next useful action for that resource. | UX copy | P3 | Documented |
| Accessibility | Core forms generally use labels and Radix dialogs, but disabled action explanations are only title tooltips in several places. | Accessibility | P2 | Documented |
| Mobile | Main flows are responsive, but complex policy editing and evidence panels are dense on small screens. | Responsive complexity | P3 | Documented |

## Implemented Redesign Work

1. Added a global dashboard search dialog that indexes pages, agents, vendors, credentials, policies, workflows, runs, approvals, and receipts.
2. Connected top-bar refresh to `router.refresh()`.
3. Converted the pending approvals top-bar control into a link to `/app/approvals`.
4. Added a home-page priority work queue with direct actions for approvals, runs, and audit.
5. Made table-page search functional for policies, runs, approvals, receipts, and audit events.
6. Added visible result counts beside table searches.
7. Wired agent pause, resume, and revoke controls to existing API mutations.
8. Rebuilt the policy editor into a controlled editing surface with editable chips, action decisions, thresholds, business hours, discard reset, save serialization, and policy-test feedback.
9. Implemented receipt hash copy with clipboard feedback and clearer disabled export behavior.

## Remaining Product Gaps

The dashboard shell is now easier to navigate, but several core product functions still need backend-complete implementations:

- Failed workflow runs should expose retry.
- Settings should grow into workspace management: members, integrations, billing, security, API keys.
- Integrations should have first-class Slack/Gmail setup screens.
- Demo mode should either persist local state or make simulated transitions more explicit.

## Recommended Next Pass

Prioritize the remaining P1s in this order:

1. Add retry/cancel/receipt actions consistently across workflow run states.
2. Add integrations/settings surfaces for Slack approval setup and Gmail renewal detection.
3. Improve demo-mode state persistence for simulated approval and policy actions.
4. Make disabled action explanations visible in-page, not only as hover titles.
5. Add resource-specific empty states with next best actions.
