import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost, apiPatch, apiDelete, apiDownload } from "@/lib/api/api-client";
import {
  mapAgent,
  mapApproval,
  mapAuditEvent,
  mapCredential,
  mapPolicy,
  mapReceipt,
  mapVendor,
  mapWorkflow,
  mapWorkflowRun,
  type AgentDto,
  type ApprovalRequestDto,
  type AuditEventDto,
  type CredentialDto,
  type OrganizationDto,
  type PolicyDto,
  type ReceiptDetailDto,
  type ReceiptListDto,
  type UserDto,
  type VendorDto,
  type WorkflowDto,
  type WorkflowRunDetailDto,
  type WorkflowRunSummaryDto,
} from "@/lib/api/mappers";
import type { AgentFixture, ApprovalFixture, AuditEventFixture, CredentialFixture, PolicyFixture, ReceiptFixture, VendorFixture, WorkflowFixture, WorkflowRunFixture } from "@/lib/fixtures/dashboard";
import { queryKeys, type QueryKeys } from "./query-keys";
import { gcTime, staleTime } from "./query-client";

/**
 * `queryOptions` factories wrap a fetcher with a stable query key, retry
 * policy, and stale/gc times. They are the recommended way to co-locate
 * "how to read this resource" with the cache configuration it needs.
 */
export const resourceQueries = {
  agents: {
    list: () =>
      queryOptions<AgentFixture[]>({
        queryKey: queryKeys.agents.list(),
        queryFn: async () => (await apiGet<AgentDto[]>("/agents")).map(mapAgent),
        staleTime: staleTime.list,
        gcTime: gcTime.default,
      }),
    detail: (id: string) =>
      queryOptions<AgentFixture>({
        queryKey: queryKeys.agents.detail(id),
        queryFn: async () => mapAgent(await apiGet<AgentDto>(`/agents/${id}`)),
        staleTime: staleTime.list,
      }),
  },
  vendors: {
    list: () =>
      queryOptions<VendorFixture[]>({
        queryKey: queryKeys.vendors.list(),
        queryFn: async () => (await apiGet<VendorDto[]>("/vendors")).map(mapVendor),
        staleTime: staleTime.list,
      }),
    detail: (id: string) =>
      queryOptions<VendorFixture>({
        queryKey: queryKeys.vendors.detail(id),
        queryFn: async () => mapVendor(await apiGet<VendorDto>(`/vendors/${id}`)),
        staleTime: staleTime.list,
      }),
  },
  credentials: {
    list: () =>
      queryOptions<CredentialFixture[]>({
        queryKey: queryKeys.credentials.list(),
        queryFn: async () => {
          const [credentials, vendors, agents] = await Promise.all([
            apiGet<CredentialDto[]>("/credentials"),
            apiGet<VendorDto[]>("/vendors").then((items) => items.map(mapVendor)),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
          ]);
          return credentials.map((credential) => mapCredential(credential, vendors, agents));
        },
        // Credentials combine three resources. They don't need sub-second
        // freshness, but invalidate whenever any of the upstream keys move.
        staleTime: staleTime.list,
      }),
    detail: (id: string) =>
      queryOptions<CredentialFixture>({
        queryKey: queryKeys.credentials.detail(id),
        queryFn: async () => {
          const [credential, vendors, agents] = await Promise.all([
            apiGet<CredentialDto>(`/credentials/${id}`),
            apiGet<VendorDto[]>("/vendors").then((items) => items.map(mapVendor)),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
          ]);
          return mapCredential(credential, vendors, agents);
        },
        staleTime: staleTime.list,
      }),
  },
  policies: {
    list: () =>
      queryOptions<PolicyFixture[]>({
        queryKey: queryKeys.policies.list(),
        queryFn: async () => {
          const [policies, agents] = await Promise.all([
            apiGet<PolicyDto[]>("/policies"),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
          ]);
          return policies.map((policy) => mapPolicy(policy, agents));
        },
        staleTime: staleTime.list,
      }),
    detail: (id: string) =>
      queryOptions<PolicyFixture>({
        queryKey: queryKeys.policies.detail(id),
        queryFn: async () => {
          const [policy, agents] = await Promise.all([
            apiGet<PolicyDto>(`/policies/${id}`),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
          ]);
          return mapPolicy(policy, agents);
        },
        staleTime: staleTime.list,
      }),
  },
  workflows: {
    list: () =>
      queryOptions<WorkflowFixture[]>({
        queryKey: queryKeys.workflows.list(),
        queryFn: async () => {
          const [workflows, agents, vendors] = await Promise.all([
            apiGet<WorkflowDto[]>("/workflows"),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
            apiGet<VendorDto[]>("/vendors").then((items) => items.map(mapVendor)),
          ]);
          return workflows.map((workflow) => mapWorkflow(workflow, agents, vendors));
        },
        staleTime: staleTime.list,
      }),
    detail: (id: string) =>
      queryOptions<WorkflowFixture>({
        queryKey: queryKeys.workflows.detail(id),
        queryFn: async () => {
          const [workflow, agents, vendors] = await Promise.all([
            apiGet<WorkflowDto>(`/workflows/${id}`),
            apiGet<AgentDto[]>("/agents").then((items) => items.map(mapAgent)),
            apiGet<VendorDto[]>("/vendors").then((items) => items.map(mapVendor)),
          ]);
          return mapWorkflow(workflow, agents, vendors);
        },
        staleTime: staleTime.list,
      }),
  },
  workflowRuns: {
    list: () =>
      queryOptions<WorkflowRunFixture[]>({
        queryKey: queryKeys.workflowRuns.list(),
        queryFn: async () => (await apiGet<WorkflowRunSummaryDto[]>("/workflow-runs")).map(mapWorkflowRun),
        // The home dashboard polls these every 30s; keep them fresh so a
        // background refetch doesn't tear the UI.
        staleTime: staleTime.nearRealtime,
        refetchInterval: 30_000,
      }),
    detail: (id: string) =>
      queryOptions<WorkflowRunFixture>({
        queryKey: queryKeys.workflowRuns.detail(id),
        queryFn: async () => mapWorkflowRun(await apiGet<WorkflowRunDetailDto>(`/workflow-runs/${id}`)),
        // Run detail pages often watch a run as it executes; poll every 2s
        // while the tab is visible.
        staleTime: staleTime.realtime,
        refetchInterval: 2_000,
      }),
    audit: (id: string) =>
      queryOptions<AuditEventFixture[]>({
        queryKey: queryKeys.workflowRuns.audit(id),
        queryFn: async () =>
          (await apiGet<AuditEventDto[]>(`/audit-events?workflowRunId=${encodeURIComponent(id)}`)).map(mapAuditEvent),
        staleTime: staleTime.realtime,
      }),
  },
  approvals: {
    list: () =>
      queryOptions<ApprovalFixture[]>({
        queryKey: queryKeys.approvals.list(),
        queryFn: async () => {
          const [approvals, runs] = await Promise.all([
            apiGet<ApprovalRequestDto[]>("/approvals"),
            apiGet<WorkflowRunSummaryDto[]>("/workflow-runs").then((items) => items.map(mapWorkflowRun)),
          ]);
          return approvals.map((approval) => mapApproval(approval, runs));
        },
        // Approval queue is a high-traffic widget, keep it fresh.
        staleTime: staleTime.realtime,
        refetchInterval: 30_000,
      }),
    detail: (id: string) =>
      queryOptions<ApprovalFixture>({
        queryKey: queryKeys.approvals.detail(id),
        queryFn: async () => {
          const approval = await apiGet<ApprovalRequestDto>(`/approvals/${id}`);
          const runs = await apiGet<WorkflowRunSummaryDto[]>("/workflow-runs").then((items) => items.map(mapWorkflowRun));
          return mapApproval(approval, runs);
        },
        staleTime: staleTime.nearRealtime,
      }),
  },
  receipts: {
    list: () =>
      queryOptions<ReceiptFixture[]>({
        queryKey: queryKeys.receipts.list(),
        queryFn: async () => (await apiGet<ReceiptListDto[]>("/receipts")).map(mapReceipt),
        staleTime: staleTime.list,
      }),
    detail: (id: string) =>
      queryOptions<ReceiptFixture>({
        queryKey: queryKeys.receipts.detail(id),
        queryFn: async () => mapReceipt(await apiGet<ReceiptDetailDto>(`/receipts/${id}`)),
        staleTime: staleTime.list,
      }),
  },
  audit: {
    list: (path: string = "/audit-events") =>
      queryOptions<AuditEventFixture[]>({
        queryKey: queryKeys.audit.list(path),
        queryFn: async () => (await apiGet<AuditEventDto[]>(path)).map(mapAuditEvent),
        staleTime: staleTime.list,
      }),
  },
  organization: {
    detail: () =>
      queryOptions<OrganizationDto | null>({
        queryKey: queryKeys.organization.detail(),
        queryFn: () => apiGet<OrganizationDto>("/organization"),
        staleTime: staleTime.static,
      }),
    users: () =>
      queryOptions<UserDto[]>({
        queryKey: queryKeys.users.list(),
        queryFn: () => apiGet<UserDto[]>("/users"),
        staleTime: staleTime.list,
      }),
  },
} as const;

/**
 * Thin wrappers around the raw HTTP verbs so the mutation layer can swap
 * implementations in tests without mocking fetch directly.
 */
export const resourceApi = {
  agents: {
    create: (body: unknown) => apiPost("/agents", body),
    update: (id: string, body: unknown) => apiPatch(`/agents/${id}`, body),
    pause: (id: string) => apiPost(`/agents/${id}/pause`, {}),
    resume: (id: string) => apiPost(`/agents/${id}/resume`, {}),
    revoke: (id: string) => apiPost(`/agents/${id}/revoke`, {}),
  },
  vendors: {
    create: (body: unknown) => apiPost("/vendors", body),
    update: (id: string, body: unknown) => apiPatch(`/vendors/${id}`, body),
    remove: (id: string) => apiDelete(`/vendors/${id}`),
  },
  credentials: {
    create: (body: unknown) => apiPost("/credentials", body),
    grant: (id: string, body: unknown) => apiPost(`/credentials/${id}/grants`, body),
    revoke: (id: string) => apiPost(`/credentials/${id}/revoke`, {}),
    revokeGrant: (id: string, grantId: string) => apiDelete(`/credentials/${id}/grants/${grantId}`),
  },
  policies: {
    create: (body: unknown) => apiPost("/policies", body),
    update: (id: string, body: unknown) => apiPatch(`/policies/${id}`, body),
    evaluate: (body: unknown) => apiPost("/policies/evaluate", body),
  },
  workflows: {
    create: (body: unknown) => apiPost("/workflows", body),
    update: (id: string, body: unknown) => apiPatch(`/workflows/${id}`, body),
    run: (id: string) => apiPost<{ run: { id: string } }>(`/workflows/${id}/runs`, {}),
  },
  workflowRuns: {
    cancel: (id: string) => apiPost(`/workflow-runs/${id}/cancel`, {}),
  },
  approvals: {
    approve: (id: string, body: { comment?: string } = {}) => apiPost(`/approvals/${id}/approve`, body),
    reject: (id: string, body: { comment?: string }) => apiPost(`/approvals/${id}/reject`, body),
  },
  receipts: {
    export: (id: string) => apiDownload(`/receipts/${id}/export`),
    file: (fileId: string) => apiDownload(`/files/${fileId}/download`),
  },
} as const;

// Helpful re-exports so consumers can `import { resourceQueries } from "@/lib/data-layer"` and grab a query.
export type { QueryKeys };
