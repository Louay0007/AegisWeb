import type { ReceiptTimelinePhase } from "@/components/evidence/receipt-timeline";
import type { ScreenshotEvidence } from "@/components/evidence/screenshot-viewer";

export type EvidenceFile = {
  id: string;
  label: string;
  kind?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  createdAt?: string;
  downloadHref?: string;
};

export type EvidenceFileItem = string | EvidenceFile;

export type WorkflowRunEvidence = {
  timeline?: ReceiptTimelinePhase[];
  screenshots?: ScreenshotEvidence[];
  auditEvents?: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    actor: string;
    description: string;
    workflowRun: string;
    hash: string;
    payload: Record<string, unknown>;
  }>;
  approvals?: Array<{
    id: string;
    status: string;
    action: string;
    agent: string;
    vendor: string;
    risk: string;
    amount: number;
    requestedAt: string;
    expiresAt: string;
    policyTrigger: string;
  }>;
  receipt?: {
    id: string;
    status: string;
    summary: string;
    createdAt: string;
  } | null;
};

export type ReceiptEvidence = {
  timeline?: ReceiptTimelinePhase[];
  screenshots?: ScreenshotEvidence[];
  auditEvents?: WorkflowRunEvidence["auditEvents"];
  approvals?: WorkflowRunEvidence["approvals"];
  policyDecision?: string;
};
