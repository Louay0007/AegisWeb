"use client";

import {
  Archive,
  CheckCircle,
  ClipboardCheck,
  Copy,
  DatabaseMonitor,
  Download,
  Key,
  Lock,
  Page,
  ShieldCheck,
  TaskList,
} from "iconoir-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell/page-header";
import { HashIntegrityIndicator } from "@/components/display/hash-integrity-indicator";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { StatusBadge } from "@/components/display/status-badge";
import { FileList } from "@/components/evidence/file-list";
import {
  ReceiptTimeline,
} from "@/components/evidence/receipt-timeline";
import { ScreenshotViewer } from "@/components/evidence/screenshot-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ApprovalFixture,
  type ReceiptFixture,
} from "@/lib/fixtures/dashboard";
import type { EvidenceFileItem } from "@/lib/evidence-types";
import { formatCurrency, truncateMiddle } from "@/lib/format/formatters";

export function ReceiptDetailScreen({
  receipt,
  onExport,
  onDownloadFile,
}: {
  receipt: ReceiptFixture;
  onExport?: () => void;
  onDownloadFile?: (
    file: Extract<EvidenceFileItem, object>,
  ) => Promise<void> | void;
}) {
  const approval = receipt.evidence?.approvals?.[0] as
    | ApprovalFixture
    | undefined;
  const auditTrail = receipt.evidence?.auditEvents ?? [];
  const receiptTimeline = receipt.evidence?.timeline ?? [];
  const screenshots = receipt.evidence?.screenshots;
  const policyDecision =
    receipt.evidence?.policyDecision === "approval_required" ||
    receipt.evidence?.policyDecision === "allow" ||
    receipt.evidence?.policyDecision === "deny" ||
    receipt.evidence?.policyDecision === "record_only"
      ? receipt.evidence.policyDecision
      : "record_only";

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(receipt.hash);
      toast.success("Receipt hash copied.");
    } catch {
      toast.error("Could not copy the receipt hash.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust artifact"
        title={receipt.summary}
        description={`${receipt.agent} completed ${receipt.workflowRun} for ${receipt.vendor}.`}
        actions={
          <>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void copyHash()}
            >
              <Copy className="size-4" strokeWidth={1.8} />
              Copy hash
            </Button>
            <Button
              className="h-10"
              onClick={onExport}
              disabled={!onExport}
              title={
                !onExport
                  ? "Connect to the backend API to export this receipt."
                  : undefined
              }
            >
              <Download className="size-4" strokeWidth={1.8} />
              Export
            </Button>
          </>
        }
      />

      <section className="rounded-lg border border-border bg-background p-4 shadow-xs">
        <div className="grid gap-3 md:grid-cols-4">
          <ArtifactStat
            icon={Page}
            label="Receipt"
            value={<span className="font-mono text-xs">{receipt.id}</span>}
          />
          <ArtifactStat
            icon={CheckCircle}
            label="Final status"
            value={<StatusBadge status={receipt.status} />}
          />
          <ArtifactStat
            icon={ShieldCheck}
            label="Policy"
            value={<PolicyDecisionBadge decision={policyDecision} />}
          />
          <ArtifactStat
            icon={Lock}
            label="Integrity"
            value={<HashIntegrityIndicator hash={receipt.hash} />}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Receipt timeline" icon={Page}>
            {receiptTimeline.length > 0 ? (
              <ReceiptTimeline phases={receiptTimeline} />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                No receipt timeline is available for this run yet.
              </div>
            )}
          </Panel>

          <Panel title="Evidence packet" icon={DatabaseMonitor}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <ScreenshotViewer
                screenshots={screenshots?.length ? screenshots : undefined}
              />
              <FileList files={receipt.files} onDownload={onDownloadFile} />
            </div>
          </Panel>

          <Panel title="Audit hash chain" icon={TaskList}>
            {auditTrail.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {auditTrail.map((event) => (
                  <article
                    key={event.id}
                    className="grid gap-3 p-4 md:grid-cols-[7rem_minmax(0,1fr)_auto]"
                  >
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {event.timestamp}
                    </span>
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="rounded-md font-mono text-[11px]"
                      >
                        {event.eventType}
                      </Badge>
                      <p className="mt-2 text-pretty text-sm leading-6">
                        {event.description}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {truncateMiddle(event.hash, 14)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                No audit events are attached to this receipt yet.
              </div>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Receipt summary" icon={ClipboardCheck}>
            <dl className="grid gap-3">
              <Meta label="Run" value={receipt.workflowRun} mono />
              <Meta label="Agent" value={receipt.agent} />
              <Meta label="Vendor" value={receipt.vendor} />
              <Meta label="Created" value={receipt.createdAt} />
            </dl>
          </Panel>

          <Panel title="Approval record" icon={ShieldCheck}>
            <div className="space-y-4">
              {approval ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={approval.status} />
                    <RiskLevelBadge risk={approval.risk} />
                  </div>
                  <p className="text-pretty text-sm leading-6 text-muted-foreground">
                    {approval.policyTrigger}
                  </p>
                  <dl className="grid gap-3">
                    <Meta label="Action" value={approval.action} />
                    <Meta
                      label="Amount"
                      value={formatCurrency(approval.amount)}
                    />
                  </dl>
                </>
              ) : (
                <>
                  <PolicyDecisionBadge decision={policyDecision} />
                  <p className="text-pretty text-sm leading-6 text-muted-foreground">
                    No human approval was required. The read-only action was
                    recorded by policy.
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Credential use" icon={Key}>
            <div className="rounded-md border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.8}
                />
                Vault capsule used
              </div>
              <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
                The agent used a scoped grant for this vendor. Plaintext
                credential values and encrypted payloads are absent from the
                receipt.
              </p>
            </div>
          </Panel>

          <Panel title="Final artifact" icon={Archive}>
            <div className="space-y-4">
              <HashIntegrityIndicator hash={receipt.hash} />
              <p className="text-pretty text-sm leading-6 text-muted-foreground">
                The receipt binds timeline, files, policy result, credential-use
                marker, and audit events into one exportable packet.
              </p>
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
  icon: typeof Page;
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

function ArtifactStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Page;
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
