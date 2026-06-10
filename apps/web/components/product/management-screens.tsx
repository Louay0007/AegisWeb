"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type SVGProps,
} from "react";

type DashboardIcon = ComponentType<SVGProps<SVGSVGElement>>;
import {
  ArrowRight,
  Building,
  CheckCircle,
  Clock,
  DollarCircle,
  EditPencil,
  EyeClosed,
  GitBranch,
  Key,
  Lock,
  Page,
  Play,
  Plus,
  Refresh,
  Search,
  SettingsProfiles,
  ShieldCheck,
  Trash,
  UserBadgeCheck,
  WarningTriangle,
  XmarkCircle,
} from "iconoir-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EntityList } from "@/components/data/entity-list";
import { Timeline } from "@/components/data/timeline";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { StatusBadge } from "@/components/display/status-badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  agents,
  credentials,
  findById,
  policies,
  timeline,
  vendors,
  workflows,
  workflowRuns,
  type AgentFixture,
  type CredentialFixture,
  type PolicyFixture,
  type VendorFixture,
  type WorkflowFixture,
} from "@/lib/fixtures/dashboard";
import { errorMessage } from "@/lib/api/api-errors";
import { actionDisabledReason as disabledReasonForAction } from "@/lib/permissions/action-disabled-reason";
import { formatCurrency } from "@/lib/format/formatters";

type DialogMode = "create" | "edit";
type SubmitValues = Record<string, string>;
type SubmitHandler = (values: SubmitValues) => Promise<void> | void;
type FieldErrors = Record<string, string>;
type ActionDecision = "Allow" | "Approval" | "Deny";

const FieldErrorContext = createContext<FieldErrors>({});

type ManagementPermissions = {
  create?: boolean;
  update?: boolean;
  pause?: boolean;
  revoke?: boolean;
  delete?: boolean;
  grant?: boolean;
  evaluate?: boolean;
  run?: boolean;
};

type ManagementActionState = {
  apiMode?: boolean;
  permissions?: ManagementPermissions;
  onRefresh?: () => Promise<void> | void;
  onCreateAgent?: SubmitHandler;
  onUpdateAgent?: (id: string, values: SubmitValues) => Promise<void> | void;
  onPauseAgent?: (id: string) => Promise<void> | void;
  onResumeAgent?: (id: string) => Promise<void> | void;
  onRevokeAgent?: (id: string) => Promise<void> | void;
  onCreateVendor?: SubmitHandler;
  onUpdateVendor?: (id: string, values: SubmitValues) => Promise<void> | void;
  onDeleteVendor?: (id: string) => Promise<void> | void;
  onCreateCredential?: SubmitHandler;
  onGrantCredential?: (
    credentialId: string,
    values: SubmitValues,
  ) => Promise<void> | void;
  onRevokeCredential?: (id: string) => Promise<void> | void;
  onRevokeGrant?: (
    credentialId: string,
    grantId: string,
  ) => Promise<void> | void;
  onCreatePolicy?: SubmitHandler;
  onCreateWorkflow?: SubmitHandler;
  onUpdateWorkflow?: (id: string, values: SubmitValues) => Promise<void> | void;
  onStartWorkflow?: (id: string) => Promise<void> | void;
  onEvaluatePolicy?: (
    id: string,
    values: Record<string, unknown>,
  ) => Promise<void> | void;
  onUpdatePolicy?: (
    id: string,
    values: Record<string, unknown>,
  ) => Promise<void> | void;
};

type LookupItems = {
  agents?: AgentFixture[];
  vendors?: VendorFixture[];
  credentials?: CredentialFixture[];
};

export function AgentsManagementPage({
  items = agents,
  actions,
}: {
  items?: AgentFixture[];
  actions?: ManagementActionState;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(
    () =>
      items.filter(
        (agent) =>
          matches(agent.name, query) &&
          (status === "all" || agent.status === status),
      ),
    [items, query, status],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Non-human identity"
        title="Agents"
        description="Manage browser agents, their policy boundaries, credential grants, and recent activity."
        actions={<AgentDialog mode="create" actions={actions} />}
      />
      <FilterRow query={query} setQuery={setQuery} placeholder="Search agents">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-40"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="revoked">Revoked</option>
        </select>
      </FilterRow>
      <SurfaceList
        items={filtered.map((agent) => ({
          id: agent.id,
          href: `/app/agents/${agent.id}`,
          icon: UserBadgeCheck,
          title: agent.name,
          subtitle: agent.purpose,
          meta: [
            agent.identifier,
            agent.policy,
            `${agent.recentRuns} recent runs`,
          ],
          badge: <StatusBadge status={agent.status} />,
          action: <AgentDialog mode="edit" agent={agent} actions={actions} />,
        }))}
      />
    </div>
  );
}

export function AgentManagementDetail({
  id,
  items = agents,
  runs = workflowRuns,
  actions,
}: {
  id: string;
  items?: AgentFixture[];
  runs?: typeof workflowRuns;
  actions?: ManagementActionState;
}) {
  const agent = findById(items, id);
  const relatedRuns = runs.filter((run) => run.agent === agent.name);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent identity"
        title={agent.name}
        description={agent.purpose}
        actions={
          <>
            <AgentDialog mode="edit" agent={agent} actions={actions} />
            {agent.status === "paused" ? (
              <AsyncActionButton
                label="Resume"
                icon={Refresh}
                enabled={actions?.apiMode && actions?.permissions?.pause}
                onAction={() => actions?.onResumeAgent?.(agent.id)}
              />
            ) : (
              <AsyncActionButton
                label="Pause"
                icon={Refresh}
                enabled={
                  actions?.apiMode &&
                  actions?.permissions?.pause &&
                  agent.status === "active"
                }
                onAction={() => actions?.onPauseAgent?.(agent.id)}
              />
            )}
            <ConfirmDialog
              trigger="Revoke"
              title={`Revoke ${agent.name}?`}
              description="Future workflow runs will not be able to use this agent identity."
              actionLabel="Revoke"
              enabled={
                actions?.apiMode &&
                actions?.permissions?.revoke &&
                agent.status !== "revoked"
              }
              disabledReason={actionDisabledReason(
                actions,
                "revoke agents",
                actions?.permissions?.revoke,
              )}
              onConfirm={() => actions?.onRevokeAgent?.(agent.id)}
            />
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Authority profile" icon={ShieldCheck}>
            <InfoGrid
              items={[
                ["Identifier", agent.identifier],
                ["Policy", agent.policy],
                ["Status", agent.status],
                ["Last activity", agent.lastActivity],
              ]}
            />
          </Panel>
          <Panel title="Credential grants" icon={Key}>
            <EntityList
              items={agent.credentialGrants.map((grant) => ({
                id: grant,
                title: grant,
                subtitle: "Scoped grant, secret never displayed",
                badge: (
                  <CheckCircle
                    className="size-4 text-emerald-600"
                    strokeWidth={1.8}
                  />
                ),
              }))}
            />
          </Panel>
          <Panel title="Recent activity" icon={Clock}>
            <Timeline items={timeline} />
          </Panel>
        </div>
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Runs using this agent" icon={GitBranch}>
            <EntityList
              items={relatedRuns.map((run) => ({
                id: run.id,
                title: run.workflow,
                subtitle: run.currentStep,
                href: `/app/runs/${run.id}`,
                badge: <StatusBadge status={run.status} />,
              }))}
            />
          </Panel>
          <Panel title="Control posture" icon={Lock}>
            <p className="text-pretty text-sm leading-6 text-muted-foreground">
              This agent can use approved credential capsules only inside
              allowed vendor domains and policy-scoped actions.
            </p>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

export function VendorsManagementPage({
  items = vendors,
  actions,
}: {
  items?: VendorFixture[];
  actions?: ManagementActionState;
}) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const filtered = useMemo(
    () =>
      items.filter(
        (vendor) =>
          matches(vendor.name, query) &&
          (risk === "all" || vendor.risk === risk),
      ),
    [items, query, risk],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SaaS surfaces"
        title="Vendors"
        description="Track vendor portals, renewal exposure, credential links, and workflow readiness."
        actions={<VendorDialog mode="create" actions={actions} />}
      />
      <FilterRow query={query} setQuery={setQuery} placeholder="Search vendors">
        <select
          value={risk}
          onChange={(event) => setRisk(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-40"
        >
          <option value="all">All risk</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </FilterRow>
      <SurfaceList
        items={filtered.map((vendor) => ({
          id: vendor.id,
          href: `/app/vendors/${vendor.id}`,
          icon: Building,
          title: vendor.name,
          subtitle: vendor.website,
          meta: [
            vendor.category,
            `Renewal ${vendor.renewalDate}`,
            `${vendor.unusedSeats} unused seats`,
            formatCurrency(vendor.monthlyCost),
          ],
          badge: <RiskLevelBadge risk={vendor.risk} />,
          action: (
            <VendorDialog mode="edit" vendor={vendor} actions={actions} />
          ),
        }))}
      />
    </div>
  );
}

export function VendorManagementDetail({
  id,
  items = vendors,
  workflowItems = workflows,
  credentialItems = credentials,
  actions,
}: {
  id: string;
  items?: VendorFixture[];
  workflowItems?: WorkflowFixture[];
  credentialItems?: CredentialFixture[];
  actions?: ManagementActionState;
}) {
  const vendor = findById(items, id);
  const relatedWorkflows = workflowItems.filter(
    (workflow) => workflow.vendor === vendor.name,
  );
  const relatedCredentials = credentialItems.filter(
    (credential) => credential.vendor === vendor.name,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendor portal"
        title={vendor.name}
        description={`${vendor.website} is owned by ${vendor.owner}.`}
        actions={
          <>
            <VendorDialog mode="edit" vendor={vendor} actions={actions} />
            <ConfirmDialog
              trigger="Delete"
              title={`Delete ${vendor.name}?`}
              description="Deleted vendors are removed from future workflow setup, but historical receipts and audit events stay intact."
              actionLabel="Delete"
              enabled={actions?.apiMode && actions?.permissions?.delete}
              disabledReason={actionDisabledReason(
                actions,
                "delete vendors",
                actions?.permissions?.delete,
              )}
              onConfirm={() => actions?.onDeleteVendor?.(vendor.id)}
            />
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Renewal exposure" icon={DollarCircle}>
            <InfoGrid
              items={[
                ["Monthly cost", formatCurrency(vendor.monthlyCost)],
                ["Renewal cost", formatCurrency(vendor.renewalCost)],
                ["Renewal date", vendor.renewalDate],
                ["Unused seats", `${vendor.unusedSeats}`],
              ]}
            />
          </Panel>
          <Panel title="Related workflows" icon={GitBranch}>
            <EntityList
              items={relatedWorkflows.map((workflow) => ({
                id: workflow.id,
                title: workflow.name,
                subtitle: workflow.template,
                href: `/app/workflows/${workflow.id}`,
                badge: <StatusBadge status={workflow.status} />,
              }))}
            />
          </Panel>
        </div>
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Risk profile" icon={WarningTriangle}>
            <RiskLevelBadge risk={vendor.risk} />
            <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
              Renewal size and unused seats make this vendor a strong candidate
              for approval-gated automation.
            </p>
          </Panel>
          <Panel title="Credentials" icon={Key}>
            <EntityList
              items={relatedCredentials.map((credential) => ({
                id: credential.id,
                title: credential.label,
                subtitle: credential.type,
                href: `/app/credentials/${credential.id}`,
                badge: <StatusBadge status={credential.status} />,
              }))}
            />
          </Panel>
        </aside>
      </section>
    </div>
  );
}

export function CredentialsManagementPage({
  items = credentials,
  lookupItems,
  actions,
}: {
  items?: CredentialFixture[];
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      items.filter(
        (credential) =>
          matches(credential.label, query) || matches(credential.vendor, query),
      ),
    [items, query],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vault authority"
        title="Credentials"
        description="Grant agents scoped access without exposing plaintext secrets."
        actions={
          <CredentialDialog actions={actions} lookupItems={lookupItems} />
        }
      />
      <FilterRow
        query={query}
        setQuery={setQuery}
        placeholder="Search credentials"
      >
        <GrantDialog
          actions={actions}
          credential={items[0]}
          lookupItems={lookupItems}
        />
      </FilterRow>
      <SurfaceList
        items={filtered.map((credential) => ({
          id: credential.id,
          href: `/app/credentials/${credential.id}`,
          icon: Key,
          title: credential.label,
          subtitle: `${credential.vendor} · ${credential.type}`,
          meta: [
            `${credential.grantedAgents.length} grants`,
            `Last used ${credential.lastUsed}`,
            `Created by ${credential.createdBy}`,
          ],
          badge: <StatusBadge status={credential.status} />,
          action: (
            <RevokeCredentialDialog credential={credential} actions={actions} />
          ),
        }))}
      />
    </div>
  );
}

export function CredentialManagementDetail({
  id,
  items = credentials,
  lookupItems,
  actions,
}: {
  id: string;
  items?: CredentialFixture[];
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const credential = findById(items, id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Credential capsule"
        title={credential.label}
        description="Secret material is write-only and never displayed after submission."
        actions={
          <>
            <GrantDialog
              credential={credential}
              actions={actions}
              lookupItems={lookupItems}
            />
            <RevokeCredentialDialog credential={credential} actions={actions} />
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Write-only secret posture" icon={EyeClosed}>
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock
                className="size-4 text-muted-foreground"
                strokeWidth={1.8}
              />
              Secret value unavailable after create
            </div>
            <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
              AegisWeb stores only a vault reference in the UI layer. Operators
              can rotate or revoke, never reveal.
            </p>
          </div>
        </Panel>
        <Panel title="Granted agents" icon={UserBadgeCheck}>
          <div className="divide-y divide-border rounded-lg border border-border">
            {(
              credential.grantedAgentDetails ??
              credential.grantedAgents.map((agent) => ({
                grantId: agent,
                agentId: agent,
                agentName: agent,
                scope: "login",
              }))
            ).map((grant) => (
              <div
                key={grant.grantId}
                className="flex min-h-14 flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <span className="text-sm font-medium">{grant.agentName}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scope: {grant.scope}
                  </p>
                </div>
                <RevokeGrantDialog
                  credential={credential}
                  grant={grant}
                  actions={actions}
                />
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

export function PolicyEditorScreen({
  id,
  items = policies,
  actions,
}: {
  id: string;
  items?: PolicyFixture[];
  actions?: ManagementActionState;
}) {
  const policy = findById(items, id);
  const initialActions = [
    "Read invoice",
    "Download file",
    "Change plan",
    "Remove seats",
    "Update payment method",
  ];
  const initialActionDecisions = initialActions.reduce<
    Record<string, ActionDecision>
  >((acc, action, index) => {
    acc[action] = index < 2 ? "Allow" : index === 4 ? "Deny" : "Approval";
    return acc;
  }, {});
  const [decision, setDecision] = useState(policy.decision);
  const [allowedDomains, setAllowedDomains] = useState(policy.allowedDomains);
  const [blockedDomains, setBlockedDomains] = useState(policy.blockedDomains);
  const [approvalActions, setApprovalActions] = useState(
    policy.approvalActions.length
      ? policy.approvalActions
      : ["Change plan", "Remove seats"],
  );
  const [dangerKeywords, setDangerKeywords] = useState([
    "delete account",
    "payment method",
    "cancel subscription",
    "annual renewal",
  ]);
  const [actionDecisions, setActionDecisions] = useState(
    initialActionDecisions,
  );
  const [thresholds, setThresholds] = useState({
    autoAllowBelow: "500",
    approvalAbove: "10000",
    hardDenyAbove: "50000",
  });
  const [hours, setHours] = useState({
    timezone: "Africa/Tunis",
    start: "09:00",
    end: "18:00",
  });
  const [testScenario, setTestScenario] = useState(
    "Agent requests Acme plan downgrade with annualized impact of $18,450.",
  );
  const [testSummary, setTestSummary] = useState(
    "Matched plan-change rule and annual threshold. Human approval required before continuing.",
  );

  function resetPolicyEditor() {
    setDecision(policy.decision);
    setAllowedDomains(policy.allowedDomains);
    setBlockedDomains(policy.blockedDomains);
    setApprovalActions(
      policy.approvalActions.length
        ? policy.approvalActions
        : ["Change plan", "Remove seats"],
    );
    setDangerKeywords([
      "delete account",
      "payment method",
      "cancel subscription",
      "annual renewal",
    ]);
    setActionDecisions(initialActionDecisions);
    setThresholds({
      autoAllowBelow: "500",
      approvalAbove: "10000",
      hardDenyAbove: "50000",
    });
    setHours({ timezone: "Africa/Tunis", start: "09:00", end: "18:00" });
    setTestScenario(
      "Agent requests Acme plan downgrade with annualized impact of $18,450.",
    );
    setTestSummary(
      "Matched plan-change rule and annual threshold. Human approval required before continuing.",
    );
  }

  function editedRules() {
    const allowedActions = Object.entries(actionDecisions)
      .filter(([, value]) => value === "Allow")
      .map(([action]) => actionTypeFromLabel(action));
    const deniedActions = Object.entries(actionDecisions)
      .filter(([, value]) => value === "Deny")
      .map(([action]) => actionTypeFromLabel(action));
    const approvalRequiredActions = Object.entries(actionDecisions)
      .filter(([, value]) => value === "Approval")
      .map(([action]) => actionTypeFromLabel(action));
    return {
      allowedDomains,
      blockedDomains,
      allowedActions,
      deniedActions,
      approvalRequiredActions: [
        ...new Set([
          ...approvalRequiredActions,
          ...approvalActions.map(actionTypeFromLabel),
        ]),
      ],
      autoApproveBelowCents: dollarsToCents(thresholds.autoAllowBelow),
      approvalRequiredAboveCents: dollarsToCents(thresholds.approvalAbove),
      denyAboveCents: dollarsToCents(thresholds.hardDenyAbove),
      dangerKeywords,
      businessHours: {
        enabled: true,
        timezone: hours.timezone,
        weekdays: [1, 2, 3, 4, 5],
        startHour: Number(hours.start.split(":")[0] ?? 9),
        endHour: Number(hours.end.split(":")[0] ?? 18),
      },
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Policy editor"
        title={policy.name}
        description={`${policy.agent} uses ${policy.version}. Changes here create a new policy version when connected to the API.`}
        actions={
          <>
            <Button
              variant="outline"
              className="h-10"
              onClick={resetPolicyEditor}
            >
              Discard
            </Button>
            <AsyncActionButton
              label="Save version"
              enabled={actions?.apiMode && actions?.permissions?.update}
              className="h-10"
              onAction={() =>
                actions?.onUpdatePolicy?.(policy.id, {
                  name: policy.name,
                  type: policy.type ?? "agent_policy_bundle",
                  status: policy.status,
                  rulesJson: JSON.stringify(editedRules()),
                })
              }
            />
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Allowed domains" icon={CheckCircle}>
            <TagEditor
              values={allowedDomains}
              onChange={setAllowedDomains}
              placeholder="billing.example.com"
            />
          </Panel>
          <Panel title="Blocked domains" icon={XmarkCircle}>
            <TagEditor
              values={blockedDomains}
              onChange={setBlockedDomains}
              placeholder="admin.payment-methods.test"
            />
          </Panel>
          <Panel title="Action permission matrix" icon={SettingsProfiles}>
            <ActionMatrix
              decisions={actionDecisions}
              onChange={setActionDecisions}
            />
          </Panel>
          <Panel title="Spending thresholds" icon={DollarCircle}>
            <div className="grid gap-3 sm:grid-cols-3">
              <PolicyNumberField
                label="Auto-allow below"
                value={thresholds.autoAllowBelow}
                onChange={(value) =>
                  setThresholds((current) => ({
                    ...current,
                    autoAllowBelow: value,
                  }))
                }
              />
              <PolicyNumberField
                label="Approval above"
                value={thresholds.approvalAbove}
                onChange={(value) =>
                  setThresholds((current) => ({
                    ...current,
                    approvalAbove: value,
                  }))
                }
              />
              <PolicyNumberField
                label="Hard deny above"
                value={thresholds.hardDenyAbove}
                onChange={(value) =>
                  setThresholds((current) => ({
                    ...current,
                    hardDenyAbove: value,
                  }))
                }
              />
            </div>
          </Panel>
          <Panel title="Danger keywords" icon={WarningTriangle}>
            <TagEditor
              values={dangerKeywords}
              onChange={setDangerKeywords}
              placeholder="danger keyword"
            />
          </Panel>
          <Panel title="Business hours" icon={Clock}>
            <div className="grid gap-3 sm:grid-cols-3">
              <PolicyTextField
                label="Timezone"
                value={hours.timezone}
                onChange={(value) =>
                  setHours((current) => ({ ...current, timezone: value }))
                }
              />
              <PolicyTextField
                label="Start"
                value={hours.start}
                onChange={(value) =>
                  setHours((current) => ({ ...current, start: value }))
                }
              />
              <PolicyTextField
                label="End"
                value={hours.end}
                onChange={(value) =>
                  setHours((current) => ({ ...current, end: value }))
                }
              />
            </div>
          </Panel>
        </div>
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Policy test panel" icon={ShieldCheck}>
            <div className="space-y-4">
              <Textarea
                value={testScenario}
                onChange={(event) => setTestScenario(event.target.value)}
                className="min-h-28"
                aria-label="Policy test scenario"
              />
              <AsyncActionButton
                label="Run policy test"
                className="h-10 w-full"
                enabled={
                  actions?.apiMode ? actions?.permissions?.evaluate : true
                }
                onAction={async () => {
                  if (actions?.apiMode) {
                    await actions?.onEvaluatePolicy?.(policy.id, {
                      agentId: policy.agentId ?? "",
                      website: allowedDomains[0] ?? "http://localhost:4202",
                      actionType: "change_plan",
                      amountCents: dollarsToCents(thresholds.approvalAbove),
                      riskSignals: [
                        "credential_used",
                        "financial_amount_present",
                        "plan_change_detected",
                      ],
                      policySnapshot: editedRules(),
                    });
                  }
                  const scenario = testScenario.toLowerCase();
                  const amountMatch = scenario.match(/\$?([0-9][0-9,]*)/);
                  const amount = amountMatch
                    ? Number(amountMatch[1].replace(/,/g, ""))
                    : 0;
                  const hasDanger = dangerKeywords.some((keyword) =>
                    scenario.includes(keyword.toLowerCase()),
                  );
                  if (
                    amount >= Number(thresholds.hardDenyAbove) ||
                    (hasDanger && scenario.includes("payment"))
                  ) {
                    setDecision("deny");
                    setTestSummary(
                      "Matched a hard-deny threshold or protected billing surface. The agent would be stopped before submission.",
                    );
                  } else if (
                    amount >= Number(thresholds.approvalAbove) ||
                    scenario.includes("downgrade") ||
                    scenario.includes("cancel")
                  ) {
                    setDecision("approval_required");
                    setTestSummary(
                      "Matched an approval action or spending threshold. Human approval is required before continuing.",
                    );
                  } else {
                    setDecision("allow");
                    setTestSummary(
                      "Matched low-risk read or download authority. The agent can continue and receipt evidence will be recorded.",
                    );
                  }
                }}
              />
              <div className="rounded-lg border border-border bg-muted/35 p-4">
                <PolicyDecisionBadge decision={decision} />
                <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
                  {testSummary}
                </p>
              </div>
            </div>
          </Panel>
          <Panel title="Current scope" icon={Page}>
            <InfoGrid
              items={[
                ["Agent", policy.agent],
                ["Version", policy.version],
                ["Risk", policy.risk],
                ["Updated", policy.updatedAt],
              ]}
            />
          </Panel>
        </aside>
      </section>
    </div>
  );
}

export function PolicyCreateDialog({
  agentItems = agents,
  actions,
}: {
  agentItems?: AgentFixture[];
  actions?: ManagementActionState;
}) {
  const enabled = Boolean(actions?.apiMode && actions.permissions?.create);
  return (
    <EntityDialog
      title="Create policy"
      description="Create an agent policy bundle with allowlists, blocked surfaces, and approval actions."
      enabled={enabled}
      disabledReason={actionDisabledReason(actions, "create policies")}
      onSubmit={(values) => actions?.onCreatePolicy?.(values)}
    >
      <Field
        name="name"
        label="Policy name"
        defaultValue="Finance SaaS Control"
      />
      <SelectField
        name="agentId"
        label="Agent"
        defaultValue={agentItems[0]?.id ?? ""}
        options={agentItems.map((agent) => [agent.id, agent.name])}
      />
      <SelectField
        name="type"
        label="Policy type"
        defaultValue="agent_policy_bundle"
        options={[
          ["agent_policy_bundle", "Agent policy bundle"],
          ["website_allowlist", "Website allowlist"],
          ["action_permissions", "Action permissions"],
          ["spending_limits", "Spending limits"],
          ["approval_rules", "Approval rules"],
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="allowedDomains"
          label="Allowed domains"
          defaultValue="localhost:4202"
        />
        <Field
          name="blockedDomains"
          label="Blocked domains"
          defaultValue="admin.payment-methods.test"
        />
      </div>
      <Field
        name="approvalActions"
        label="Approval actions"
        defaultValue="change_plan,cancel_subscription,change_billing_details"
      />
    </EntityDialog>
  );
}

export function WorkflowsManagementPage({
  items = workflows,
  lookupItems,
  actions,
}: {
  items?: WorkflowFixture[];
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      items.filter(
        (workflow) =>
          matches(workflow.name, query) || matches(workflow.vendor, query),
      ),
    [items, query],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Safe browser work"
        title="Workflows"
        description="Start predefined web-agent workflows only when policy and credential grants are ready."
        actions={
          <WorkflowDialog
            mode="create"
            actions={actions}
            lookupItems={lookupItems}
          />
        }
      />
      <FilterRow
        query={query}
        setQuery={setQuery}
        placeholder="Search workflows"
      >
        <span className="text-xs text-muted-foreground">
          Open a workflow to start a real run.
        </span>
      </FilterRow>
      <section className="grid gap-3 md:grid-cols-3">
        {[
          "Vendor invoice download",
          "SaaS renewal check",
          "Plan downgrade request",
        ].map((template) => (
          <div
            key={template}
            className="rounded-lg border border-border bg-background p-5 shadow-xs"
          >
            <ShieldCheck className="mb-5 size-5" />
            <h2 className="text-base font-semibold">{template}</h2>
            <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
              Policy and credential readiness are checked before execution.
            </p>
          </div>
        ))}
      </section>
      <SurfaceList
        items={filtered.map((workflow) => ({
          id: workflow.id,
          href: `/app/workflows/${workflow.id}`,
          icon: GitBranch,
          title: workflow.name,
          subtitle: `${workflow.template} for ${workflow.vendor}`,
          meta: [
            workflow.agent,
            `Readiness ${workflow.readiness.replace("_", " ")}`,
            `Last run ${workflow.lastRun}`,
          ],
          badge: <StatusBadge status={workflow.status} />,
          action: (
            <WorkflowDialog
              mode="edit"
              workflow={workflow}
              actions={actions}
              lookupItems={lookupItems}
            />
          ),
        }))}
      />
    </div>
  );
}

export function WorkflowManagementDetail({
  id,
  items = workflows,
  lookupItems,
  actions,
}: {
  id: string;
  items?: WorkflowFixture[];
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const workflow = findById(items, id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow template"
        title={workflow.name}
        description={`${workflow.template} for ${workflow.vendor}.`}
        actions={
          <>
            <WorkflowDialog
              mode="edit"
              workflow={workflow}
              actions={actions}
              lookupItems={lookupItems}
            />
            <AsyncActionButton
              label="Start workflow"
              icon={Play}
              enabled={
                actions?.apiMode &&
                actions?.permissions?.run &&
                workflow.status === "active"
              }
              onAction={() => actions?.onStartWorkflow?.(workflow.id)}
            />
          </>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Start readiness" icon={Play}>
          <EntityList
            items={[
              {
                id: "policy",
                title: "Policy ready",
                subtitle: "Action matrix includes approval threshold",
                badge: (
                  <CheckCircle
                    className="size-4 text-emerald-600"
                    strokeWidth={1.8}
                  />
                ),
              },
              {
                id: "grant",
                title: "Credential grant ready",
                subtitle: "Vault capsule can be used by worker",
                badge: (
                  <CheckCircle
                    className="size-4 text-emerald-600"
                    strokeWidth={1.8}
                  />
                ),
              },
              {
                id: "vendor",
                title: "Vendor domain allowed",
                subtitle: workflow.vendor,
                badge: (
                  <CheckCircle
                    className="size-4 text-emerald-600"
                    strokeWidth={1.8}
                  />
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Workflow configuration" icon={GitBranch}>
          <InfoGrid
            items={[
              ["Template", workflow.template],
              ["Agent", workflow.agent],
              ["Vendor", workflow.vendor],
              ["Readiness", workflow.readiness.replace("_", " ")],
            ]}
          />
        </Panel>
      </section>
    </div>
  );
}

function AgentDialog({
  mode,
  agent,
  actions,
}: {
  mode: DialogMode;
  agent?: AgentFixture;
  actions?: ManagementActionState;
}) {
  const isCreate = mode === "create";
  const enabled = Boolean(
    actions?.apiMode &&
    (isCreate ? actions.permissions?.create : actions.permissions?.update),
  );
  return (
    <EntityDialog
      title={isCreate ? "Create agent" : "Edit agent"}
      description="Define identity, purpose, and policy boundary."
      enabled={enabled}
      disabledReason={actionDisabledReason(
        actions,
        isCreate ? "create agents" : "update agents",
      )}
      onSubmit={(values) =>
        isCreate
          ? actions?.onCreateAgent?.(values)
          : agent
            ? actions?.onUpdateAgent?.(agent.id, values)
            : undefined
      }
    >
      <Field
        name="name"
        label="Agent name"
        defaultValue={agent?.name ?? "Finance Review Agent"}
      />
      {isCreate ? (
        <Field
          name="identifier"
          label="Identifier"
          defaultValue={agent?.identifier ?? ""}
          placeholder="Optional stable identifier"
          required={false}
        />
      ) : null}
      <Field
        name="purpose"
        label="Purpose"
        defaultValue={
          agent?.purpose ??
          "Reviews SaaS billing pages and prepares safe actions."
        }
      />
      <Field
        name="policy"
        label="Policy"
        defaultValue={agent?.policy ?? "Finance SaaS Control"}
        disabled
      />
    </EntityDialog>
  );
}

function VendorDialog({
  mode,
  vendor,
  actions,
}: {
  mode: DialogMode;
  vendor?: VendorFixture;
  actions?: ManagementActionState;
}) {
  const isCreate = mode === "create";
  const enabled = Boolean(
    actions?.apiMode &&
    (isCreate ? actions.permissions?.create : actions.permissions?.update),
  );
  return (
    <EntityDialog
      title={isCreate ? "Add vendor" : "Edit vendor"}
      description="Track renewal and workflow context for a SaaS surface."
      enabled={enabled}
      disabledReason={actionDisabledReason(
        actions,
        isCreate ? "create vendors" : "update vendors",
      )}
      onSubmit={(values) =>
        isCreate
          ? actions?.onCreateVendor?.(values)
          : vendor
            ? actions?.onUpdateVendor?.(vendor.id, values)
            : undefined
      }
    >
      <Field
        name="name"
        label="Vendor name"
        defaultValue={vendor?.name ?? "Acme Analytics"}
      />
      <Field
        name="website"
        label="Website"
        defaultValue={vendor?.website ?? "http://localhost:4202"}
      />
      <SelectField
        name="category"
        label="Category"
        defaultValue={normalizeCategory(vendor?.category)}
        options={[
          ["analytics", "Analytics"],
          ["productivity", "Productivity"],
          ["sales", "Sales"],
          ["payroll", "Payroll"],
          ["finance", "Finance"],
          ["security", "Security"],
          ["other", "Other"],
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          name="monthlyCost"
          label="Monthly cost"
          defaultValue={`${vendor?.monthlyCost ?? 800}`}
          prefix="$"
          inputMode="decimal"
        />
        <Field
          name="renewalDate"
          label="Renewal date"
          defaultValue={dateInputValue(vendor?.renewalDate)}
          type="date"
          required={false}
        />
        <Field
          name="unusedSeats"
          label="Unused seats"
          defaultValue={`${vendor?.unusedSeats ?? 18}`}
          inputMode="numeric"
        />
      </div>
    </EntityDialog>
  );
}

function WorkflowDialog({
  mode,
  workflow,
  lookupItems,
  actions,
}: {
  mode: DialogMode;
  workflow?: WorkflowFixture;
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const isCreate = mode === "create";
  const agentItems = lookupItems?.agents ?? agents;
  const vendorItems = lookupItems?.vendors ?? vendors;
  const credentialItems = lookupItems?.credentials ?? credentials;
  const enabled = Boolean(
    actions?.apiMode &&
    (isCreate ? actions.permissions?.create : actions.permissions?.update),
  );
  const template =
    workflow?.templateKey ??
    templateKeyFromLabel(workflow?.template) ??
    "plan_downgrade_request";
  const workflowVendorId =
    workflow?.vendorId ??
    vendorItems.find((vendor) => vendor.name === workflow?.vendor)?.id ??
    vendorItems[0]?.id ??
    "";
  const workflowAgentId =
    workflow?.agentId ??
    agentItems.find((agent) => agent.name === workflow?.agent)?.id ??
    agentItems[0]?.id ??
    "";
  const credentialId =
    typeof workflow?.configurationJson?.credentialId === "string"
      ? workflow.configurationJson.credentialId
      : (credentialItems.find(
          (credential) => credential.vendorId === workflowVendorId,
        )?.id ??
        credentialItems[0]?.id ??
        "");

  return (
    <EntityDialog
      title={isCreate ? "Create workflow" : "Edit workflow"}
      description="Bind template, agent, vendor, policy, and credential readiness."
      enabled={enabled}
      disabledReason={actionDisabledReason(
        actions,
        isCreate ? "create workflows" : "update workflows",
      )}
      onSubmit={(values) =>
        isCreate
          ? actions?.onCreateWorkflow?.(values)
          : workflow
            ? actions?.onUpdateWorkflow?.(workflow.id, values)
            : undefined
      }
    >
      <Field
        name="name"
        label="Workflow name"
        defaultValue={workflow?.name ?? "Acme Downgrade Request"}
      />
      <SelectField
        name="template"
        label="Template"
        defaultValue={template}
        options={[
          ["vendor_invoice_download", "Vendor invoice download"],
          ["saas_renewal_check", "SaaS renewal check"],
          ["plan_downgrade_request", "Plan downgrade request"],
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="agentId"
          label="Agent"
          defaultValue={workflowAgentId}
          options={agentItems.map((agent) => [agent.id, agent.name])}
        />
        <SelectField
          name="vendorId"
          label="Vendor"
          defaultValue={workflowVendorId}
          options={vendorItems.map((vendor) => [vendor.id, vendor.name])}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="credentialId"
          label="Credential"
          defaultValue={credentialId}
          options={credentialItems.map((credential) => [
            credential.id,
            `${credential.label} (${credential.vendor})`,
          ])}
        />
        <Field
          name="targetPlan"
          label="Target plan"
          defaultValue={
            typeof workflow?.configurationJson?.targetPlan === "string"
              ? workflow.configurationJson.targetPlan
              : "starter"
          }
        />
      </div>
    </EntityDialog>
  );
}

function CredentialDialog({
  lookupItems,
  actions,
}: {
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const vendorItems = lookupItems?.vendors ?? vendors;
  const enabled = Boolean(actions?.apiMode && actions.permissions?.create);
  return (
    <EntityDialog
      title="Add credential"
      description="Create a write-only credential capsule. Existing secret values are never returned to the UI."
      enabled={enabled}
      disabledReason={actionDisabledReason(actions, "create credentials")}
      onSubmit={(values) => actions?.onCreateCredential?.(values)}
    >
      <Field name="label" label="Label" defaultValue="Acme billing portal" />
      <SelectField
        name="vendorId"
        label="Vendor"
        defaultValue={vendorItems[0]?.id ?? ""}
        options={vendorItems.map((vendor) => [vendor.id, vendor.name])}
      />
      <SelectField
        name="credentialType"
        label="Credential type"
        defaultValue="username_password"
        options={[
          ["username_password", "Username/password"],
          ["api_token", "API token"],
          ["oauth_token", "OAuth token"],
          ["session_cookie", "Session cookie"],
          ["totp_secret", "TOTP secret"],
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="username"
          label="Username"
          defaultValue="finance@northstarlabs.dev"
          autoComplete="username"
        />
        <Field
          name="password"
          label="Secret value"
          type="password"
          defaultValue=""
          placeholder="Paste once, then it becomes unrecoverable"
          autoComplete="new-password"
        />
      </div>
      <p className="text-pretty text-xs leading-5 text-muted-foreground">
        Write-only field. After submit, operators can rotate or revoke, never
        reveal.
      </p>
    </EntityDialog>
  );
}

function GrantDialog({
  credential,
  lookupItems,
  actions,
}: {
  credential?: CredentialFixture;
  lookupItems?: LookupItems;
  actions?: ManagementActionState;
}) {
  const credentialItems = lookupItems?.credentials ?? credentials;
  const agentItems = lookupItems?.agents ?? agents;
  const selectedCredential = credential ?? credentialItems[0];
  const enabled = Boolean(
    actions?.apiMode && actions.permissions?.grant && selectedCredential,
  );
  return (
    <EntityDialog
      title="Grant to agent"
      description="Give one agent scoped access to this credential capsule."
      triggerLabel="Grant to agent"
      triggerIcon={Key}
      enabled={enabled}
      disabledReason={actionDisabledReason(actions, "grant credentials")}
      onSubmit={(values) =>
        actions?.onGrantCredential?.(
          values.credentialId || selectedCredential.id,
          values,
        )
      }
    >
      <SelectField
        name="credentialId"
        label="Credential"
        defaultValue={selectedCredential?.id ?? ""}
        options={credentialItems.map((item) => [item.id, item.label])}
        disabled={Boolean(credential)}
      />
      <SelectField
        name="agentId"
        label="Agent"
        defaultValue={agentItems[0]?.id ?? ""}
        options={agentItems.map((agent) => [agent.id, agent.name])}
      />
      <Field name="scope" label="Scope" defaultValue="login" />
    </EntityDialog>
  );
}

function RevokeCredentialDialog({
  credential,
  actions,
}: {
  credential: CredentialFixture;
  actions?: ManagementActionState;
}) {
  return (
    <ConfirmDialog
      trigger="Revoke"
      title={`Revoke ${credential.label}?`}
      description="All agent grants will stop using this credential. This cannot reveal the old secret."
      enabled={
        actions?.apiMode &&
        actions?.permissions?.revoke &&
        credential.status !== "revoked"
      }
      disabledReason={actionDisabledReason(
        actions,
        "revoke credentials",
        actions?.permissions?.revoke,
      )}
      onConfirm={() => actions?.onRevokeCredential?.(credential.id)}
    />
  );
}

function RevokeGrantDialog({
  credential,
  grant,
  actions,
}: {
  credential: CredentialFixture;
  grant: { grantId: string; agentId: string; agentName: string; scope: string };
  actions?: ManagementActionState;
}) {
  return (
    <ConfirmDialog
      trigger="Revoke grant"
      title={`Revoke grant for ${grant.agentName}?`}
      description="The agent will lose access to this credential capsule for future runs."
      enabled={
        actions?.apiMode &&
        actions?.permissions?.revoke &&
        grant.grantId !== grant.agentName
      }
      disabledReason={actionDisabledReason(
        actions,
        "revoke credential grants",
        actions?.permissions?.revoke,
      )}
      onConfirm={() => actions?.onRevokeGrant?.(credential.id, grant.grantId)}
    />
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  actionLabel = "Revoke",
  enabled = true,
  disabledReason,
  onConfirm,
}: {
  trigger: string;
  title: string;
  description: string;
  actionLabel?: string;
  enabled?: boolean;
  disabledReason?: string;
  onConfirm?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const disabledHintId = useId();

  async function handleConfirm() {
    if (!onConfirm || !enabled) return;
    setError("");
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!enabled}
          aria-describedby={
            !enabled
              ? disabledHintId
              : undefined
          }
        >
          <Trash className="size-3.5" strokeWidth={1.8} />
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Working..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      {!enabled ? (
        <p id={disabledHintId} className="mt-1 max-w-64 text-xs text-muted-foreground">
          {disabledReason ?? "Unavailable in demo mode or for this role."}
        </p>
      ) : null}
    </AlertDialog>
  );
}

function EntityDialog({
  title,
  description,
  triggerLabel,
  triggerIcon: TriggerIcon,
  enabled = true,
  disabledReason,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  triggerLabel?: string;
  triggerIcon?: DashboardIcon;
  enabled?: boolean;
  disabledReason?: string;
  onSubmit?: SubmitHandler;
  children: ReactNode;
}) {
  const Icon = TriggerIcon ?? (title.includes("Edit") ? EditPencil : Plus);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const disabledHintId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSubmit || !enabled) return;
    setError("");
    const validationErrors = validateDialogForm(event.currentTarget);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError("Fix the highlighted fields before saving.");
      return;
    }

    setPending(true);
    const values = formValues(new FormData(event.currentTarget));
    try {
      await onSubmit(values);
      setOpen(false);
      setFieldErrors({});
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={title.includes("Edit") ? "outline" : "default"}
          className="h-10"
          disabled={!enabled}
          aria-describedby={!enabled ? disabledHintId : undefined}
        >
          <Icon className="size-4" strokeWidth={1.8} />
          {triggerLabel ?? (title.includes("Edit") ? "Edit" : title)}
        </Button>
      </DialogTrigger>
      {!enabled ? (
        <p id={disabledHintId} className="mt-1 max-w-64 text-xs text-muted-foreground">
          {disabledReason ?? "Unavailable in demo mode or for this role."}
        </p>
      ) : null}
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FieldErrorContext.Provider value={fieldErrors}>
            <div className="grid gap-4 py-4">{children}</div>
          </FieldErrorContext.Provider>
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !enabled}>
              {pending
                ? "Saving..."
                : title.includes("Edit")
                  ? "Save changes"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AsyncActionButton({
  label,
  icon: Icon,
  enabled = true,
  onAction,
  className = "h-10",
}: {
  label: string;
  icon?: DashboardIcon;
  enabled?: boolean;
  onAction?: () => Promise<void> | void;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const disabledHintId = useId();

  async function handleClick() {
    if (!onAction || !enabled) return;
    setError("");
    setPending(true);
    try {
      await onAction();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <Button
        type="button"
        className={className}
        disabled={!enabled || pending}
        onClick={() => void handleClick()}
        aria-describedby={!enabled ? disabledHintId : undefined}
      >
        {Icon ? <Icon className="size-4" strokeWidth={1.8} /> : null}
        {pending ? "Working..." : label}
      </Button>
      {!enabled ? (
        <p id={disabledHintId} className="mt-1 max-w-64 text-xs text-muted-foreground">
          Unavailable in demo mode or for this role.
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 max-w-64 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function actionDisabledReason(
  actions: ManagementActionState | undefined,
  action: string,
  canUseAction = false,
) {
  return disabledReasonForAction(actions?.apiMode, action, canUseAction);
}

function formValues(data: FormData): SubmitValues {
  const values: SubmitValues = {};
  for (const [key, value] of data.entries()) {
    values[key] = typeof value === "string" ? value.trim() : "";
  }
  return values;
}

function validateDialogForm(form: HTMLFormElement): FieldErrors {
  const errors: FieldErrors = {};
  const controls = Array.from(form.elements).filter(
    (
      element,
    ): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement,
  );

  for (const control of controls) {
    if (!control.name || control.disabled) continue;
    const label =
      form
        .querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
        ?.textContent?.trim() ?? control.name;
    const value = control.value.trim();

    if (control.dataset.required === "true" && !value) {
      errors[control.name] = `${label} is required.`;
      continue;
    }

    if (control.type === "url" && value && !isValidUrl(value)) {
      errors[control.name] = `${label} must be a valid URL.`;
    }

    if (
      control.type === "email" &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      errors[control.name] = `${label} must be a valid email.`;
    }

    if (
      ["monthlyCost", "unusedSeats", "amount"].includes(control.name) &&
      value &&
      !Number.isFinite(Number(value))
    ) {
      errors[control.name] = `${label} must be a number.`;
    }
  }

  return errors;
}

function isValidUrl(value: string) {
  try {
    new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return true;
  } catch {
    return false;
  }
}

function normalizeCategory(value: string | undefined) {
  const normalized = (value ?? "other").toLowerCase().replace(/\s+/g, "_");
  if (
    [
      "analytics",
      "productivity",
      "sales",
      "payroll",
      "finance",
      "security",
      "other",
    ].includes(normalized)
  )
    return normalized;
  return "other";
}

function dateInputValue(value: string | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? (value ?? "") : "";
}

function actionTypeFromLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("download")) return "download_file";
  if (normalized.includes("change plan")) return "change_plan";
  if (normalized.includes("remove seats")) return "change_plan";
  if (normalized.includes("payment")) return "change_billing_details";
  if (normalized.includes("invoice")) return "read_page";
  return normalized.replace(/\s+/g, "_");
}

function dollarsToCents(value: string) {
  const amount = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function templateKeyFromLabel(value: string | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("invoice")) return "vendor_invoice_download";
  if (normalized.includes("renewal")) return "saas_renewal_check";
  if (normalized.includes("downgrade")) return "plan_downgrade_request";
  return undefined;
}

function FilterRow({
  query,
  setQuery,
  placeholder,
  children,
}: {
  query: string;
  setQuery: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-10 pl-9"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {children}
      </div>
    </div>
  );
}

function SurfaceList({
  items,
}: {
  items: {
    id: string;
    href: string;
    icon: DashboardIcon;
    title: string;
    subtitle: string;
    meta: string[];
    badge: ReactNode;
    action?: ReactNode;
  }[];
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center shadow-xs">
        <p className="text-sm font-medium">No matching records</p>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-6 text-muted-foreground">
          Clear the search or filters, or create a new item when your role has
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background shadow-xs">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.id}
            className="grid gap-3 p-4 transition-[background-color] hover:bg-muted/35 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35">
                  <Icon
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0">
                  <Link
                    href={item.href}
                    className="inline-flex min-w-0 items-center gap-2 font-semibold transition-colors hover:text-muted-foreground"
                  >
                    <span className="truncate">{item.title}</span>
                    <ArrowRight className="size-3.5 shrink-0" />
                  </Link>
                  <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.meta.map((value) => (
                  <span
                    key={value}
                    className="rounded-md border border-border bg-muted/35 px-2 py-0.5 text-xs leading-5 text-muted-foreground"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {item.badge}
              {item.action}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: DashboardIcon;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-md border border-border bg-muted/35 p-3"
        >
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-2 break-words text-sm font-medium tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Field({
  label,
  defaultValue,
  prefix,
  name,
  type = "text",
  placeholder,
  disabled,
  inputMode,
  autoComplete,
  required = true,
}: {
  label: string;
  defaultValue: string;
  prefix?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  required?: boolean;
}) {
  const id = name ?? label.toLowerCase().replace(/\s+/g, "-");
  const errors = useContext(FieldErrorContext);
  const error = name ? errors[name] : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          name={name ?? id}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          autoComplete={autoComplete}
          data-required={required ? "true" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={prefix ? "h-10 pl-7" : "h-10"}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  disabled,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
  disabled?: boolean;
  required?: boolean;
}) {
  const errors = useContext(FieldErrorContext);
  const error = errors[name];
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        data-required={required ? "true" : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TagEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = draft.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-muted/35 px-3 py-1.5 text-sm"
          >
            {value}
            <button
              type="button"
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <XmarkCircle className="size-3.5" strokeWidth={1.8} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="h-10"
        />
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={addValue}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function ActionMatrix({
  decisions: actionDecisions,
  onChange,
}: {
  decisions: Record<string, ActionDecision>;
  onChange: (decisions: Record<string, ActionDecision>) => void;
}) {
  const decisions = ["Allow", "Approval", "Deny"];
  const actions = Object.keys(actionDecisions);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {actions.map((action, index) => (
        <div
          key={action}
          className="grid gap-3 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div>
            <p className="text-sm font-medium">{action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {index < 2
                ? "Low-risk evidence action"
                : "Authority-changing action"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {decisions.map((decision) => (
              <Button
                key={decision}
                type="button"
                variant={
                  decision === actionDecisions[action] ? "default" : "outline"
                }
                size="sm"
                aria-pressed={decision === actionDecisions[action]}
                onClick={() =>
                  onChange({
                    ...actionDecisions,
                    [action]: decision as ActionDecision,
                  })
                }
              >
                {decision}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PolicyNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <PolicyTextField
      label={label}
      value={value}
      onChange={onChange}
      prefix="$"
      inputMode="numeric"
    />
  );
}

function PolicyTextField({
  label,
  value,
  onChange,
  prefix,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = `policy-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          className={prefix ? "h-10 pl-7" : "h-10"}
        />
      </div>
    </div>
  );
}

function matches(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}
