# AegisWeb Dashboard Frontend/Backend Synchronization Audit

Audit date: 2026-06-09

## Scope

Reviewed synchronization between:

- Dashboard routes and components in `apps/web/app/app` and `apps/web/components`.
- Frontend API hooks, query keys, mutation wrappers, and DTO mappers in `apps/web/lib`.
- Backend NestJS controllers, services, DTO serializers, and Prisma schema in `apps/api/src` and `prisma/schema.prisma`.

The goal is to verify that dashboard state, displayed data, mutations, and UI assumptions match backend data structures and behavior.

## Priority Scale

- **P0**: Can corrupt data, violate security boundaries, or make a critical workflow unusable.
- **P1**: Core workflow appears implemented in the UI but fails or displays materially wrong data with the live API.
- **P2**: Important mismatch or degraded fidelity that can confuse users or hide system state.
- **P3**: Low-risk polish, naming, or future parity issue.

## Executive Summary

The dashboard has a solid frontend data layer and most read endpoints have matching backend resources. The biggest integrity risk is not route coverage; it is **shape mismatch between form submissions and backend validation**. Several dialogs submit UI-friendly fields directly to API endpoints where the backend expects canonical DTO fields such as `monthlyCostCents`, `secretJson`, `configurationJson`, enum values, UUIDs, and arrays.

The second major risk is **display fidelity**. Some mapped UI values are placeholders or derived from incomplete data, especially agent policy/grants, workflow readiness, approval vendor/agent names, receipt hashes, and global search. These can make the dashboard look operational while not fully reflecting backend truth.

## Implementation Update

Implemented after this audit:

- Frontend mutation normalizers for vendor, credential, policy, policy evaluation, and workflow payloads.
- Backend workflow-run list enrichment with latest action attempt, recent files, active/recent approval request, and receipt summary.
- Frontend approval hydration from workflow-run data so approval cards/details show human-readable agent/vendor context.
- Agent page/detail hydration from related policy, credential, and run resources.
- API-backed global dashboard search using data-layer resources instead of fixture-only indexes.
- Dynamic top-bar pending approval count from `useApprovals`.
- Receipt list vendor propagation through `workflowRun.vendor`.

## Route/API Coverage Matrix

| Dashboard Area | Frontend Route/Component | API Read Path | API Mutation Path | Sync Status | Priority |
| --- | --- | --- | --- | --- | --- |
| Home | `HomeDashboard` | Multiple resource hooks | Start workflow dialog | Partially synced; metrics mix API data with static fixture counts | P2 |
| Agents list/detail | `AgentsPage`, `AgentDetailPage` | `/agents`, `/agents/:id` | create/update/pause/resume/revoke | Fixed: dashboard hydrates policy, credential grants, and run counts from related resources | P2 |
| Vendors list/detail | `VendorsPage`, `VendorDetailPage` | `/vendors`, `/vendors/:id` | create/update/delete | Fixed: create/edit payload normalizes dollars to cents and unused seats to metadata | P1 |
| Credentials list/detail | `CredentialsPage`, `CredentialDetailPage` | `/credentials`, `/credentials/:id` | create/grant/revoke/revoke grant | Fixed: create payload wraps write-only values into `secretJson` | P1 |
| Policies list/detail | `PoliciesPage`, `PolicyDetailPage` | `/policies`, `/policies/:id` | create/update/evaluate | Fixed: create/update/evaluate send backend-shaped policy payloads | P1 |
| Workflows list/detail | `WorkflowsPage`, `WorkflowDetailPage` | `/workflows`, `/workflows/:id` | create/update/run | Fixed: create/edit payload nests setup values inside `configurationJson` | P1 |
| Runs list/detail | `RunsPage`, `RunDetailPage` | `/workflow-runs`, `/workflow-runs/:id`, audit query | cancel | Fixed: list endpoint includes bounded attempt/file/approval/receipt summary data | P2 |
| Approvals list/detail | `ApprovalsPage`, `ApprovalDetailPage` | `/approvals`, `/approvals/:id` | approve/reject | Fixed: frontend hydrates approval display context from workflow runs | P2 |
| Receipts list/detail | `ReceiptsPage`, `ReceiptDetailPage` | `/receipts`, `/receipts/:id` | export/download files | Partially fixed: receipt list includes vendor via workflow run; durable receipt hash still needs backend field | P2 |
| Audit | `AuditPage`, `AuditEventDrawer` | `/audit-events` | none | Mostly synced; event type casing differs from backend enum display | P3 |
| Settings | `SettingsPage` | `/organization`, `/users` | none in UI | Backend supports org update, invite, role change, disable; UI is read-only | P2 |

## Critical Findings

### 1. Vendor form submits dollars and UI-only fields, but backend expects cents and metadata

**Files**

- Frontend: `apps/web/components/product/management-screens.tsx`
- Frontend mutation: `apps/web/lib/data-layer/mutations.ts`
- Backend: `apps/api/src/vendors/vendors.controller.ts`

**Mismatch**

The vendor dialog submits fields like:

- `monthlyCost`
- `unusedSeats`
- `renewalDate`

The backend create/update schemas accept:

- `monthlyCostCents`
- `metadataJson`
- `renewalDate`

`monthlyCost` and `unusedSeats` are not accepted by the backend schema. Because the Zod object is not strict by default, unknown fields are stripped, so monthly cost and unused seats are silently lost rather than saved.

**Impact**

Vendor costs, renewal exposure, risk profile context, and unused-seat UI can diverge from backend state.

**Priority**

P1

**Recommended Fix**

Add a frontend payload normalizer before `resourceApi.vendors.create/update`:

- `monthlyCost` dollars -> `monthlyCostCents`
- `unusedSeats` -> `metadataJson.unusedSeats`
- preserve existing metadata during edits where possible

### 2. Credential create dialog does not send `secretJson`

**Files**

- Frontend: `apps/web/components/product/management-screens.tsx`
- Backend: `apps/api/src/credentials/credentials.controller.ts`

**Mismatch**

The credential dialog submits:

- `username`
- `password`
- `credentialType`
- `vendorId`
- `label`

The backend requires:

- `secretJson`: non-empty object

The backend does not accept `username` or `password` as top-level fields. Credential creation will fail validation with the live API.

**Impact**

Credential vault creation appears implemented but cannot work against the backend.

**Priority**

P1

**Recommended Fix**

Normalize credential form data:

```ts
{
  vendorId,
  label,
  credentialType,
  secretJson: credentialType === "username_password"
    ? { username, password }
    : { value: password }
}
```

### 3. Policy create dialog does not send backend-required `rulesJson`

**Files**

- Frontend: `apps/web/components/product/management-screens.tsx`
- Backend: `apps/api/src/policies/policies.controller.ts`

**Mismatch**

The policy create dialog sends:

- `allowedDomains`
- `blockedDomains`
- `approvalActions`

The backend requires:

- `rulesJson`

Because `rulesJson` is required, policy creation fails validation.

**Impact**

Users cannot create backend-valid policies through the dashboard.

**Priority**

P1

**Recommended Fix**

Map form fields into:

```ts
rulesJson: {
  allowedDomains: splitCsv(allowedDomains),
  blockedDomains: splitCsv(blockedDomains),
  approvalRequiredActions: splitCsv(approvalActions)
}
```

### 4. Policy evaluation sends incorrect field names and types

**Files**

- Frontend: `apps/web/components/product/management-screens.tsx`
- Backend: `apps/api/src/policies/policies.controller.ts`

**Mismatch**

The policy editor calls `onEvaluatePolicy` with:

- `actionType: "change_plan"`
- `amount: thresholds.approvalAbove`
- `riskSignals: dangerKeywords.join(",")`

The backend requires:

- `actionType`: valid domain enum
- `amountCents`: number
- `riskSignals`: array of valid risk signal enum values

`amount` is ignored and `riskSignals` as a comma string fails validation.

**Impact**

Policy test appears usable but live backend evaluation will fail or not reflect the edited scenario.

**Priority**

P1

**Recommended Fix**

Submit canonical payload:

```ts
{
  policyId,
  agentId,
  website,
  actionType: "change_plan",
  amountCents: Number(amountDollars) * 100,
  riskSignals: ["credential_used", "external_payment_change"]
}
```

Also consume the returned evaluation result instead of using local heuristic-only output when API mode is active.

### 5. Workflow create/edit sends configuration fields at the wrong level

**Files**

- Frontend: `apps/web/components/product/management-screens.tsx`
- Backend: `apps/api/src/workflows/workflows.controller.ts`

**Mismatch**

The workflow dialog submits:

- `credentialId`
- `targetPlan`

The backend expects:

- `configurationJson: { credentialId, targetPlan }`

Top-level `credentialId` and `targetPlan` are stripped by backend validation, so configuration is missing. Backend workflow validation may fail or create incomplete workflow records.

**Impact**

Workflow setup does not reliably bind credential readiness to the backend workflow.

**Priority**

P1

**Recommended Fix**

Normalize workflow payload:

```ts
{
  name,
  template,
  agentId,
  vendorId,
  configurationJson: { credentialId, targetPlan }
}
```

### 6. Approval list/detail cannot display human-readable agent/vendor from `/approvals`

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend: `apps/api/src/approvals/approvals.service.ts`

**Mismatch**

`mapApproval(dto, runs)` can display run-derived agent/vendor names, but `resourceQueries.approvals.list/detail` calls `mapApproval(approval, [])`.

The backend approval DTO includes `requestedByAgentId` and `workflowRunId`, but not joined agent/vendor names.

**Impact**

Live approval UI may show an agent UUID and generic `"Vendor"` instead of meaningful approval context.

**Priority**

P2

**Recommended Fix**

Either:

- include `workflowRun.agent` and `workflowRun.vendor` in approval DTOs, or
- have the frontend approval query hydrate runs and pass them into `mapApproval`.

Backend join is cleaner because approval cards need this context everywhere.

### 7. Workflow run list mapper expects detail-only relationships

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend list: `apps/api/src/workflow-runs/workflow-run-query.service.ts`

**Mismatch**

`mapWorkflowRun` supports:

- `files`
- `actionAttempts`
- `approvalRequests`
- `receipt`

But `/workflow-runs` list includes only:

- workflow
- agent
- vendor

Detailed relations are present only in `/workflow-runs/:id`.

**Impact**

Runs list and home dashboard derive risk, policy decision, evidence, approvals, and receipt state as defaults:

- risk -> low
- policy decision -> record-only
- files -> empty

This can understate risk on list surfaces.

**Priority**

P2

**Recommended Fix**

For run list summary, backend should include latest action attempt, active approval request, file count/screenshot count, and receipt summary. Alternatively, frontend list should not display risk/policy fields unless provided.

### 8. Agent mapper displays placeholder policy/grants/activity

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend: `apps/api/src/agents/agents.service.ts`

**Mismatch**

`mapAgent` hardcodes:

- `policy: "Policy bundle"`
- `recentRuns: 0`
- `credentialGrants: []`

The backend `/agents` endpoint returns only agent rows and does not include policies, credential grants, or activity. There is an `/agents/:id/activity` endpoint, but the dashboard does not use it.

**Impact**

Agent cards and detail views can materially misrepresent operational state.

**Priority**

P2

**Recommended Fix**

Add aggregate fields to agent DTO or hydrate from policies, credentials, and workflow runs. Use `/agents/:id/activity` in the detail screen.

### 9. Workflow readiness is hardcoded as ready

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend: `apps/api/src/workflows/workflows.service.ts`

**Mismatch**

`mapWorkflow` sets `readiness: "ready"` for every live workflow. Backend start-run logic checks:

- active workflow
- active agent
- active vendor
- active policy bundle
- valid configuration
- active credential grant

The UI readiness value does not reflect these backend checks.

**Impact**

Users may see “ready” workflows that cannot start.

**Priority**

P2

**Recommended Fix**

Add a backend readiness endpoint or include readiness diagnostics in workflow DTOs. Reuse the same checks as `startRun` without creating a run.

### 10. Receipt list fabricates hash and omits vendor

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend list: `apps/api/src/receipts/receipts.service.ts`

**Mismatch**

Receipt list DTO does not include vendor, files, policy decisions, or hash. Frontend maps:

- `vendor: "AegisWeb"`
- `hash: hash_${id.slice(0, 12)}`

Detail may derive hash from file SHA, but list rows show fabricated values.

**Impact**

Trust artifact identity is misleading on the receipt list.

**Priority**

P2

**Recommended Fix**

Persist a receipt hash or include audit hash/file hash in the list DTO. Include workflow vendor in receipt list records.

### 11. Global dashboard search indexes fixture data only

**Files**

- Frontend: `apps/web/components/dashboard/dashboard-global-search.tsx`

**Mismatch**

Global search uses imported fixture arrays, not API resource data. In live API mode, global search results can point to fixture IDs and records that do not exist in the current organization.

**Impact**

Navigation can break in live workspaces and search can expose demo-only context.

**Priority**

P1

**Recommended Fix**

Back global search with API data-layer resources or create a `/search` endpoint scoped by organization. At minimum, only include route links when authenticated API mode is active and fixture data is unavailable.

### 12. Backend response envelope and frontend `apiRequest` are compatible, but some typed queries ignore pagination metadata

**Files**

- Frontend: `apps/web/lib/api/api-client.ts`, `apps/web/lib/data-layer/resource-queries.ts`
- Backend list endpoints: workflow runs, approvals, receipts, audit

**Mismatch**

Several backend list endpoints return:

```ts
{ data, meta }
```

The frontend `apiRequest` returns `json.data`, dropping `meta`. Dashboard tables therefore cannot show server total, pagination, or whether more records exist.

**Impact**

Current UI presents only the first default page, usually 50 records, without server-side pagination controls.

**Priority**

P2

**Recommended Fix**

Introduce paginated query types in the data layer:

```ts
type ApiList<T> = { data: T[]; meta: { total: number; limit: number; offset: number } }
```

or add an `apiEnvelopeRequest` helper for resources that need metadata.

### 13. Audit event display lowercases backend enum values

**Files**

- Frontend mapper: `apps/web/lib/api/mappers.ts`
- Backend: `apps/api/src/audit/audit.types.ts`

**Mismatch**

Backend sends enum strings such as `WORKFLOW_RUN_STARTED`; frontend lowercases to `workflow_run_started`.

This is mostly display-compatible, but exact event type filtering or copying from UI back into backend query params would fail unless re-normalized to uppercase.

**Impact**

Low for display; medium if UI adds event-type filters later.

**Priority**

P3

**Recommended Fix**

Store raw event type and derive display label separately.

## Component-Level Notes

### App Shell

- Session handling matches backend `/auth/me`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- Role-based frontend permissions are local and should be kept synchronized with `@agentpass/domain` permissions. There is currently no shared generated permission contract between backend and frontend.
- Top-bar pending approval count is static (`3`) and not derived from `useApprovals`.

Priority: P2

### Home Dashboard

- Uses API-backed hooks for runs, approvals, receipts, and audit, but still imports fixture metrics and fixture active run fallback.
- Active run defaults to fixture `workflowRuns[0]` before API data resolves.
- “Credentials exposed: 0” is static and not backed by any backend metric.

Priority: P2

### Data Tables

- Client-side filtering works on currently loaded rows only.
- No backend query params are used for search, status filters, date filters, or pagination.
- Pagination component exists but is not wired to paginated API metadata.

Priority: P2

### Evidence Components

- Screenshot and file viewers can render mapped evidence objects.
- Workflow run list endpoint does not provide files, so evidence only appears reliably on detail pages.
- File downloads call `/files/:id/download`, which matches backend download path if file IDs are from API. Fixture string files cannot download.

Priority: P2

### Policy Editor

- Local controlled UI now improves UX, but live API save/evaluate still needs canonical payload transformation.
- Frontend edited rule shape should be validated against backend `PolicyValidationService` expectations and `@agentpass/policy-engine` snapshot shape.

Priority: P1

### Settings

- Backend supports organization update and user invite/role/disable.
- UI reads organization/users only and exposes no mutations.

Priority: P2

## Recommended Implementation Order

1. **Add workflow readiness diagnostics** using backend start-run validation logic in read-only mode.
2. **Expose pagination metadata** in frontend data-layer resources and wire pagination controls.
3. **Persist or expose durable receipt hashes** instead of deriving list hashes from IDs.
4. **Consume live policy evaluation responses** in the editor result panel.
5. **Use raw enum values internally** and derive display labels separately.
6. **Expand Settings mutations** for org update, user invite, role changes, and disable.
7. **Consider a dedicated `/search` endpoint** for server-side global search at scale.

## Suggested Contract Tests

Add tests that submit the same payloads generated by dashboard forms to backend Zod schemas or API endpoints:

- Vendor create/update form -> `createVendorSchema` / `updateVendorSchema`
- Credential create form -> `createCredentialSchema`
- Policy create/update/evaluate -> `createPolicySchema`, `updatePolicySchema`, `evaluatePolicySchema`
- Workflow create/update -> `createWorkflowSchema`, `updateWorkflowSchema`

Also add mapper tests with real backend DTO fixtures:

- `mapApproval` with no run join should not show raw UUIDs as final display text.
- `mapWorkflowRun` list DTO should not imply low risk when risk is unknown.
- `mapReceipt` list DTO should not fabricate a trust hash.

## Integrity Verdict

The dashboard is structurally aligned with the backend, but not yet fully contract-aligned. The most important live-read paths exist, and authentication/resource scoping are generally respected. However, create/update flows for several core resources currently submit UI-shaped data rather than backend-shaped DTOs, and several dashboard summaries rely on placeholders when backend list DTOs lack joins or aggregates.

Functional parity is achievable with a focused contract-normalization pass followed by backend DTO enrichment for summary screens.
