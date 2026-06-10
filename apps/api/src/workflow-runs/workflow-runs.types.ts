import {
  ActionType,
  ApprovalStatus,
  FileKind,
  PolicyDecision,
  Prisma,
  ReceiptStatus,
  RiskLevel,
  WorkflowRun,
  WorkflowTemplate
} from '@prisma/client';
import { toWorkflowRunDto } from '../workflows/workflows.types.js';
import { fromPrismaWorkflowTemplate } from '../workflows/workflow-type-mapping.js';

export type WorkflowRunSummaryDto = ReturnType<typeof toWorkflowRunDto> & {
  workflow: { id: string; name: string; template: string };
  agent: { id: string; name: string; identifier: string };
  vendor: { id: string; name: string; website: string } | null;
};

export type WorkflowRunDetailDto = WorkflowRunSummaryDto & {
  actionAttempts: Array<{
    id: string;
    website: string;
    actionType: string;
    riskLevel: string;
    policyDecision: string;
    policyReason: string | null;
    inputSummary: string | null;
    outputSummary: string | null;
    amountCents: number | null;
    metadataJson: Prisma.JsonValue;
    createdAt: string;
    completedAt: string | null;
  }>;
  files: Array<{
    id: string;
    kind: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    createdAt: string;
  }>;
  approvalRequests: Array<{
    id: string;
    status: string;
    summary: string;
    riskLevel: string;
    amountCents: number | null;
    expiresAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    createdAt: string;
  }>;
  receipt: {
    id: string;
    finalStatus: string;
    summary: string;
    createdAt: string;
  } | null;
};

type WorkflowRunSummaryRecord = WorkflowRun & {
  workflow: { id: string; name: string; template: WorkflowTemplate };
  agent: { id: string; name: string; identifier: string };
  vendor: { id: string; name: string; website: string } | null;
};

type WorkflowRunDetailRecord = WorkflowRunSummaryRecord & {
  actionAttempts: Array<{
    id: string;
    website: string;
    actionType: ActionType;
    riskLevel: RiskLevel;
    policyDecision: PolicyDecision;
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
    kind: FileKind;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    createdAt: Date;
  }>;
  approvalRequests: Array<{
    id: string;
    status: ApprovalStatus;
    summary: string;
    riskLevel: RiskLevel;
    amountCents: number | null;
    expiresAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    createdAt: Date;
  }>;
  receipt: {
    id: string;
    finalStatus: ReceiptStatus;
    summary: string;
    createdAt: Date;
  } | null;
};

export function toWorkflowRunSummaryDto(run: WorkflowRunSummaryRecord): WorkflowRunSummaryDto {
  return {
    ...toWorkflowRunDto(run),
    workflow: {
      id: run.workflow.id,
      name: run.workflow.name,
      template: fromPrismaWorkflowTemplate(run.workflow.template)
    },
    agent: run.agent,
    vendor: run.vendor
  };
}

export function toWorkflowRunDetailDto(run: WorkflowRunDetailRecord): WorkflowRunDetailDto {
  return {
    ...toWorkflowRunSummaryDto(run),
    actionAttempts: run.actionAttempts.map((attempt) => ({
      id: attempt.id,
      website: attempt.website,
      actionType: enumToDomain(attempt.actionType),
      riskLevel: enumToDomain(attempt.riskLevel),
      policyDecision: enumToDomain(attempt.policyDecision),
      policyReason: attempt.policyReason,
      inputSummary: attempt.inputSummary,
      outputSummary: attempt.outputSummary,
      amountCents: attempt.amountCents,
      metadataJson: attempt.metadataJson,
      createdAt: attempt.createdAt.toISOString(),
      completedAt: attempt.completedAt?.toISOString() ?? null
    })),
    files: run.files.map((file) => ({
      id: file.id,
      kind: enumToDomain(file.kind),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      createdAt: file.createdAt.toISOString()
    })),
    approvalRequests: run.approvalRequests.map((approval) => ({
      id: approval.id,
      status: enumToDomain(approval.status),
      summary: approval.summary,
      riskLevel: enumToDomain(approval.riskLevel),
      amountCents: approval.amountCents,
      expiresAt: approval.expiresAt?.toISOString() ?? null,
      approvedAt: approval.approvedAt?.toISOString() ?? null,
      rejectedAt: approval.rejectedAt?.toISOString() ?? null,
      createdAt: approval.createdAt.toISOString()
    })),
    receipt: run.receipt
      ? {
          id: run.receipt.id,
          finalStatus: enumToDomain(run.receipt.finalStatus),
          summary: run.receipt.summary,
          createdAt: run.receipt.createdAt.toISOString()
        }
      : null
  };
}

function enumToDomain(value: string): string {
  return value.toLowerCase();
}
