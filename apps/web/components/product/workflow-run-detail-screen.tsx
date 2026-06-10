import Link from "next/link";
import {
  ArrowRight,
  DatabaseMonitor,
  Key,
  Page,
  ShieldCheck,
  TaskList,
  WarningTriangle,
  XmarkCircle,
} from "iconoir-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { WorkflowRunStatusBadge } from "@/components/display/workflow-run-status-badge";
import { ScreenshotViewer } from "@/components/evidence/screenshot-viewer";
import { FileList } from "@/components/evidence/file-list";
import { ReceiptTimeline } from "@/components/evidence/receipt-timeline";
import { LiveRunPanel } from "@/components/product/live-run-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type AuditEventFixture,
  type ApprovalFixture,
  type WorkflowRunFixture,
} from "@/lib/fixtures/dashboard";
import { formatCurrency, truncateMiddle } from "@/lib/format/formatters";
import type { EvidenceFileItem } from "@/lib/evidence-types";

export function WorkflowRunDetailScreen({
  run,
  onDownloadFile,
  onCancel,
}: {
  run: WorkflowRunFixture;
  onDownloadFile?: (
    file: Extract<EvidenceFileItem, object>,
  ) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
}) {
  const relatedApproval =
    run.evidence?.approvals?.[0] as ApprovalFixture | undefined;
  const events =
    (run.evidence?.auditEvents as AuditEventFixture[] | undefined) ?? [];
  const runTimeline = run.evidence?.timeline;
  const screenshots = run.evidence?.screenshots;
  const isWaiting = run.status === "waiting";
  const receipt = run.evidence?.receipt;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow run"
        title={run.workflow}
        description={run.currentStep}
        actions={
          <>
            {isWaiting && relatedApproval ? (
              <Button asChild className="h-10">
                <Link href={`/app/approvals/${relatedApproval.id}`}>
                  Review approval
                  <ArrowRight className="size-4" strokeWidth={1.8} />
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="h-10"
              disabled={
                run.status === "completed" ||
                run.status === "failed" ||
                !onCancel
              }
              title={
                run.status === "completed" || run.status === "failed"
                  ? "Terminal runs cannot be canceled."
                  : !onCancel
                    ? "Connect to the backend API to cancel runs."
                    : undefined
              }
              onClick={() => void onCancel?.()}
            >
              <XmarkCircle className="size-4" strokeWidth={1.8} />
              Cancel run
            </Button>
            {receipt ? (
              <Button asChild variant="outline" className="h-10">
                <Link href={`/app/receipts/${receipt.id}`}>
                  Open receipt
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <section
        aria-live="polite"
        className="rounded-lg border border-border bg-background p-4 shadow-xs"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <StatusPill
            icon={TaskList}
            label="State"
            value={<WorkflowRunStatusBadge status={run.status} live />}
          />
          <StatusPill
            icon={WarningTriangle}
            label="Risk"
            value={<RiskLevelBadge risk={run.risk} />}
          />
          <StatusPill
            icon={ShieldCheck}
            label="Policy"
            value={<PolicyDecisionBadge decision={run.policyDecision} />}
          />
          <StatusPill
            icon={TaskList}
            label="Duration"
            value={<span className="tabular-nums">{run.duration}</span>}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <LiveRunPanel run={run} />

          <Panel title="Execution timeline" icon={TaskList}>
            {runTimeline?.length ? (
              <ReceiptTimeline phases={runTimeline} />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                No timeline phases are available for this run yet.
              </div>
            )}
          </Panel>

          <Panel title="Browser and file evidence" icon={DatabaseMonitor}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <ScreenshotViewer
                screenshots={screenshots?.length ? screenshots : undefined}
              />
              <FileList files={run.files} onDownload={onDownloadFile} />
            </div>
          </Panel>

          <Panel title="Audit stream" icon={TaskList}>
            <AuditStream events={events} />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          {isWaiting && relatedApproval ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-5 text-amber-950 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-background">
                  <WarningTriangle
                    className="size-5 text-amber-700"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    Human approval required
                  </h2>
                  <p className="mt-2 text-pretty text-sm leading-6 text-amber-900/80">
                    {relatedApproval.policyTrigger}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <Meta
                  label="Requested amount"
                  value={formatCurrency(relatedApproval.amount)}
                />
                <Meta label="Expires" value={relatedApproval.expiresAt} />
              </dl>
              <Button asChild className="mt-4 h-11 w-full">
                <Link href={`/app/approvals/${relatedApproval.id}`}>
                  Open decision packet
                  <ArrowRight className="size-4" strokeWidth={1.8} />
                </Link>
              </Button>
            </section>
          ) : null}

          <Panel title="Run metadata" icon={Page}>
            <dl className="grid gap-3">
              <Meta label="Run ID" value={run.id} mono />
              <Meta label="Agent" value={run.agent} />
              <Meta label="Vendor" value={run.vendor} />
              <Meta label="Started" value={run.startedAt} />
              <Meta label="Current step" value={run.currentStep} />
            </dl>
          </Panel>

          <Panel title="Policy decision" icon={ShieldCheck}>
            <div className="space-y-4">
              <PolicyDecisionBadge decision={run.policyDecision} />
              <p className="text-pretty text-sm leading-6 text-muted-foreground">
                The run can continue only after the matched approval rule is
                resolved. The agent keeps its credential grant scoped while
                waiting.
              </p>
              {receipt ? (
                <Button asChild variant="outline" className="h-10 w-full">
                  <Link href={`/app/receipts/${receipt.id}`}>
                    View receipt packet
                    <ArrowRight className="size-4" strokeWidth={1.8} />
                  </Link>
                </Button>
              ) : null}
              <div className="rounded-md border border-border bg-muted/35 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Key
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                  Credential capsule active
                </div>
                <p className="mt-2 text-pretty text-xs leading-5 text-muted-foreground">
                  Plaintext credential values are never exposed to the operator
                  UI.
                </p>
              </div>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof TaskList;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TaskList;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/35 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} />
        {label}
      </div>
      <div className="min-h-6 text-sm font-medium">{value}</div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/35 p-3">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-2 break-all font-mono text-xs"
            : "mt-2 break-words text-sm font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function AuditStream({ events }: { events: AuditEventFixture[] }) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
        No audit events are available for this run yet.
      </div>
    );
  }

  return (
    <div className="min-w-0 divide-y divide-border rounded-lg border border-border">
      {events.map((event) => (
        <article
          key={event.id}
          className="grid gap-3 p-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start"
        >
          <div className="text-xs text-muted-foreground tabular-nums">
            {event.timestamp}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-md font-mono text-[11px]"
              >
                {event.eventType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {event.actor}
              </span>
            </div>
            <p className="mt-2 text-pretty text-sm leading-6">
              {event.description}
            </p>
          </div>
          <span className="justify-self-start font-mono text-xs text-muted-foreground md:justify-self-end">
            {truncateMiddle(event.hash, 14)}
          </span>
        </article>
      ))}
    </div>
  );
}
