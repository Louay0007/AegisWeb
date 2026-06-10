"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Clock, Page, ShieldCheck } from "iconoir-react";

import { WorkflowRunStatusBadge } from "@/components/display/workflow-run-status-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { approvals, type WorkflowRunFixture } from "@/lib/fixtures/dashboard";
import { motionTokens, springs } from "@/lib/motion-tokens";

const progressByStatus: Record<string, number> = {
  pending: 12,
  queued: 18,
  running: 55,
  waiting: 72,
  approved: 82,
  completed: 100,
  failed: 100,
  rejected: 100,
  denied: 100,
};

export function LiveRunPanel({ run }: { run: WorkflowRunFixture }) {
  const reduce = useReducedMotion();
  const approval = approvals.find(
    (item) => item.vendor === run.vendor && item.agent === run.agent,
  );
  const progress = progressByStatus[run.status] ?? 40;

  return (
    <section
      aria-live="polite"
      className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowRunStatusBadge status={run.status} live />
            <RiskLevelBadge risk={run.risk} />
            <PolicyDecisionBadge decision={run.policyDecision} />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-normal">
            {run.workflow}
          </h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
            {run.currentStep}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href={`/app/runs/${run.id}`}>
            Open run
            <ArrowRight className="size-4" strokeWidth={1.8} />
          </Link>
        </Button>
      </div>

      <div className="mt-5">
        <Progress value={progress} className="h-2" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <RunMeta icon={Clock} label="Duration" value={run.duration} />
          <RunMeta icon={ShieldCheck} label="Agent" value={run.agent} />
          <RunMeta
            icon={Page}
            label="Files"
            value={`${run.files.length} attached`}
          />
        </div>
      </div>

      {run.status === "waiting" && approval ? (
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: motionTokens.duration.instant }
              : springs.gentle
          }
          className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950"
        >
          <p className="text-sm font-medium">
            Approval required before the browser can continue.
          </p>
          <p className="mt-1 text-pretty text-sm leading-6 text-amber-900/80">
            {approval.policyTrigger}
          </p>
          <Button asChild className="mt-3 h-10">
            <Link href={`/app/approvals/${approval.id}`}>
              Review approval
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </Link>
          </Button>
        </motion.div>
      ) : null}
    </section>
  );
}

function RunMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/35 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} />
        {label}
      </div>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
