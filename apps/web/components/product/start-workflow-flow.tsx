"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CheckCircle,
  Key,
  Play,
  ShieldCheck,
  UserBadgeCheck,
} from "iconoir-react";

import { WorkflowReadinessPanel } from "@/components/product/workflow-readiness-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  agents,
  credentials,
  policies,
  vendors,
  workflows,
} from "@/lib/fixtures/dashboard";
import { apiGet, apiPost } from "@/lib/api/api-client";
import { useApiResource } from "@/lib/api/resource-state";
import {
  mapAgent,
  mapCredential,
  mapPolicy,
  mapVendor,
  mapWorkflow,
  type AgentDto,
  type CredentialDto,
  type PolicyDto,
  type VendorDto,
  type WorkflowDto,
} from "@/lib/api/mappers";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { isDemoModeEnabled } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

export function StartWorkflowFlow({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [workflowId, setWorkflowId] = useState("wf-acme-downgrade");
  const [error, setError] = useState("");
  const demoEnabled = isDemoModeEnabled();
  const useFixtureData = demoEnabled;
  const agentsResource = useApiResource(
    "start-agents",
    async () => (await apiGet<AgentDto[]>("/agents")).map(mapAgent),
    { fallbackData: agents, enabled: open },
  );
  const agentItems =
    agentsResource.state.status === "success" ||
    agentsResource.state.status === "empty"
      ? agentsResource.state.data
      : useFixtureData
        ? agents
        : [];
  const vendorsResource = useApiResource(
    "start-vendors",
    async () => (await apiGet<VendorDto[]>("/vendors")).map(mapVendor),
    { fallbackData: vendors, enabled: open },
  );
  const vendorItems =
    vendorsResource.state.status === "success" ||
    vendorsResource.state.status === "empty"
      ? vendorsResource.state.data
      : useFixtureData
        ? vendors
        : [];
  const credentialsResource = useApiResource(
    "start-credentials",
    async () =>
      (await apiGet<CredentialDto[]>("/credentials")).map((credential) =>
        mapCredential(credential, vendorItems, agentItems),
      ),
    { fallbackData: credentials, enabled: open },
  );
  const credentialItems =
    credentialsResource.state.status === "success" ||
    credentialsResource.state.status === "empty"
      ? credentialsResource.state.data
      : useFixtureData
        ? credentials
        : [];
  const policiesResource = useApiResource(
    "start-policies",
    async () =>
      (await apiGet<PolicyDto[]>("/policies")).map((policy) =>
        mapPolicy(policy, agentItems),
      ),
    { fallbackData: policies, enabled: open },
  );
  const policyItems =
    policiesResource.state.status === "success" ||
    policiesResource.state.status === "empty"
      ? policiesResource.state.data
      : useFixtureData
        ? policies
        : [];
  const workflowsResource = useApiResource(
    "start-workflows",
    async () =>
      (await apiGet<WorkflowDto[]>("/workflows")).map((item) =>
        mapWorkflow(item, agentItems, vendorItems),
      ),
    { fallbackData: workflows, enabled: open },
  );
  const workflowItems =
    workflowsResource.state.status === "success" ||
    workflowsResource.state.status === "empty"
      ? workflowsResource.state.data
      : useFixtureData
        ? workflows
        : [];
  const isApiMode = workflowsResource.state.source === "api";

  const workflow =
    workflowItems.find((item) => item.id === workflowId) ?? workflowItems[0];
  const agent = workflow
    ? agentItems.find((item) => item.name === workflow.agent)
    : undefined;
  const vendor = workflow
    ? vendorItems.find((item) => item.name === workflow.vendor)
    : undefined;
  const policy = workflow
    ? policyItems.find((item) => item.agent === workflow.agent)
    : undefined;
  const credential = credentialItems.find(
    (item) =>
      workflow &&
      item.vendor === workflow.vendor &&
      item.grantedAgents.includes(workflow.agent),
  );

  const steps = useMemo(
    () => [
      { title: "Template", icon: Play },
      { title: "Authority", icon: ShieldCheck },
      { title: "Confirm", icon: CheckCircle },
    ],
    [],
  );

  async function startRun() {
    setError("");
    if (!workflow) {
      setError("No workflow is available to start.");
      return;
    }
    if (!isApiMode) {
      if (demoEnabled) {
        setOpen(false);
        router.push("/app/runs/run-acme-2048?demo=1");
        return;
      }
      setError("The API must be available before a workflow can be started.");
      return;
    }

    try {
      const result = await apiPost<{ run: { id: string }; queueJobId: string }>(
        `/workflows/${workflow.id}/runs`,
        {},
      );
      setOpen(false);
      router.push(`/app/runs/${result.run.id}`);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start workflow.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-10">
            <Play className="size-4" strokeWidth={1.8} />
            Start workflow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Start controlled workflow</DialogTitle>
          <DialogDescription>
            Select a workflow, review authority, then open the live run.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {!isApiMode ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {demoEnabled
              ? "Demo mode: starting this workflow opens the fixture run."
              : "API unavailable: workflow start is disabled until live data loads."}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav
            aria-label="Start workflow steps"
            className="grid gap-2 self-start"
          >
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
                    step === index
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                  {item.title}
                </button>
              );
            })}
          </nav>

          <motion.div
            key={step}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: motionTokens.duration.instant }
                : springs.gentle
            }
            className="min-w-0"
          >
            {step === 0 ? (
              <div className="grid gap-3">
                {workflowItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWorkflowId(item.id)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      workflowId === item.id
                        ? "border-foreground bg-muted"
                        : "border-border bg-background hover:bg-muted/60",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.template}
                        </p>
                      </div>
                      <span className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                        {item.readiness.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {step === 1 ? (
              workflow ? (
                <WorkflowReadinessPanel
                  workflow={workflow}
                  agent={agent}
                  vendor={vendor}
                  policy={policy}
                  credential={credential}
                  compact
                />
              ) : (
                <EmptyWorkflowSelection />
              )
            ) : null}

            {step === 2 ? (
              <section className="rounded-lg border border-border bg-background p-5">
                <h3 className="text-lg font-semibold">Confirm run scope</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  AegisWeb will start a controlled browser run and pause if
                  policy requires approval.
                </p>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ConfirmItem
                    icon={Play}
                    label="Workflow"
                    value={workflow?.name ?? "No workflow loaded"}
                  />
                  <ConfirmItem
                    icon={UserBadgeCheck}
                    label="Agent"
                    value={workflow?.agent ?? "No agent loaded"}
                  />
                  <ConfirmItem
                    icon={ShieldCheck}
                    label="Policy"
                    value={policy?.name ?? "Policy review"}
                  />
                  <ConfirmItem
                    icon={Key}
                    label="Credential"
                    value={credential?.label ?? "Grant missing"}
                  />
                </dl>
              </section>
            ) : null}
          </motion.div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() =>
                setStep((current) => Math.min(steps.length - 1, current + 1))
              }
            >
              Continue
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </Button>
          ) : (
            <Button onClick={startRun} disabled={!workflow}>
              {isApiMode
                ? "Start run"
                : demoEnabled
                  ? "Start demo run"
                  : "API required"}
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyWorkflowSelection() {
  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <h3 className="text-lg font-semibold">No workflow loaded</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect to the API or create a workflow before starting a run.
      </p>
    </section>
  );
}

function ConfirmItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Play;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/35 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} />
        {label}
      </div>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}
