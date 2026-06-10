import { Prisma, Receipt, ReceiptStatus } from '@prisma/client';
import { ReceiptTimelineEntry } from './receipt-timeline.builder.js';

export type ReceiptListQuery = {
  workflowRunId?: string;
  finalStatus?: ReceiptStatus;
  limit: number;
  offset: number;
};

export type ReceiptListDto = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  agentId: string;
  finalStatus: string;
  summary: string;
  workflowRun: {
    id: string;
    status: string;
    currentStep: string | null;
    errorMessage: string | null;
    vendor?: { id: string; name: string; website: string } | null;
  };
  agent: {
    id: string;
    name: string;
    identifier: string;
  };
  createdAt: string;
};

export type ReceiptDetailDto = ReceiptListDto & {
  workflow: {
    id: string;
    name: string;
    template: string;
  };
  vendor: {
    id: string;
    name: string;
    website: string;
  } | null;
  timeline: ReceiptTimelineEntry[];
  screenshots: Prisma.JsonValue;
  files: Prisma.JsonValue;
  policyDecisions: Prisma.JsonValue;
  approvalDetails: Prisma.JsonValue;
};

export type ReceiptRecord = Receipt & {
  workflowRun: {
    id: string;
    status: string;
    currentStep: string | null;
    errorMessage: string | null;
    resultSummary: string | null;
    workflow: { id: string; name: string; template: string };
    vendor: { id: string; name: string; website: string } | null;
    auditEvents: Array<{
      id: string;
      eventType: string;
      actorType: string;
      actorId: string | null;
      eventDataJson: Prisma.JsonValue;
      createdAt: Date;
    }>;
    actionAttempts: Array<{
      id: string;
      actionType: string;
      riskLevel: string;
      policyDecision: string;
      policyReason: string | null;
      inputSummary: string | null;
      outputSummary: string | null;
      amountCents: number | null;
      metadataJson: Prisma.JsonValue;
      createdAt: Date;
      completedAt: Date | null;
    }>;
    files: Array<{
      id: string;
      kind: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      createdAt: Date;
    }>;
    approvalRequests: Array<{
      id: string;
      status: string;
      summary: string;
      riskLevel: string;
      amountCents: number | null;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      createdAt: Date;
    }>;
  };
  agent: {
    id: string;
    name: string;
    identifier: string;
  };
};

export type ReceiptListRecord = Receipt & {
  workflowRun: {
    id: string;
    status: string;
    currentStep: string | null;
    errorMessage: string | null;
    vendor?: { id: string; name: string; website: string } | null;
  };
  agent: {
    id: string;
    name: string;
    identifier: string;
  };
};

export function toReceiptListDto(receipt: ReceiptListRecord, summary = receipt.summary): ReceiptListDto {
  return {
    id: receipt.id,
    organizationId: receipt.organizationId,
    workflowRunId: receipt.workflowRunId,
    agentId: receipt.agentId,
    finalStatus: enumToDomain(receipt.finalStatus),
    summary,
    workflowRun: {
      id: receipt.workflowRun.id,
      status: enumToDomain(receipt.workflowRun.status),
      currentStep: receipt.workflowRun.currentStep,
      errorMessage: receipt.workflowRun.errorMessage,
      vendor: receipt.workflowRun.vendor
    },
    agent: receipt.agent,
    createdAt: receipt.createdAt.toISOString()
  };
}

export function enumToDomain(value: string): string {
  return value.toLowerCase();
}
