import { ApprovalRequest, Prisma } from '@prisma/client';

export type ApprovalRequestDto = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  actionAttemptId: string;
  status: string;
  requestedByAgentId: string;
  approverUserId: string | null;
  summary: string;
  riskLevel: string;
  amountCents: number | null;
  screenshotFileId: string | null;
  policyTriggeredJson: Prisma.JsonValue;
  expiresAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toApprovalRequestDto(approval: ApprovalRequest): ApprovalRequestDto {
  return {
    id: approval.id,
    organizationId: approval.organizationId,
    workflowRunId: approval.workflowRunId,
    actionAttemptId: approval.actionAttemptId,
    status: enumToDomain(approval.status),
    requestedByAgentId: approval.requestedByAgentId,
    approverUserId: approval.approverUserId,
    summary: approval.summary,
    riskLevel: enumToDomain(approval.riskLevel),
    amountCents: approval.amountCents,
    screenshotFileId: approval.screenshotFileId,
    policyTriggeredJson: approval.policyTriggeredJson,
    expiresAt: approval.expiresAt?.toISOString() ?? null,
    approvedAt: approval.approvedAt?.toISOString() ?? null,
    rejectedAt: approval.rejectedAt?.toISOString() ?? null,
    comment: approval.comment,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString()
  };
}

function enumToDomain(value: string): string {
  return value.toLowerCase();
}
