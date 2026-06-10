"use client";

import {
  CheckCircle,
  GitBranch,
  Key,
  ShieldCheck,
  WarningTriangle,
} from "iconoir-react";

import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { StatusBadge } from "@/components/display/status-badge";
import {
  type AgentFixture,
  type CredentialFixture,
  type PolicyFixture,
  type VendorFixture,
  type WorkflowFixture,
} from "@/lib/fixtures/dashboard";
import { cn } from "@/lib/utils";

type CheckState = "ready" | "warning" | "blocked";

type ReadinessIcon = typeof GitBranch;

export function WorkflowReadinessPanel({
  workflow,
  agent,
  vendor,
  policy,
  credential,
  compact = false,
}: {
  workflow: WorkflowFixture;
  agent?: AgentFixture;
  vendor?: VendorFixture;
  policy?: PolicyFixture;
  credential?: CredentialFixture;
  compact?: boolean;
}) {
  const checks: {
    label: string;
    detail: string;
    state: CheckState;
    icon: ReadinessIcon;
  }[] = [
    {
      label: "Agent identity",
      detail: agent ? `${agent.name} is ${agent.status}` : "No agent selected",
      state: agent?.status === "active" ? "ready" : "warning",
      icon: GitBranch,
    },
    {
      label: "Policy gate",
      detail: policy
        ? `${policy.name} ${policy.version}`
        : "Policy will be reviewed",
      state: workflow.readiness === "policy_review" ? "warning" : "ready",
      icon: ShieldCheck,
    },
    {
      label: "Credential grant",
      detail: credential
        ? `${credential.label} is scoped`
        : "Missing scoped grant",
      state: credential ? "ready" : "blocked",
      icon: Key,
    },
    {
      label: "Vendor risk",
      detail: vendor
        ? `${vendor.name} renewal risk: ${vendor.risk}`
        : "No vendor selected",
      state:
        vendor?.risk === "critical"
          ? "blocked"
          : vendor?.risk === "high"
            ? "warning"
            : "ready",
      icon: WarningTriangle,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">
            Workflow readiness
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Authority, policy, credential, and vendor checks before a run
            starts.
          </p>
        </div>
        <StatusBadge status={workflow.status} />
      </div>

      <div
        className={cn(
          "grid gap-3",
          compact ? "sm:grid-cols-2" : "lg:grid-cols-2",
        )}
      >
        {checks.map((check) => (
          <ReadinessCheck key={check.label} {...check} />
        ))}
      </div>

      {vendor ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/35 p-3 text-sm">
          <span className="font-medium">Selected vendor:</span>
          <span>{vendor.name}</span>
          <RiskLevelBadge risk={vendor.risk} />
        </div>
      ) : null}
    </section>
  );
}

function ReadinessCheck({
  label,
  detail,
  state,
  icon: Icon,
}: {
  label: string;
  detail: string;
  state: CheckState;
  icon: ReadinessIcon;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        state === "ready" && "border-border bg-muted/30",
        state === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        state === "blocked" &&
          "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-current/20 bg-background/70">
          {state === "ready" ? (
            <CheckCircle className="size-4" strokeWidth={1.8} />
          ) : (
            <Icon className="size-4" strokeWidth={1.8} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-pretty text-xs leading-5 opacity-75">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
