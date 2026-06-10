"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  MessageText,
  PageSearch,
  ShieldAlert,
  WarningTriangle,
  XmarkCircle,
} from "iconoir-react";

import { PageHeader } from "@/components/app-shell/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import { Timeline, type TimelineItem } from "@/components/data/timeline";
import { PolicyDecisionBadge } from "@/components/display/policy-decision-badge";
import { RiskLevelBadge } from "@/components/display/risk-level-badge";
import { StatusBadge } from "@/components/display/status-badge";
import { ScreenshotViewer } from "@/components/evidence/screenshot-viewer";
import { formatCurrency } from "@/lib/format/formatters";
import type { ApprovalFixture } from "@/lib/fixtures/dashboard";
import { cn } from "@/lib/utils";

type ApprovalDetailScreenProps = {
  approval: ApprovalFixture;
  onApprove?: (comment: string) => Promise<void>;
  onReject?: (comment: string) => Promise<void>;
  apiEnabled?: boolean;
};

export function ApprovalDetailScreen({
  approval,
  onApprove,
  onReject,
  apiEnabled = false,
}: ApprovalDetailScreenProps) {
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [commentError, setCommentError] = useState("");

  const commentLength = comment.trim().length;
  const decisionCopy = useMemo(() => {
    if (decision === "approved") {
      return apiEnabled
        ? "Approved. The decision is recorded and the run can continue."
        : "Approved in demo mode. Connect the API to persist this decision.";
    }

    if (decision === "rejected") {
      return apiEnabled
        ? "Rejected. The decision is recorded and the run is denied."
        : "Rejected in demo mode. Connect the API to persist this decision.";
    }

    return "";
  }, [apiEnabled, decision]);
  const canDecide = apiEnabled && approval.status === "pending";

  async function handleReject() {
    if (commentLength < 8) {
      setCommentError("Add a rejection comment with at least 8 characters.");
      return;
    }

    try {
      await onReject?.(comment.trim());
      setDecision("rejected");
      setCommentError("");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Could not reject this request.",
      );
    }
  }

  async function handleApprove() {
    try {
      await onApprove?.(comment.trim());
      setDecision("approved");
      setCommentError("");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Could not approve this request.",
      );
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        eyebrow="Approval decision"
        title={approval.action}
        description={approval.policyTrigger}
        actions={
          <div className="hidden gap-2 md:flex">
            <RejectDialog
              onConfirm={handleReject}
              disabled={!canDecide || commentLength < 8}
            />
            <ApproveDialog
              onConfirm={handleApprove}
              disabled={!canDecide}
              apiEnabled={apiEnabled}
            />
          </div>
        }
      />

      {decisionCopy ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            decision === "approved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {decisionCopy}
        </div>
      ) : null}

      <section className="grid min-w-0 gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <DecisionPanel
          approval={approval}
          comment={comment}
          setComment={(value) => {
            setComment(value);
            if (commentError) {
              setCommentError("");
            }
          }}
          commentError={commentError}
          apiEnabled={apiEnabled}
        />

        <div className="min-w-0 space-y-4">
          <EvidencePanel />
          <MatchedRulesPanel approval={approval} />
          <TimelinePanel approval={approval} />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-12px_40px_rgba(10,10,10,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <RejectDialog
            onConfirm={handleReject}
            disabled={!canDecide || commentLength < 8}
          />
          <ApproveDialog
            onConfirm={handleApprove}
            disabled={!canDecide}
            apiEnabled={apiEnabled}
          />
        </div>
      </div>
    </div>
  );
}

function DecisionPanel({
  approval,
  comment,
  setComment,
  commentError,
  apiEnabled,
}: {
  approval: ApprovalFixture;
  comment: string;
  setComment: (value: string) => void;
  commentError: string;
  apiEnabled: boolean;
}) {
  return (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={approval.status} />
          <RiskLevelBadge risk={approval.risk} />
        </div>

        <div className="mt-6 grid gap-3">
          <DecisionRow label="Agent" value={approval.agent} />
          <DecisionRow label="Vendor" value={approval.vendor} />
          <DecisionRow label="Amount" value={formatCurrency(approval.amount)} />
          <DecisionRow label="Requested" value={approval.requestedAt} />
          <DecisionRow label="Expires" value={approval.expiresAt} emphasis />
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <p className="text-pretty text-sm leading-6">
              {approval.policyTrigger}
            </p>
          </div>
        </div>
        {!apiEnabled ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800">
            Demo mode: decisions update locally until the API is available.
          </div>
        ) : null}
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">
              Decision comment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Required for rejection. Optional for approval.
            </p>
          </div>
          <MessageText
            className="size-5 text-muted-foreground"
            strokeWidth={1.8}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="decision-comment" className="sr-only">
            Decision comment
          </label>
          <Textarea
            id="decision-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-describedby={
              commentError ? "decision-comment-error" : "decision-comment-help"
            }
            aria-invalid={Boolean(commentError)}
            placeholder="Add finance context, rejection reason, or approval note."
            className="min-h-28 resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span id="decision-comment-help">
              Rejection requires at least 8 characters.
            </span>
            <span className="tabular-nums">{comment.trim().length}</span>
          </div>
          {commentError ? (
            <p
              id="decision-comment-error"
              className="mt-2 text-sm text-destructive"
              role="alert"
            >
              {commentError}
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

function EvidencePanel() {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">
            Screenshot evidence
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Captured before the agent attempted the guarded action.
          </p>
        </div>
        <PageSearch
          className="size-5 text-muted-foreground"
          strokeWidth={1.8}
        />
      </div>
      <ScreenshotViewer
        screenshots={[]}
      />
      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/25 p-3 text-sm text-muted-foreground">
        Screenshots and DOM evidence appear when the backend attaches them to
        this approval workflow run.
      </div>
    </section>
  );
}

function MatchedRulesPanel({ approval }: { approval: ApprovalFixture }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">
            Matched policy rules
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The policy engine paused this run for explicit approval.
          </p>
        </div>
        <PolicyDecisionBadge decision="approval_required" />
      </div>
      <div className="rounded-lg border border-border bg-muted/25 p-4">
        <p className="text-sm font-medium">Policy trigger</p>
        <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
          {approval.policyTrigger}
        </p>
        <span className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium">
          <CheckCircle className="size-3.5" strokeWidth={1.8} />
          Matched
        </span>
      </div>
    </section>
  );
}

function TimelinePanel({ approval }: { approval: ApprovalFixture }) {
  const approvalTimeline: TimelineItem[] = [
    {
      title: "Approval requested",
      description: approval.action,
      time: approval.requestedAt,
      status: "completed",
    },
    {
      title: "Risk evaluation",
      description: `Risk level: ${approval.risk}.`,
      time: approval.requestedAt,
      status: "completed",
    },
    {
      title:
        approval.status === "pending" ? "Decision pending" : "Decision recorded",
      description:
        approval.status === "pending"
          ? "The worker remains paused until this decision is recorded."
          : `Decision status: ${approval.status}.`,
      time: approval.expiresAt,
      status: approval.status === "pending" ? "waiting" : "completed",
    },
  ];

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Run context</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The worker is paused until this decision is recorded.
          </p>
        </div>
        <Clock className="size-5 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <Timeline items={approvalTimeline} />
    </section>
  );
}

function DecisionRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right text-sm font-medium",
          emphasis && "tabular-nums text-amber-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ApproveDialog({
  onConfirm,
  disabled,
  apiEnabled,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  apiEnabled: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="h-11 md:h-10" disabled={disabled}>
          <CheckCircle className="size-4" strokeWidth={1.8} />
          Approve
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve this high-risk action?</AlertDialogTitle>
          <AlertDialogDescription>
            {apiEnabled
              ? "AegisWeb will record your decision and continue the guarded vendor action."
              : "Demo mode: this action updates local UI state only."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This action changes the SaaS plan. The receipt will include your
          approval, matched rules, and browser evidence.
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Approve action
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectDialog({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-10" disabled={disabled}>
          <XmarkCircle className="size-4" strokeWidth={1.8} />
          Reject
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Rejection stops the worker and records the comment as part of the
            approval evidence.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <WarningTriangle
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.8}
            />
            <span>
              The agent will not submit the vendor action after rejection.
            </span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
