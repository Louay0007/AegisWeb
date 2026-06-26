"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Eye, Plus } from "iconoir-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PaginationControls } from "@/components/data/pagination-controls";
import { StatePanel } from "@/components/data/state-panel";
import { SearchInput } from "@/components/data/search-input";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { StatusBadge } from "@/components/display/status-badge";
import { WorkflowRunStatusBadge } from "@/components/display/workflow-run-status-badge";
import { AuditEventDrawer } from "@/components/evidence/audit-event-drawer";
import { StartWorkflowFlow } from "@/components/product/start-workflow-flow";
import { ApprovalDetailScreen } from "@/components/product/approval-detail-screen";
import {
  AgentManagementDetail,
  AgentsManagementPage,
  CredentialManagementDetail,
  CredentialsManagementPage,
  PolicyCreateDialog,
  PolicyEditorScreen,
  VendorManagementDetail,
  VendorsManagementPage,
  WorkflowManagementDetail,
  WorkflowsManagementPage,
} from "@/components/product/management-screens";
import { ReceiptDetailScreen } from "@/components/product/receipt-detail-screen";
import { WorkflowRunDetailScreen } from "@/components/product/workflow-run-detail-screen";
import { errorMessage } from "@/lib/api/api-errors";
import {
  useAgents,
  useAgent,
  useApproval,
  useAuditEvents,
  useApproveRequest,
  useRejectRequest,
  useCancelWorkflowRun,
  useCreateAgent,
  useCreateCredential,
  useCreatePolicy,
  useCreateVendor,
  useCreateWorkflow,
  useCredentials,
  useCredential,
  useDeleteVendor,
  useEvaluatePolicy,
  useGrantCredential,
  useOrganization,
  usePolicies,
  usePolicy,
  usePauseAgent,
  useReceipt,
  useResumeAgent,
  useRevokeAgent,
  useRevokeCredential,
  useRevokeGrant,
  useStartWorkflow,
  useUpdateAgent,
  useUpdatePolicy,
  useUpdateVendor,
  useUpdateWorkflow,
  useUsers,
  useVendors,
  useVendor,
  useWorkflowRun,
  useWorkflowRunAudit,
  useWorkflowRuns,
  useWorkflows,
  useWorkflow,
  usePaginatedApprovals,
  usePaginatedAuditEvents,
  usePaginatedPolicies,
  usePaginatedReceipts,
  usePaginatedWorkflowRuns,
  pickItems,
  type ResourceHookResult,
} from "@/lib/data-layer";
import { downloadEndpoint } from "@/lib/data-layer/download";
import {
  agents,
  credentials,
  policies,
  vendors,
  workflows,
  workflowRuns,
  type ApprovalFixture,
  type AuditEventFixture,
  type PolicyFixture,
  type ReceiptFixture,
  type WorkflowRunFixture,
} from "@/lib/fixtures/dashboard";
import { formatCurrency } from "@/lib/format/formatters";
import { useAuthSession } from "@/lib/auth/auth-session";
import { can } from "@/lib/permissions/permissions";

function Toolbar({
  placeholder,
  action,
  query,
  onQueryChange,
  resultCount,
}: {
  placeholder: string;
  action?: string;
  query?: string;
  onQueryChange?: (value: string) => void;
  resultCount?: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          placeholder={placeholder}
          value={query}
          onChange={onQueryChange}
        />
        {typeof resultCount === "number" ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {resultCount} shown
          </span>
        ) : null}
      </div>
      {action ? (
        <Button className="h-10">
          <Plus className="size-4" strokeWidth={1.8} />
          {action}
        </Button>
      ) : null}
    </div>
  );
}

function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-medium transition-colors hover:text-muted-foreground"
    >
      {children}
      <ArrowRight className="size-3.5" strokeWidth={1.8} />
    </Link>
  );
}

function resourceSource<T>(resource: ResourceHookResult<T>) {
  return resource.state.status === "success" || resource.state.status === "empty"
    ? resource.state.source
    : undefined;
}

function resolveDetailRecord<T extends { id: string }>(
  resource: ResourceHookResult<T>,
  id: string,
) {
  if (resource.state.status !== "success" && resource.state.status !== "empty") {
    return null;
  }

  return resource.state.data.id === id ? resource.state.data : null;
}

function ResourceNotice({ source }: { source?: "api" | "fixture" }) {
  return source === "fixture" ? (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Showing demo fixture data because the API is unavailable or demo mode is
      active.
    </div>
  ) : null;
}

function useRole() {
  const { state } = useAuthSession();
  return state.status === "authenticated" || state.status === "demo"
    ? state.session.user.role
    : undefined;
}

function useManagementPermissions() {
  const role = useRole();
  return useMemo(
    () => ({
      agents: {
        create: can(role, "agent:create"),
        update: can(role, "agent:update"),
        pause: can(role, "agent:pause"),
        revoke: can(role, "agent:revoke"),
      },
      vendors: {
        create: can(role, "vendor:create"),
        update: can(role, "vendor:update"),
        delete: can(role, "vendor:delete"),
      },
      credentials: {
        create: can(role, "credential:create"),
        grant: can(role, "credential:grant"),
        revoke: can(role, "credential:revoke"),
      },
      policies: {
        create: can(role, "policy:create"),
        update: can(role, "policy:update"),
        evaluate: can(role, "policy:evaluate"),
      },
      workflows: {
        create: can(role, "workflow:create"),
        update: can(role, "workflow:update"),
        run: can(role, "workflow:run"),
      },
    }),
    [role],
  );
}

function useSettingsPermissions() {
  const role = useRole();
  return {
    manage: role ? ["OWNER", "ADMIN"].includes(role.toUpperCase()) : false,
  };
}

function useSyncedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageFromUrl = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const [page, setPageState] = useState(pageFromUrl);

  useEffect(() => {
    setPageState((current) => (current === pageFromUrl ? current : pageFromUrl));
  }, [pageFromUrl]);

  const setPage = (nextPage: number) => {
    const normalized = Math.max(1, nextPage);
    const params = new URLSearchParams(searchParams.toString());
    if (normalized === 1) {
      params.delete("page");
    } else {
      params.set("page", String(normalized));
    }
    const query = params.toString();
    setPageState(normalized);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return [page, setPage] as const;
}

function sourceIsApi(source?: "api" | "fixture") {
  return source === "api";
}

function filterRows<T>(rows: T[], query: string, text: (row: T) => string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => text(row).toLowerCase().includes(normalized));
}

function enhanceAgents(
  agentItems: typeof agents,
  policyItems: typeof policies,
  credentialItems: typeof credentials,
  runItems: typeof workflowRuns,
) {
  return agentItems.map((agent) => {
    const policy = policyItems.find((item) => item.agent === agent.name);
    const grants = credentialItems
      .filter((credential) => credential.grantedAgents.includes(agent.name))
      .map((credential) => credential.label);
    const relatedRuns = runItems.filter((run) => run.agent === agent.name);
    return {
      ...agent,
      policy: policy?.name ?? "No active policy",
      recentRuns: relatedRuns.length,
      credentialGrants: grants,
      lastActivity: relatedRuns[0]?.startedAt ?? agent.lastActivity,
    };
  });
}

// -- Page components -------------------------------------------------------

export function AgentsPage() {
  const [page, setPage] = useSyncedPage();
  const limit = 20;
  const agentsResource = useAgents();
  const policiesResource = usePolicies();
  const credentialsResource = useCredentials();
  const runsResource = useWorkflowRuns();
  const permissions = useManagementPermissions();
  const createAgent = useCreateAgent({
    messages: { success: "Agent created." },
  });
  const updateAgent = useUpdateAgent({
    messages: { success: "Agent updated." },
  });
  const agentItems = enhanceAgents(
    pickItems(agentsResource, agents),
    pickItems(policiesResource, policies),
    pickItems(credentialsResource, credentials),
    pickItems(runsResource, workflowRuns),
  );
  const total = agentItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const displayItems = agentItems.slice(start, start + limit);
  const apiMode = sourceIsApi(
    agentsResource.state.status === "success" ||
      agentsResource.state.status === "empty"
      ? agentsResource.state.source
      : undefined,
  );
  const actions = {
    apiMode,
    permissions: permissions.agents,
    onCreateAgent: async (values: Record<string, string>) => {
      await createAgent.mutateAsync(values);
    },
    onUpdateAgent: async (id: string, values: Record<string, string>) => {
      await updateAgent.mutateAsync({ id, values });
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={
          agentsResource.state.status === "success" ||
          agentsResource.state.status === "empty"
            ? agentsResource.state.source
            : undefined
        }
      />
      <AgentsManagementPage items={displayItems} actions={actions} />
      {total > limit ? (
        <PaginationControls
          page={page}
          pageCount={totalPages}
          total={total}
          onPrevious={page > 1 ? () => setPage(page - 1) : undefined}
          onNext={page < totalPages ? () => setPage(page + 1) : undefined}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

export function AgentDetailPage({ id }: { id: string }) {
  const agentResource = useAgent(id);
  const runsResource = useWorkflowRuns();
  const policiesResource = usePolicies();
  const credentialsResource = useCredentials();
  const permissions = useManagementPermissions();
  const updateAgent = useUpdateAgent({
    messages: { success: "Agent updated." },
  });
  const pauseAgent = usePauseAgent({ messages: { success: "Agent paused." } });
  const resumeAgent = useResumeAgent({
    messages: { success: "Agent resumed." },
  });
  const revokeAgent = useRevokeAgent({
    messages: { success: "Agent revoked." },
  });
  const runItems = pickItems(runsResource, workflowRuns);
  const agentBase = resolveDetailRecord(agentResource, id);

  if (agentResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading agent"
        description="AegisWeb is loading the latest agent authority state."
      />
    );
  }

  if (agentResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load agent"
        description={errorMessage(agentResource.state.error)}
        action={{ label: "Retry", onClick: () => void agentResource.reload() }}
      />
    );
  }

  if (!agentBase) {
    return (
      <StatePanel
        state="empty"
        title="Agent not found"
        description="This agent record does not exist in the current workspace."
      />
    );
  }

  const agent = enhanceAgents(
    [agentBase],
    pickItems(policiesResource, policies),
    pickItems(credentialsResource, credentials),
    runItems,
  )[0];
  const agentItems = [agent];
  const apiMode = sourceIsApi(resourceSource(agentResource));
  const actions = {
    apiMode,
    permissions: permissions.agents,
    onUpdateAgent: async (agentId: string, values: Record<string, string>) => {
      await updateAgent.mutateAsync({ id: agentId, values });
    },
    onPauseAgent: async (agentId: string) => {
      await pauseAgent.mutateAsync(agentId);
    },
    onResumeAgent: async (agentId: string) => {
      await resumeAgent.mutateAsync(agentId);
    },
    onRevokeAgent: async (agentId: string) => {
      await revokeAgent.mutateAsync(agentId);
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(agentResource)}
      />
      <AgentManagementDetail
        id={id}
        items={agentItems}
        runs={runItems}
        actions={actions}
      />
    </div>
  );
}

export function VendorsPage() {
  const [page, setPage] = useSyncedPage();
  const limit = 20;
  const vendorsResource = useVendors();
  const permissions = useManagementPermissions();
  const createVendor = useCreateVendor({
    messages: { success: "Vendor created." },
  });
  const updateVendor = useUpdateVendor({
    messages: { success: "Vendor updated." },
  });
  const vendorItems = pickItems(vendorsResource, vendors);
  const total = vendorItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const displayItems = vendorItems.slice(start, start + limit);
  const actions = {
    apiMode: sourceIsApi(
      vendorsResource.state.status === "success" ||
        vendorsResource.state.status === "empty"
        ? vendorsResource.state.source
        : undefined,
    ),
    permissions: permissions.vendors,
    onCreateVendor: async (values: Record<string, string>) => {
      await createVendor.mutateAsync(values);
    },
    onUpdateVendor: async (id: string, values: Record<string, string>) => {
      await updateVendor.mutateAsync({ id, values });
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={
          vendorsResource.state.status === "success" ||
          vendorsResource.state.status === "empty"
            ? vendorsResource.state.source
            : undefined
        }
      />
      <VendorsManagementPage items={displayItems} actions={actions} />
      {total > limit ? (
        <PaginationControls
          page={page}
          pageCount={totalPages}
          total={total}
          onPrevious={page > 1 ? () => setPage(page - 1) : undefined}
          onNext={page < totalPages ? () => setPage(page + 1) : undefined}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

export function VendorDetailPage({ id }: { id: string }) {
  const vendorResource = useVendor(id);
  const permissions = useManagementPermissions();
  const updateVendor = useUpdateVendor({
    messages: { success: "Vendor updated." },
  });
  const deleteVendor = useDeleteVendor({
    messages: { success: "Vendor deleted." },
  });
  const vendor = resolveDetailRecord(vendorResource, id);
  if (vendorResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading vendor"
        description="AegisWeb is loading vendor context and ownership details."
      />
    );
  }

  if (vendorResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load vendor"
        description={errorMessage(vendorResource.state.error)}
        action={{ label: "Retry", onClick: () => void vendorResource.reload() }}
      />
    );
  }

  if (!vendor) {
    return (
      <StatePanel
        state="empty"
        title="Vendor not found"
        description="This vendor record does not exist in the current workspace."
      />
    );
  }

  const vendorItems = [vendor];
  const workflowsResource = useWorkflows();
  const credentialsResource = useCredentials();
  const workflowItems = pickItems(workflowsResource, workflows);
  const credentialItems = pickItems(credentialsResource, credentials);
  const actions = {
    apiMode: sourceIsApi(resourceSource(vendorResource)),
    permissions: permissions.vendors,
    onUpdateVendor: async (
      vendorId: string,
      values: Record<string, string>,
    ) => {
      await updateVendor.mutateAsync({ id: vendorId, values });
    },
    onDeleteVendor: async (vendorId: string) => {
      await deleteVendor.mutateAsync(vendorId);
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(vendorResource)}
      />
      <VendorManagementDetail
        id={id}
        items={vendorItems}
        workflowItems={workflowItems}
        credentialItems={credentialItems}
        actions={actions}
      />
    </div>
  );
}

export function CredentialsPage() {
  const [page, setPage] = useSyncedPage();
  const limit = 20;
  const agentsResource = useAgents();
  const vendorsResource = useVendors();
  const permissions = useManagementPermissions();
  const createCredential = useCreateCredential({
    messages: { success: "Credential created." },
  });
  const grantCredential = useGrantCredential({
    messages: { success: "Credential grant created." },
  });
  const revokeCredential = useRevokeCredential({
    messages: { success: "Credential revoked." },
  });
  const agentItems = pickItems(agentsResource, agents);
  const vendorItems = pickItems(vendorsResource, vendors);
  const credentialsResource = useCredentials();
  const credentialItems = pickItems(credentialsResource, credentials);
  const total = credentialItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const displayItems = credentialItems.slice(start, start + limit);
  const actions = {
    apiMode: sourceIsApi(
      credentialsResource.state.status === "success" ||
        credentialsResource.state.status === "empty"
        ? credentialsResource.state.source
        : undefined,
    ),
    permissions: permissions.credentials,
    onCreateCredential: async (values: Record<string, string>) => {
      await createCredential.mutateAsync(values);
    },
    onGrantCredential: async (
      credentialId: string,
      values: Record<string, string>,
    ) => {
      await grantCredential.mutateAsync({ id: credentialId, values });
    },
    onRevokeCredential: async (credentialId: string) => {
      await revokeCredential.mutateAsync(credentialId);
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={
          credentialsResource.state.status === "success" ||
          credentialsResource.state.status === "empty"
            ? credentialsResource.state.source
            : undefined
        }
      />
      <CredentialsManagementPage
        items={displayItems}
        lookupItems={{
          agents: agentItems,
          vendors: vendorItems,
          credentials: credentialItems,
        }}
        actions={actions}
      />
      {total > limit ? (
        <PaginationControls
          page={page}
          pageCount={totalPages}
          total={total}
          onPrevious={page > 1 ? () => setPage(page - 1) : undefined}
          onNext={page < totalPages ? () => setPage(page + 1) : undefined}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

export function CredentialDetailPage({ id }: { id: string }) {
  const agentsResource = useAgents();
  const vendorsResource = useVendors();
  const permissions = useManagementPermissions();
  const grantCredential = useGrantCredential({
    messages: { success: "Credential grant created." },
  });
  const revokeCredential = useRevokeCredential({
    messages: { success: "Credential revoked." },
  });
  const revokeGrant = useRevokeGrant({
    messages: { success: "Credential grant revoked." },
  });
  const agentItems = pickItems(agentsResource, agents);
  const vendorItems = pickItems(vendorsResource, vendors);
  const credentialResource = useCredential(id);
  const credential = resolveDetailRecord(credentialResource, id);
  if (credentialResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading credential"
        description="AegisWeb is loading vault metadata and grant scopes."
      />
    );
  }

  if (credentialResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load credential"
        description={errorMessage(credentialResource.state.error)}
        action={{ label: "Retry", onClick: () => void credentialResource.reload() }}
      />
    );
  }

  if (!credential) {
    return (
      <StatePanel
        state="empty"
        title="Credential not found"
        description="This credential record does not exist in the current workspace."
      />
    );
  }

  const credentialItems = [credential];
  const actions = {
    apiMode: sourceIsApi(resourceSource(credentialResource)),
    permissions: permissions.credentials,
    onGrantCredential: async (
      credentialId: string,
      values: Record<string, string>,
    ) => {
      await grantCredential.mutateAsync({ id: credentialId, values });
    },
    onRevokeCredential: async (credentialId: string) => {
      await revokeCredential.mutateAsync(credentialId);
    },
    onRevokeGrant: async (credentialId: string, grantId: string) => {
      await revokeGrant.mutateAsync({ id: credentialId, grantId });
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(credentialResource)}
      />
      <CredentialManagementDetail
        id={id}
        items={credentialItems}
        lookupItems={{
          agents: agentItems,
          vendors: vendorItems,
          credentials: credentialItems,
        }}
        actions={actions}
      />
    </div>
  );
}

export function PoliciesPage() {
  const [page, setPage] = useSyncedPage();
  const [query, setQuery] = useState("");
  const limit = 20;
  const agentsResource = useAgents();
  const permissions = useManagementPermissions();
  const createPolicy = useCreatePolicy({
    messages: { success: "Policy created." },
  });
  const agentItems = pickItems(agentsResource, agents);
  const paginated = usePaginatedPolicies(page, limit);
  const filteredPolicies = filterRows(paginated.items, query, (policy) =>
    [
      policy.name,
      policy.agent,
      policy.version,
      policy.status,
      policy.decision,
      policy.updatedAt,
      ...policy.allowedDomains,
      ...policy.approvalActions,
    ].join(" "),
  );
  const actions = {
    apiMode: false,
    permissions: permissions.policies,
    onCreatePolicy: async (values: Record<string, string>) => {
      await createPolicy.mutateAsync(values);
    },
  };
  const columns: DataTableColumn<PolicyFixture>[] = [
    {
      key: "name",
      header: "Policy",
      cell: (policy) => (
        <TextLink href={`/app/policies/${policy.id}`}>{policy.name}</TextLink>
      ),
    },
    { key: "agent", header: "Agent", cell: (policy) => policy.agent },
    {
      key: "version",
      header: "Version",
      cell: (policy) => <span className="font-mono">{policy.version}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (policy) => <StatusBadge status={policy.status} />,
    },
    {
      key: "decision",
      header: "Decision",
      cell: (policy) => <PolicyDecisionBadge decision={policy.decision} />,
    },
    {
      key: "updated",
      header: "Updated",
      cell: (policy) => (
        <span className="text-muted-foreground">{policy.updatedAt}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Policy authority"
        title="Policies"
        description="Make agent authority visible, editable, and testable before web actions run."
        actions={
          <PolicyCreateDialog agentItems={agentItems} actions={actions} />
        }
      />
      <Toolbar
        placeholder="Search policies"
        query={query}
        onQueryChange={setQuery}
        resultCount={filteredPolicies.length}
      />
      <DataTable
        rows={filteredPolicies}
        columns={columns}
        loading={paginated.isLoading}
        error={paginated.error}
        onRetry={() => void paginated.reload()}
        pagination={paginated.meta}
        updatedAt={paginated.updatedAt}
        onPageChange={(p) => { setPage(p); setQuery(""); }}
      />
    </div>
  );
}

export function PolicyDetailPage({ id }: { id: string }) {
  const permissions = useManagementPermissions();
  const updatePolicy = useUpdatePolicy({
    messages: { success: "Policy updated." },
  });
  const evaluatePolicy = useEvaluatePolicy({
    messages: { success: "Policy test completed." },
  });
  const policyResource = usePolicy(id);
  const policy = resolveDetailRecord(policyResource, id);
  if (policyResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading policy"
        description="AegisWeb is loading policy rules and evaluation context."
      />
    );
  }

  if (policyResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load policy"
        description={errorMessage(policyResource.state.error)}
        action={{ label: "Retry", onClick: () => void policyResource.reload() }}
      />
    );
  }

  if (!policy) {
    return (
      <StatePanel
        state="empty"
        title="Policy not found"
        description="This policy record does not exist in the current workspace."
      />
    );
  }

  const policyItems = [policy];
  const actions = {
    apiMode: sourceIsApi(resourceSource(policyResource)),
    permissions: permissions.policies,
    onUpdatePolicy: async (
      policyId: string,
      values: Record<string, unknown>,
    ) => {
      await updatePolicy.mutateAsync({ id: policyId, values });
    },
    onEvaluatePolicy: async (
      policyId: string,
      values: Record<string, unknown>,
    ) => {
      await evaluatePolicy.mutateAsync({ id: policyId, values });
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(policyResource)}
      />
      <PolicyEditorScreen id={id} items={policyItems} actions={actions} />
    </div>
  );
}

export function WorkflowsPage() {
  const [page, setPage] = useSyncedPage();
  const limit = 20;
  const agentsResource = useAgents();
  const vendorsResource = useVendors();
  const permissions = useManagementPermissions();
  const createWorkflow = useCreateWorkflow({
    messages: { success: "Workflow created." },
  });
  const updateWorkflow = useUpdateWorkflow({
    messages: { success: "Workflow updated." },
  });
  const agentItems = pickItems(agentsResource, agents);
  const vendorItems = pickItems(vendorsResource, vendors);
  const credentialsResource = useCredentials();
  const credentialItems = pickItems(credentialsResource, credentials);
  const workflowsResource = useWorkflows();
  const workflowItems = pickItems(workflowsResource, workflows);
  const total = workflowItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const displayItems = workflowItems.slice(start, start + limit);
  const actions = {
    apiMode: sourceIsApi(
      workflowsResource.state.status === "success" ||
        workflowsResource.state.status === "empty"
        ? workflowsResource.state.source
        : undefined,
    ),
    permissions: permissions.workflows,
    onCreateWorkflow: async (values: Record<string, string>) => {
      await createWorkflow.mutateAsync(values);
    },
    onUpdateWorkflow: async (
      workflowId: string,
      values: Record<string, string>,
    ) => {
      await updateWorkflow.mutateAsync({ id: workflowId, values });
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={
          workflowsResource.state.status === "success" ||
          workflowsResource.state.status === "empty"
            ? workflowsResource.state.source
            : undefined
        }
      />
      <WorkflowsManagementPage
        items={displayItems}
        lookupItems={{
          agents: agentItems,
          vendors: vendorItems,
          credentials: credentialItems,
        }}
        actions={actions}
      />
      {total > limit ? (
        <PaginationControls
          page={page}
          pageCount={totalPages}
          total={total}
          onPrevious={page > 1 ? () => setPage(page - 1) : undefined}
          onNext={page < totalPages ? () => setPage(page + 1) : undefined}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

export function WorkflowDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const agentsResource = useAgents();
  const vendorsResource = useVendors();
  const permissions = useManagementPermissions();
  const updateWorkflow = useUpdateWorkflow({
    messages: { success: "Workflow updated." },
  });
  const startWorkflow = useStartWorkflow({
    messages: { success: "Workflow run started." },
  });
  const agentItems = pickItems(agentsResource, agents);
  const vendorItems = pickItems(vendorsResource, vendors);
  const credentialsResource = useCredentials();
  const credentialItems = pickItems(credentialsResource, credentials);
  const workflowResource = useWorkflow(id);
  const workflow = resolveDetailRecord(workflowResource, id);
  if (workflowResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading workflow"
        description="AegisWeb is loading workflow template and readiness state."
      />
    );
  }

  if (workflowResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load workflow"
        description={errorMessage(workflowResource.state.error)}
        action={{ label: "Retry", onClick: () => void workflowResource.reload() }}
      />
    );
  }

  if (!workflow) {
    return (
      <StatePanel
        state="empty"
        title="Workflow not found"
        description="This workflow record does not exist in the current workspace."
      />
    );
  }

  const workflowItems = [workflow];
  const actions = {
    apiMode: sourceIsApi(resourceSource(workflowResource)),
    permissions: permissions.workflows,
    onUpdateWorkflow: async (
      workflowId: string,
      values: Record<string, string>,
    ) => {
      await updateWorkflow.mutateAsync({ id: workflowId, values });
    },
    onStartWorkflow: async (workflowId: string) => {
      const result = await startWorkflow.mutateAsync({ id: workflowId });
      if (result?.run?.id) router.push(`/app/runs/${result.run.id}`);
    },
  };
  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(workflowResource)}
      />
      <WorkflowManagementDetail
        id={id}
        items={workflowItems}
        lookupItems={{
          agents: agentItems,
          vendors: vendorItems,
          credentials: credentialItems,
        }}
        actions={actions}
      />
    </div>
  );
}

export function RunsPage() {
  const [page, setPage] = useSyncedPage();
  const [query, setQuery] = useState("");
  const limit = 20;
  const paginated = usePaginatedWorkflowRuns(page, limit);
  const filteredRuns = filterRows(paginated.items, query, (run) =>
    [
      run.workflow,
      run.status,
      run.risk,
      run.agent,
      run.vendor,
      run.duration,
      run.currentStep,
      run.policyDecision,
    ].join(" "),
  );
  const columns: DataTableColumn<WorkflowRunFixture>[] = [
    {
      key: "run",
      header: "Run",
      cell: (run) => (
        <TextLink href={`/app/runs/${run.id}`}>{run.workflow}</TextLink>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (run) => (
        <WorkflowRunStatusBadge status={run.status} size="compact" />
      ),
    },
    {
      key: "risk",
      header: "Risk",
      cell: (run) => <RiskLevelBadge risk={run.risk} />,
    },
    { key: "agent", header: "Agent", cell: (run) => run.agent },
    { key: "vendor", header: "Vendor", cell: (run) => run.vendor },
    {
      key: "duration",
      header: "Duration",
      cell: (run) => <span className="tabular-nums">{run.duration}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Execution trail"
        title="Runs"
        description="Observe live and historical workflow execution with policy and evidence context."
        actions={<StartWorkflowFlow />}
      />
      <Toolbar
        placeholder="Search runs"
        query={query}
        onQueryChange={setQuery}
        resultCount={filteredRuns.length}
      />
      <DataTable
        rows={filteredRuns}
        columns={columns}
        loading={paginated.isLoading}
        error={paginated.error}
        onRetry={() => void paginated.reload()}
        pagination={paginated.meta}
        updatedAt={paginated.updatedAt}
        onPageChange={(p) => { setPage(p); setQuery(""); }}
      />
    </div>
  );
}

export function RunDetailPage({ id }: { id: string }) {
  const cancelRun = useCancelWorkflowRun({
    messages: { success: "Workflow run canceled." },
  });
  const auditResource = useWorkflowRunAudit(id);
  const runResource = useWorkflowRun(id);
  const runBase = resolveDetailRecord(runResource, id);

  if (runResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading run"
        description="AegisWeb is loading workflow execution evidence."
      />
    );
  }

  if (runResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load run"
        description={errorMessage(runResource.state.error)}
        action={{ label: "Retry", onClick: () => void runResource.reload() }}
      />
    );
  }

  if (!runBase) {
    return (
      <StatePanel
        state="empty"
        title="Run not found"
        description="This workflow run record does not exist in the current workspace."
      />
    );
  }

  const runAudit =
    (auditResource.state.status === "success" ||
      auditResource.state.status === "empty") &&
    auditResource.state.source === "api"
      ? auditResource.state.data
      : runBase.evidence?.auditEvents ?? [];
  const run = {
    ...runBase,
    evidence: { ...runBase.evidence, auditEvents: runAudit },
  };

  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(runResource)}
      />
      <WorkflowRunDetailScreen
        run={run}
        onDownloadFile={async (file) => {
          await downloadEndpoint(`/files/${file.id}/download`, file.label);
        }}
        onCancel={
          (runResource.state.status === "success" ||
            runResource.state.status === "empty") &&
          runResource.state.source === "api"
            ? async () => {
                await cancelRun.mutateAsync(id);
              }
            : undefined
        }
      />
    </div>
  );
}

export function ApprovalsPage() {
  const [page, setPage] = useSyncedPage();
  const [query, setQuery] = useState("");
  const limit = 20;
  const paginated = usePaginatedApprovals(page, limit);
  const filteredApprovals = filterRows(paginated.items, query, (approval) =>
    [
      approval.action,
      approval.status,
      approval.risk,
      approval.agent,
      approval.vendor,
      approval.policyTrigger,
      approval.requestedAt,
      approval.expiresAt,
    ].join(" "),
  );
  const columns: DataTableColumn<ApprovalFixture>[] = [
    {
      key: "action",
      header: "Action",
      cell: (approval) => (
        <TextLink href={`/app/approvals/${approval.id}`}>
          {approval.action}
        </TextLink>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (approval) => <StatusBadge status={approval.status} />,
    },
    {
      key: "risk",
      header: "Risk",
      cell: (approval) => <RiskLevelBadge risk={approval.risk} />,
    },
    { key: "agent", header: "Agent", cell: (approval) => approval.agent },
    {
      key: "amount",
      header: "Amount",
      cell: (approval) => (
        <span className="tabular-nums">{formatCurrency(approval.amount)}</span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      cell: (approval) => (
        <span className="tabular-nums">{approval.expiresAt}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human gates"
        title="Approvals"
        description="Decide risky agent actions with policy context and browser evidence."
      />
      <Toolbar
        placeholder="Search approvals"
        query={query}
        onQueryChange={setQuery}
        resultCount={filteredApprovals.length}
      />
      <DataTable
        rows={filteredApprovals}
        columns={columns}
        loading={paginated.isLoading}
        error={paginated.error}
        onRetry={() => void paginated.reload()}
        pagination={paginated.meta}
        updatedAt={paginated.updatedAt}
        onPageChange={(p) => { setPage(p); setQuery(""); }}
      />
    </div>
  );
}

export function ApprovalDetailPage({ id }: { id: string }) {
  const role = useRole();
  const approve = useApproveRequest({
    messages: { success: "Approval accepted." },
  });
  const reject = useRejectRequest({
    messages: { success: "Approval rejected." },
  });
  const approvalResource = useApproval(id);
  const approval = resolveDetailRecord(approvalResource, id);

  if (approvalResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading approval request"
        description="AegisWeb is loading policy and decision context."
      />
    );
  }

  if (approvalResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load approval request"
        description={errorMessage(approvalResource.state.error)}
        action={{ label: "Retry", onClick: () => void approvalResource.reload() }}
      />
    );
  }

  if (!approval) {
    return (
      <StatePanel
        state="empty"
        title="Approval request not found"
        description="This approval request does not exist in the current workspace."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(approvalResource)}
      />
      <ApprovalDetailScreen
        approval={approval}
        onApprove={async (comment) => {
          await approve.mutateAsync({ id, comment });
        }}
        onReject={async (comment) => {
          await reject.mutateAsync({ id, comment });
        }}
        apiEnabled={
          (approvalResource.state.status === "success" ||
            approvalResource.state.status === "empty") &&
          approvalResource.state.source === "api" &&
          can(role, "approval:approve")
        }
      />
    </div>
  );
}

export function ReceiptsPage() {
  const [page, setPage] = useSyncedPage();
  const [query, setQuery] = useState("");
  const limit = 20;
  const paginated = usePaginatedReceipts(page, limit);
  const filteredReceipts = filterRows(paginated.items, query, (receipt) =>
    [
      receipt.summary,
      receipt.status,
      receipt.vendor,
      receipt.agent,
      receipt.workflowRun,
      receipt.createdAt,
      receipt.hash,
      ...receipt.files.map((file) =>
        typeof file === "string" ? file : file.label,
      ),
    ].join(" "),
  );
  const columns: DataTableColumn<ReceiptFixture>[] = [
    {
      key: "summary",
      header: "Receipt",
      cell: (receipt) => (
        <TextLink href={`/app/receipts/${receipt.id}`}>
          {receipt.summary}
        </TextLink>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (receipt) => <StatusBadge status={receipt.status} />,
    },
    { key: "vendor", header: "Vendor", cell: (receipt) => receipt.vendor },
    { key: "agent", header: "Agent", cell: (receipt) => receipt.agent },
    {
      key: "created",
      header: "Created",
      cell: (receipt) => (
        <span className="tabular-nums">{receipt.createdAt}</span>
      ),
    },
    {
      key: "hash",
      header: "Hash",
      cell: (receipt) => (
        <span className="font-mono text-xs">{receipt.hash}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust artifacts"
        title="Receipts"
        description="Proof of what happened, who approved it, which policy matched, and what evidence was preserved."
      />
      <Toolbar
        placeholder="Search receipts"
        query={query}
        onQueryChange={setQuery}
        resultCount={filteredReceipts.length}
      />
      <DataTable
        rows={filteredReceipts}
        columns={columns}
        loading={paginated.isLoading}
        error={paginated.error}
        onRetry={() => void paginated.reload()}
        pagination={paginated.meta}
        updatedAt={paginated.updatedAt}
        onPageChange={(p) => { setPage(p); setQuery(""); }}
      />
    </div>
  );
}

export function ReceiptDetailPage({ id }: { id: string }) {
  const receiptResource = useReceipt(id);
  const receiptBase = resolveDetailRecord(receiptResource, id);
  const auditResource = useAuditEvents(
    receiptBase
      ? `/audit-events?workflowRunId=${encodeURIComponent(receiptBase.workflowRun)}`
      : "/audit-events",
  );

  if (receiptResource.state.status === "loading") {
    return (
      <StatePanel
        state="loading"
        title="Loading receipt"
        description="AegisWeb is loading the receipt artifact and evidence chain."
      />
    );
  }

  if (receiptResource.state.status === "error") {
    return (
      <StatePanel
        state="error"
        title="Could not load receipt"
        description={errorMessage(receiptResource.state.error)}
        action={{ label: "Retry", onClick: () => void receiptResource.reload() }}
      />
    );
  }

  if (!receiptBase) {
    return (
      <StatePanel
        state="empty"
        title="Receipt not found"
        description="This receipt record does not exist in the current workspace."
      />
    );
  }

  const receiptAudit =
    (auditResource.state.status === "success" ||
      auditResource.state.status === "empty") &&
    auditResource.state.source === "api"
      ? auditResource.state.data
      : receiptBase.evidence?.auditEvents ?? [];
  const receipt = {
    ...receiptBase,
    evidence: { ...receiptBase.evidence, auditEvents: receiptAudit },
  };

  return (
    <div className="space-y-4">
      <ResourceNotice
        source={resourceSource(receiptResource)}
      />
      <ReceiptDetailScreen
        receipt={receipt}
        onExport={
          (receiptResource.state.status === "success" ||
            receiptResource.state.status === "empty") &&
          receiptResource.state.source === "api"
            ? async () => {
                const exported = await downloadEndpoint(
                  `/receipts/${id}/export`,
                );
                triggerDownload(
                  exported.blob,
                  exported.filename || `${id}.json`,
                );
              }
            : undefined
        }
        onDownloadFile={(file) =>
          downloadEndpoint(`/files/${file.id}/download`, file.label).then(
            ({ blob, filename }) =>
              triggerDownload(blob, filename || file.label),
          )
        }
      />
    </div>
  );
}

export function AuditPage() {
  const [page, setPage] = useSyncedPage();
  const limit = 50;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const paginated = usePaginatedAuditEvents(page, limit);
  const filteredAudit = filterRows(paginated.items, debouncedQuery, (event) =>
    [
      event.timestamp,
      event.eventType,
      event.actor,
      event.description,
      event.workflowRun,
      event.hash,
      JSON.stringify(event.payload),
    ].join(" "),
  );
  const columns: DataTableColumn<AuditEventFixture>[] = [
    {
      key: "time",
      header: "Time",
      cell: (event) => <span className="tabular-nums">{event.timestamp}</span>,
    },
    {
      key: "type",
      header: "Event",
      cell: (event) => (
        <span className="font-mono text-xs">{event.eventType}</span>
      ),
    },
    { key: "actor", header: "Actor", cell: (event) => event.actor },
    {
      key: "description",
      header: "Description",
      cell: (event) => (
        <span className="text-muted-foreground">{event.description}</span>
      ),
    },
    {
      key: "hash",
      header: "Hash",
      cell: (event) => <span className="font-mono text-xs">{event.hash}</span>,
    },
    {
      key: "inspect",
      header: "",
      cell: (event) => (
        <AuditEventDrawer
          event={event}
          trigger={
            <Button variant="outline" size="sm" className="h-9">
              <Eye className="size-4" strokeWidth={1.8} />
              Inspect
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit trail"
        title="Audit"
        description="Searchable technical event history with secret-safe payload inspection."
      />
      <Toolbar
        placeholder="Search audit events"
        query={query}
        onQueryChange={setQuery}
        resultCount={filteredAudit.length}
      />
      <DataTable
        rows={filteredAudit}
        columns={columns}
        loading={paginated.isLoading}
        error={paginated.error}
        onRetry={() => void paginated.reload()}
        pagination={paginated.meta}
        updatedAt={paginated.updatedAt}
        onPageChange={(p) => { setPage(p); setQuery(""); setDebouncedQuery(""); }}
      />
    </div>
  );
}

function SettingsPanel({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-5 shadow-xs">
      <h3 className="text-sm font-medium">{title}</h3>
      <dl className="mt-4 space-y-3">
        {items.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SettingsPage() {
  const orgResource = useOrganization();
  const usersResource = useUsers();
  const permissions = useSettingsPermissions();
  const organization =
    orgResource.state.status === "success" ||
    orgResource.state.status === "empty"
      ? orgResource.state.data
      : null;
  const userItems =
    usersResource.state.status === "success" ||
    usersResource.state.status === "empty"
      ? usersResource.state.data
      : [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Inspect organization, billing, and user roster."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel
          title="Organization"
          items={
            (organization
              ? [
                  ["Name", organization.name],
                  ["Domain", organization.domain],
                  ["Plan", organization.plan],
                ]
              : [["Status", "Demo workspace"]]) as [string, string][]
          }
        />
        <SettingsPanel
          title="Members"
          items={userItems.map(
            (user) =>
              [user.name, `${user.email} / ${user.role}`] as [string, string],
          )}
        />
      </div>
      <SettingsPanel
        title="Permissions"
        items={[
          [
            "Manage members",
            permissions.manage ? "Enabled" : "Owner / Admin only",
          ],
        ]}
      />
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
