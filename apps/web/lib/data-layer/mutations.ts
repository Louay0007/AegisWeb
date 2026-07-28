"use client";

import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback } from "react";

import { errorMessage, isApiError } from "@/lib/api/api-errors";
import { ApiError } from "@/lib/api/api-errors";
import { queryKeys } from "./query-keys";
import { resourceApi } from "./resource-queries";

type FormValues = Record<string, string>;
type ApiObject = Record<string, unknown>;

/**
 * Centralized cache invalidation rules. Keeping these in one place means
 * that "approve an approval" and "reject an approval" can't drift apart,
 * and we never miss invalidating an unrelated list that depended on the
 * same row.
 */
export const invalidation = {
  agents: () => [queryKeys.agents.all],
  vendors: () => [queryKeys.vendors.all, queryKeys.workflows.all, queryKeys.credentials.all],
  credentials: () => [queryKeys.credentials.all],
  policies: () => [queryKeys.policies.all],
  workflows: () => [queryKeys.workflows.all, queryKeys.workflowRuns.all],
  workflowRuns: () => [queryKeys.workflowRuns.all],
  approvals: () => [queryKeys.approvals.all, queryKeys.workflowRuns.all],
  receipts: () => [queryKeys.receipts.all, queryKeys.workflowRuns.all],
  audit: () => [queryKeys.audit.all, queryKeys.workflowRuns.all],
  organization: () => [queryKeys.organization.all, queryKeys.users.all],
} as const;

export type InvalidationGroup = keyof typeof invalidation;

export type MutationMessages = {
  success: string;
  loading?: string;
  errorTitle?: string;
};

export type DashboardMutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, ApiError, TVariables>,
  "mutationFn"
> & {
  /** Group(s) of caches to invalidate on success. */
  invalidate?: InvalidationGroup | InvalidationGroup[];
  /** Per-mutation toast text. */
  messages: MutationMessages;
};

/**
 * Low-level mutation builder. Wraps `useMutation` with toast notifications
 * and cache invalidation so callers don't repeat themselves.
 */
function useDashboardMutationInternal<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: DashboardMutationOptions<TData, TVariables>,
) {
  const queryClient = useQueryClient();
  const { invalidate, messages, ...rest } = options;

  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    ...rest,
    onSuccess: (data, variables, context, mutationContext) => {
      const groups = Array.isArray(invalidate) ? invalidate : invalidate ? [invalidate] : [];
      for (const group of groups) {
        for (const key of invalidation[group]()) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      options.onSuccess?.(data, variables, context, mutationContext);
    },
    onError: (error, variables, context, mutationContext) => {
      toast.error(formatMutationError(error, messages.errorTitle));
      options.onError?.(error, variables, context, mutationContext);
    },
  });
}

/**
 * Used by the legacy `useDashboardMutation` helper from `lib/api/use-dashboard-mutation.ts`.
 * Wraps an arbitrary async call with a toast and a list of post-mutation
 * invalidation callbacks.
 */
export function useDashboardMutationAction() {
  return useCallback(async (mutation: () => Promise<unknown> | unknown, options: { success: string; loading?: string }) => {
    try {
      await toast.promise(Promise.resolve(mutation()), {
        loading: options.loading ?? "Working...",
        success: options.success,
        error: (error) => formatMutationError(error),
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error("Action failed.");
    }
  }, []);
}

function formatMutationError(error: unknown, title?: string) {
  if (isApiError(error)) {
    const request = error.requestId ? ` Request ${error.requestId}.` : "";
    return `${title ? title + ": " : ""}${error.message}${request}`;
  }
  return `${title ? title + ": " : ""}${errorMessage(error)}`;
}

// -- Agent mutations -------------------------------------------------------

export function useCreateAgent(options: DashboardMutationOptions<unknown, FormValues>) {
  return useDashboardMutationInternal((values) => resourceApi.agents.create(values), { invalidate: "agents", ...options });
}

export function useUpdateAgent(options: DashboardMutationOptions<unknown, { id: string; values: FormValues }>) {
  return useDashboardMutationInternal(
    ({ id, values }) => resourceApi.agents.update(id, values),
    { invalidate: "agents", ...options },
  );
}

export function usePauseAgent(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.agents.pause(id), { invalidate: "agents", ...options });
}

export function useResumeAgent(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.agents.resume(id), { invalidate: "agents", ...options });
}

export function useRevokeAgent(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.agents.revoke(id), { invalidate: "agents", ...options });
}

// -- Vendor mutations ------------------------------------------------------

export function useCreateVendor(options: DashboardMutationOptions<unknown, FormValues>) {
  return useDashboardMutationInternal((values) => resourceApi.vendors.create(normalizeVendorPayload(values)), { invalidate: "vendors", ...options });
}

export function useUpdateVendor(options: DashboardMutationOptions<unknown, { id: string; values: FormValues }>) {
  return useDashboardMutationInternal(
    ({ id, values }) => resourceApi.vendors.update(id, normalizeVendorPayload(values)),
    { invalidate: "vendors", ...options },
  );
}

export function useDeleteVendor(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.vendors.remove(id), { invalidate: "vendors", ...options });
}

// -- Credential mutations --------------------------------------------------

export function useCreateCredential(
  options: DashboardMutationOptions<unknown, { values: FormValues; stepUpToken?: string } | FormValues>,
) {
  return useDashboardMutationInternal(
    (input) => {
      const values = isFormValues(input) ? input : input.values;
      const stepUpToken = isFormValues(input) ? undefined : input.stepUpToken;
      return resourceApi.credentials.create(normalizeCredentialPayload(values), { stepUpToken });
    },
    { invalidate: "credentials", ...options },
  );
}

export function useGrantCredential(options: DashboardMutationOptions<unknown, { id: string; values: FormValues }>) {
  return useDashboardMutationInternal(
    ({ id, values }) => resourceApi.credentials.grant(id, { agentId: values.agentId, scope: values.scope || "login" }),
    { invalidate: "credentials", ...options },
  );
}

export function useRevokeCredential(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.credentials.revoke(id), { invalidate: "credentials", ...options });
}

export function useRevokeGrant(options: DashboardMutationOptions<unknown, { id: string; grantId: string }>) {
  return useDashboardMutationInternal(
    ({ id, grantId }) => resourceApi.credentials.revokeGrant(id, grantId),
    { invalidate: "credentials", ...options },
  );
}

// -- Policy mutations ------------------------------------------------------

export function useCreatePolicy(options: DashboardMutationOptions<unknown, FormValues>) {
  return useDashboardMutationInternal((values) => resourceApi.policies.create(normalizePolicyCreatePayload(values)), { invalidate: "policies", ...options });
}

export function useUpdatePolicy(
  options: DashboardMutationOptions<
    unknown,
    { id: string; values: Record<string, unknown>; stepUpToken?: string }
  >,
) {
  return useDashboardMutationInternal(
    ({ id, values, stepUpToken }) =>
      resourceApi.policies.update(id, normalizePolicyUpdatePayload(values), { stepUpToken }),
    { invalidate: "policies", ...options },
  );
}

export function useEvaluatePolicy(options: DashboardMutationOptions<unknown, { id: string; values: Record<string, unknown> }>) {
  return useDashboardMutationInternal(
    ({ id, values }) => resourceApi.policies.evaluate(normalizePolicyEvaluationPayload(id, values)),
    { invalidate: "policies", ...options },
  );
}

// -- Workflow mutations ----------------------------------------------------

export function useCreateWorkflow(options: DashboardMutationOptions<unknown, FormValues>) {
  return useDashboardMutationInternal((values) => resourceApi.workflows.create(normalizeWorkflowPayload(values)), { invalidate: "workflows", ...options });
}

export function useUpdateWorkflow(options: DashboardMutationOptions<unknown, { id: string; values: FormValues }>) {
  return useDashboardMutationInternal(
    ({ id, values }) => resourceApi.workflows.update(id, normalizeWorkflowPayload(values)),
    { invalidate: "workflows", ...options },
  );
}

export function useStartWorkflow(options: DashboardMutationOptions<{ run: { id: string } }, { id: string }>) {
  return useDashboardMutationInternal(({ id }) => resourceApi.workflows.run(id), { invalidate: "workflowRuns", ...options });
}

// -- Workflow run mutations ------------------------------------------------

export function useCancelWorkflowRun(options: DashboardMutationOptions<unknown, string>) {
  return useDashboardMutationInternal((id) => resourceApi.workflowRuns.cancel(id), { invalidate: "workflowRuns", ...options });
}

// -- Approval mutations ----------------------------------------------------

export function useApproveRequest(options: DashboardMutationOptions<unknown, { id: string; comment?: string }>) {
  return useDashboardMutationInternal(
    ({ id, comment }) => resourceApi.approvals.approve(id, comment ? { comment } : {}),
    { invalidate: "approvals", ...options },
  );
}

export function useRejectRequest(options: DashboardMutationOptions<unknown, { id: string; comment?: string }>) {
  return useDashboardMutationInternal(
    ({ id, comment }) => resourceApi.approvals.reject(id, { comment: comment ?? "" }),
    { invalidate: "approvals", ...options },
  );
}

function isFormValues(
  input: FormValues | { values: FormValues; stepUpToken?: string },
): input is FormValues {
  return !("values" in input);
}

function normalizeVendorPayload(values: FormValues): ApiObject {
  const payload: ApiObject = {
    name: values.name,
    website: values.website,
    category: values.category,
    connectorType: values.connectorType || "sandbox",
  };
  if (values.renewalDate) payload.renewalDate = values.renewalDate;
  if (values.monthlyCost) payload.monthlyCostCents = dollarsToCents(values.monthlyCost);
  const metadata: ApiObject = {};
  if (values.unusedSeats) metadata.unusedSeats = Number(values.unusedSeats);
  if (values.githubOrganization) metadata.githubOrganization = values.githubOrganization;
  if (values.targetPlan) metadata.targetPlan = values.targetPlan;
  if (Object.keys(metadata).length > 0) payload.metadataJson = metadata;
  return compact(payload);
}

function normalizeCredentialPayload(values: FormValues): ApiObject {
  const secretJson: ApiObject =
    values.credentialType === "username_password"
      ? { username: values.username, password: values.password }
      : { value: values.password };
  if (values.totpSecret) {
    secretJson.totpSecret = values.totpSecret;
  }
  return compact({
    vendorId: values.vendorId,
    label: values.label,
    credentialType: values.credentialType,
    secretJson,
  });
}

function normalizePolicyCreatePayload(values: FormValues): ApiObject {
  return compact({
    agentId: values.agentId || undefined,
    name: values.name,
    type: values.type,
    status: values.status,
    rulesJson: buildPolicySnapshot({
      allowedDomains: splitList(values.allowedDomains),
      blockedDomains: splitList(values.blockedDomains),
      approvalRequiredActions: splitList(values.approvalActions),
    }),
  });
}

function normalizePolicyUpdatePayload(values: Record<string, unknown>): ApiObject {
  const payload: ApiObject = { ...values };
  if (typeof payload.rulesJson === "string") {
    payload.rulesJson = parseJsonObject(payload.rulesJson);
  }
  return compact(payload);
}

function normalizePolicyEvaluationPayload(policyId: string, values: Record<string, unknown>): ApiObject {
  const amount = typeof values.amountCents === "number" ? values.amountCents : dollarsToCents(String(values.amount ?? "0"));
  const riskSignals = Array.isArray(values.riskSignals)
    ? values.riskSignals
    : typeof values.riskSignals === "string"
      ? splitList(values.riskSignals)
      : [];
  return compact({
    policyId,
    agentId: values.agentId,
    website: values.website,
    actionType: values.actionType,
    amountCents: amount,
    riskSignals,
    policySnapshot: typeof values.policySnapshot === "string" ? parseJsonObject(values.policySnapshot) : values.policySnapshot,
  });
}

function normalizeWorkflowPayload(values: FormValues): ApiObject {
  return compact({
    name: values.name,
    template: values.template,
    agentId: values.agentId,
    vendorId: values.vendorId,
    status: values.status,
    configurationJson: compact({
      credentialId: values.credentialId,
      targetPlan: values.targetPlan,
    }),
  });
}

function buildPolicySnapshot(input: { allowedDomains: string[]; blockedDomains: string[]; approvalRequiredActions: string[] }) {
  return {
    allowedDomains: input.allowedDomains,
    blockedDomains: input.blockedDomains,
    allowedActions: ["open_page", "read_page", "download_file"],
    deniedActions: ["invite_user", "change_billing_details"],
    approvalRequiredActions: input.approvalRequiredActions.length ? input.approvalRequiredActions : ["submit_form", "change_plan", "cancel_subscription", "make_purchase"],
    autoApproveBelowCents: 0,
    approvalRequiredAboveCents: 10_000_00,
    denyAboveCents: 50_000_00,
    dangerKeywords: ["delete", "cancel", "confirm", "wire", "bank", "admin", "owner"],
    businessHours: { enabled: false },
  };
}

function dollarsToCents(value: string) {
  const amount = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function compact(value: ApiObject) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}
