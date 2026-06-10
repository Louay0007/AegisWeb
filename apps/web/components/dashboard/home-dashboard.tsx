"use client";

import Link from "next/link";
import {
  Bell,
  Eye,
  Key,
  TaskList,
  UserBadgeCheck,
  WarningTriangle,
} from "iconoir-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { EntityList } from "@/components/data/entity-list";
import { MetricTile } from "@/components/data/metric-tile";
import { Timeline } from "@/components/data/timeline";
import { HashIntegrityIndicator } from "@/components/display/hash-integrity-indicator";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { WorkflowRunStatusBadge } from "@/components/display/workflow-run-status-badge";
import { AuditEventDrawer } from "@/components/evidence/audit-event-drawer";
import { StartWorkflowFlow } from "@/components/product/start-workflow-flow";
import { LiveRunPanel } from "@/components/product/live-run-panel";
import {
  useAgents,
  useApprovals,
  useAuditEvents,
  useCredentials,
  useReceipts,
  useWorkflowRuns,
  pickItems,
} from "@/lib/data-layer";

const metricIcons = [Bell, UserBadgeCheck, TaskList, Key];

export function HomeDashboard() {
  const runsResource = useWorkflowRuns();
  const runItems = pickItems(runsResource, []);
  const approvalsResource = useApprovals();
  const approvalItems = pickItems(approvalsResource, []);
  const receiptsResource = useReceipts();
  const receiptItems = pickItems(receiptsResource, []);
  const auditResource = useAuditEvents();
  const auditItems = pickItems(auditResource, []);
  const agentsResource = useAgents();
  const agentItems = pickItems(agentsResource, []);
  const credentialsResource = useCredentials();
  const credentialItems = pickItems(credentialsResource, []);

  const displayedActiveRun = runItems[0];
  const metrics = [
    {
      label: "Pending approvals",
      value: `${approvalItems.filter((item) => item.status === "pending").length}`,
      detail: `${approvalItems.filter((item) => item.risk === "high" || item.risk === "critical").length} high risk`,
      tone: "warning" as const,
    },
    {
      label: "Active agents",
      value: `${agentItems.filter((item) => item.status === "active").length}`,
      detail: `${agentItems.filter((item) => item.credentialGrants.length > 0).length} scoped`,
      tone: "neutral" as const,
    },
    {
      label: "Runs loaded",
      value: `${runItems.length}`,
      detail: `${runItems.filter((item) => item.status === "waiting" || item.status === "running").length} active`,
      tone: "running" as const,
    },
    {
      label: "Vault items",
      value: `${credentialItems.length}`,
      detail: `${credentialItems.filter((item) => item.status === "active").length} active`,
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control gateway"
        title="Agent authority, approvals, and receipts in one place."
        description="AegisWeb shows what agents can do, what they are doing now, what needs a human decision, and what evidence was recorded."
        actions={<StartWorkflowFlow />}
      />
      {[
        runsResource.state,
        approvalsResource.state,
        receiptsResource.state,
        auditResource.state,
        agentsResource.state,
        credentialsResource.state,
      ].some(
        (state) => state.status === "success" && state.source === "fixture",
      ) ||
      [
        runsResource.state,
        approvalsResource.state,
        receiptsResource.state,
        auditResource.state,
        agentsResource.state,
        credentialsResource.state,
      ].some(
        (state) => state.status === "empty" && state.source === "fixture",
      ) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Showing demo fixture data because the API is unavailable or demo mode
          is active.
        </div>
      ) : null}

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Dashboard metrics"
      >
        {metrics.map((metric, index) => (
          <MetricTile
            key={metric.label}
            {...metric}
            icon={metricIcons[index]}
          />
        ))}
      </section>

      <section
        className="rounded-lg border border-border bg-background p-5 shadow-xs"
        aria-label="Priority work queue"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
              <WarningTriangle className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-normal">
                Needs attention
              </h2>
              <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                {
                  approvalItems.filter((item) => item.status === "pending")
                    .length
                }{" "}
                approval pending,{" "}
                {runItems.filter((item) => item.status === "waiting").length}{" "}
                run waiting, and{" "}
                {
                  auditItems.filter((item) =>
                    item.eventType.includes("approval"),
                  ).length
                }{" "}
                approval event recorded.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-10">
              <Link href="/app/approvals">Review approvals</Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link href="/app/runs">Inspect runs</Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link href="/app/audit">Open audit</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]"
        aria-label="Operational overview"
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-normal">
                Active workflow runs
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Runs that are moving, paused, or recently completed.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/app/runs">View runs</Link>
            </Button>
          </div>
          {displayedActiveRun ? (
            <div className="mb-4">
              <LiveRunPanel run={displayedActiveRun} />
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              No active workflow runs yet. Start a workflow to see live run
              evidence here.
            </div>
          )}
          <EntityList
            items={runItems.map((run) => ({
              id: run.id,
              title: run.workflow,
              subtitle: `${run.agent} to ${run.vendor}`,
              href: `/app/runs/${run.id}`,
              meta: run.duration,
              badge: (
                <WorkflowRunStatusBadge status={run.status} size="compact" />
              ),
            }))}
          />
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-normal">
              Approval queue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Human gates for risky web actions.
            </p>
          </div>
          <EntityList
            items={approvalItems.map((approval) => ({
              id: approval.id,
              title: approval.action,
              subtitle: `${approval.agent} to ${approval.vendor}`,
              href: `/app/approvals/${approval.id}`,
              meta: approval.expiresAt,
              badge: <RiskLevelBadge risk={approval.risk} />,
            }))}
          />
        </div>
      </section>

      <section
        className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
        aria-label="Evidence overview"
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-normal">
              Current evidence timeline
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent audit events and approval evidence from live workflow
              activity.
            </p>
          </div>
          {auditItems.length > 0 ? (
            <Timeline
              items={auditItems.slice(0, 8).map((event) => ({
                title: event.eventType,
                description: event.description,
                time: event.timestamp,
                status: "completed" as const,
              }))}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              No evidence timeline yet. Audit events will appear here after
              agents run workflows.
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
            <h2 className="text-lg font-semibold tracking-normal">
              Recent receipts
            </h2>
            <div className="mt-5">
              <EntityList
                items={receiptItems.map((receipt) => ({
                  id: receipt.id,
                  title: receipt.summary,
                  subtitle: `${receipt.agent} to ${receipt.vendor}`,
                  href: `/app/receipts/${receipt.id}`,
                  badge: <HashIntegrityIndicator hash={receipt.hash} />,
                }))}
              />
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
            <h2 className="text-lg font-semibold tracking-normal">
              Risk events
            </h2>
            <div className="mt-5">
              <div className="divide-y divide-border rounded-lg border border-border">
                {auditItems.map((event) => (
                  <article key={event.id} className="grid gap-3 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-medium">
                          {event.eventType}
                        </p>
                        <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                      <AuditEventDrawer
                        event={event}
                        trigger={
                          <Button variant="outline" size="sm" className="h-9">
                            <Eye className="size-4" strokeWidth={1.8} />
                            Inspect
                          </Button>
                        }
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {event.timestamp}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
