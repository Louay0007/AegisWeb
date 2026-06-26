"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { ApiError, errorMessage, isApiError } from "@/lib/api/api-errors";
import type { PaginationMeta } from "@/lib/api/pagination";
import type { UserDto } from "@/lib/api/mappers";
import { useAuthSession } from "@/lib/auth/auth-session";
import {
  agents as agentsFixture,
  approvals as approvalsFixture,
  auditEvents as auditEventsFixture,
  credentials as credentialsFixture,
  findById,
  policies as policiesFixture,
  receipts as receiptsFixture,
  vendors as vendorsFixture,
  workflows as workflowsFixture,
  workflowRuns as workflowRunsFixture,
  type AgentFixture,
  type ApprovalFixture,
  type AuditEventFixture,
  type CredentialFixture,
  type PolicyFixture,
  type ReceiptFixture,
  type VendorFixture,
  type WorkflowFixture,
  type WorkflowRunFixture,
} from "@/lib/fixtures/dashboard";
import { resourceQueries } from "./resource-queries";
import { isFixtureFallbackEnabled } from "@/lib/runtime-config";
import { isFixtureMode } from "./feature-flags";

/**
 * Resource status mirrors the previous `useApiResource` shape. The dashboard
 * code base is built around four states: loading, success, empty, and error.
 * This type keeps the existing component code working without rewrites.
 */
export type ResourceStatus<T> =
  | { status: "loading" }
  | { status: "success"; data: T; source: "api" | "fixture" }
  | { status: "empty"; data: T; source: "api" | "fixture" }
  | { status: "error"; error: ApiError; fallbackData?: T };

export type ResourceHookResult<T> = {
  state: ResourceStatus<T>;
  reload: () => Promise<unknown>;
};

export type PaginatedHookResult<T> = {
  items: T[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | undefined;
  updatedAt?: number;
  reload: () => Promise<unknown>;
};

function defaultIsEmpty<T>(data: T): boolean {
  return Array.isArray(data) ? data.length === 0 : !data;
}

function normalizeApiError(error: unknown): ApiError {
  return isApiError(error)
    ? error
    : new ApiError({
        code: "QUERY_ERROR",
        message:
          error instanceof Error ? error.message : "Could not load resource.",
      });
}

function toResourceState<T>(
  result: UseQueryResult<T, Error>,
  _fallbackData: T,
): ResourceStatus<T> {
  if (result.isPending && !result.data) {
    return { status: "loading" };
  }
  if (result.isError) {
    return {
      status: "error",
      error: normalizeApiError(result.error),
    };
  }
  const data = result.data as T;
  const source: "api" | "fixture" =
    result.fetchStatus === "idle" && !result.isFetching ? "api" : "api";
  return defaultIsEmpty(data)
    ? { status: "empty", data, source }
    : { status: "success", data, source };
}

/**
 * Shared "should I use the live API or fixture data" check. Mirrors the old
 * `useApiResource` decision tree so the visual contract stays identical.
 */
function useShouldUseFixture(): boolean {
  const { state } = useAuthSession();
  if (!isFixtureFallbackEnabled()) {
    return false;
  }
  return (
    isFixtureMode() ||
    state.status === "demo"
  );
}

function useCommonQueryResult<T>(
  result: UseQueryResult<T, Error>,
  fallbackData: T,
  fallbackEnabled: boolean,
): ResourceHookResult<T> {
  return useMemo<ResourceHookResult<T>>(() => {
    // In demo / fixture mode we always return the bundled data without
    // trying the network. The previous implementation emitted fixture state
    // immediately; preserve that behavior so UI tests stay deterministic.
    if (fallbackEnabled) {
      const state: ResourceStatus<T> = defaultIsEmpty(fallbackData)
        ? { status: "empty", data: fallbackData, source: "fixture" }
        : { status: "success", data: fallbackData, source: "fixture" };
      return { state, reload: async () => undefined };
    }
    return {
      state: toResourceState(result, fallbackData),
      reload: async () => result.refetch(),
    };
  }, [fallbackData, fallbackEnabled, result]);
}

// -- Agents ----------------------------------------------------------------

export function useAgents(): ResourceHookResult<AgentFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.agents.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, agentsFixture, fixture);
}

export function useAgent(id: string): ResourceHookResult<AgentFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.agents.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(agentsFixture, id), fixture);
}

// -- Vendors ---------------------------------------------------------------

export function useVendors(): ResourceHookResult<VendorFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.vendors.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, vendorsFixture, fixture);
}

export function useVendor(id: string): ResourceHookResult<VendorFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.vendors.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(vendorsFixture, id), fixture);
}

// -- Credentials -----------------------------------------------------------

export function useCredentials(): ResourceHookResult<CredentialFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.credentials.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, credentialsFixture, fixture);
}

export function useCredential(
  id: string,
): ResourceHookResult<CredentialFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.credentials.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(
    result,
    findById(credentialsFixture, id),
    fixture,
  );
}

// -- Policies --------------------------------------------------------------

export function usePolicies(): ResourceHookResult<PolicyFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.policies.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, policiesFixture, fixture);
}

export function usePolicy(id: string): ResourceHookResult<PolicyFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.policies.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(policiesFixture, id), fixture);
}

// -- Workflows -------------------------------------------------------------

export function useWorkflows(): ResourceHookResult<WorkflowFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.workflows.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, workflowsFixture, fixture);
}

export function useWorkflow(id: string): ResourceHookResult<WorkflowFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.workflows.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(workflowsFixture, id), fixture);
}

// -- Workflow Runs ---------------------------------------------------------

export function useWorkflowRuns(): ResourceHookResult<WorkflowRunFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.workflowRuns.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, workflowRunsFixture, fixture);
}

export function useWorkflowRun(
  id: string,
): ResourceHookResult<WorkflowRunFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.workflowRuns.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(
    result,
    findById(workflowRunsFixture, id),
    fixture,
  );
}

export function useWorkflowRunAudit(
  id: string,
): ResourceHookResult<AuditEventFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.workflowRuns.audit(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(
    result,
    auditEventsFixture.filter((event) => event.workflowRun === id),
    fixture,
  );
}

// -- Approvals -------------------------------------------------------------

export function useApprovals(): ResourceHookResult<ApprovalFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.approvals.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, approvalsFixture, fixture);
}

export function useApproval(id: string): ResourceHookResult<ApprovalFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.approvals.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(approvalsFixture, id), fixture);
}

// -- Receipts --------------------------------------------------------------

export function useReceipts(): ResourceHookResult<ReceiptFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.receipts.list(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, receiptsFixture, fixture);
}

export function useReceipt(id: string): ResourceHookResult<ReceiptFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.receipts.detail(id),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, findById(receiptsFixture, id), fixture);
}

// -- Audit -----------------------------------------------------------------

export function useAuditEvents(
  path: string = "/audit-events",
): ResourceHookResult<AuditEventFixture[]> {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.audit.list(path),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, auditEventsFixture, fixture);
}

export function usePaginatedAuditEvents(page: number, limit: number = 50): PaginatedHookResult<AuditEventFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.audit.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(auditEventsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

// -- Paginated hooks -------------------------------------------------------

function usePaginatedFixture<T>(
  fixtureData: T[],
  page: number,
  limit: number,
): PaginatedHookResult<T> {
  return useMemo(() => {
    const total = fixtureData.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
      return {
        items: fixtureData.slice(start, start + limit),
        meta: { total, page, limit, totalPages },
        isLoading: false,
        error: undefined,
        updatedAt: Date.now(),
        reload: async () => {},
      };
  }, [fixtureData, page, limit]);
}

function useApiPaginatedResult<T>(
  result: UseQueryResult<{ data: T[]; meta: PaginationMeta }, Error>,
  page: number,
  limit: number,
): PaginatedHookResult<T> {
  return useMemo(() => {
    if (result.isError) {
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
        isLoading: false,
        error: errorMessage(result.error),
        updatedAt: result.dataUpdatedAt || undefined,
        reload: async () => result.refetch(),
      };
    }
    return {
      items: result.data?.data ?? [],
      meta: result.data?.meta ?? { total: 0, page, limit, totalPages: 0 },
      isLoading: result.isPending && !result.data,
      error: undefined,
      updatedAt: result.dataUpdatedAt || undefined,
      reload: async () => result.refetch(),
    };
  }, [result, page, limit]);
}

export function usePaginatedAgents(page: number, limit: number = 20): PaginatedHookResult<AgentFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.agents.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(agentsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedVendors(page: number, limit: number = 20): PaginatedHookResult<VendorFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.vendors.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(vendorsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedCredentials(page: number, limit: number = 20): PaginatedHookResult<CredentialFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.credentials.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(credentialsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedPolicies(page: number, limit: number = 20): PaginatedHookResult<PolicyFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.policies.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(policiesFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedWorkflows(page: number, limit: number = 20): PaginatedHookResult<WorkflowFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.workflows.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(workflowsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedWorkflowRuns(page: number, limit: number = 20): PaginatedHookResult<WorkflowRunFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.workflowRuns.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(workflowRunsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedApprovals(page: number, limit: number = 20): PaginatedHookResult<ApprovalFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.approvals.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(approvalsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedReceipts(page: number, limit: number = 20): PaginatedHookResult<ReceiptFixture> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.receipts.paginatedList(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture(receiptsFixture, page, limit) : useApiPaginatedResult(result, page, limit);
}

export function usePaginatedUsers(page: number, limit: number = 20): PaginatedHookResult<UserDto> {
  const fixture = useShouldUseFixture();
  const result = useQuery({ ...resourceQueries.organization.paginatedUsers(page, limit), enabled: !fixture });
  return fixture ? usePaginatedFixture([], page, limit) : useApiPaginatedResult(result, page, limit);
}

// -- Organization / Users --------------------------------------------------

export function useOrganization() {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.organization.detail(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, null, fixture);
}

export function useUsers() {
  const fixture = useShouldUseFixture();
  const result = useQuery({
    ...resourceQueries.organization.users(),
    enabled: !fixture,
  });
  return useCommonQueryResult(result, [], fixture);
}

/**
 * Convenience helper used by components to flatten a resource into a list.
 */
export function pickItems<T>(
  result: ResourceHookResult<T[]>,
  fallback: T[],
): T[] {
  if (result.state.status === "success" || result.state.status === "empty") {
    return result.state.data;
  }
  void fallback;
  return [];
}

export function pickItem<T>(result: ResourceHookResult<T>, fallback: T): T {
  if (result.state.status === "success" || result.state.status === "empty") {
    return result.state.data;
  }
  return fallback;
}

export { isApiError };
