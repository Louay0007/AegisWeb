import { Inject, Injectable } from '@nestjs/common';
import {
  AuditEventType,
  Prisma,
  ReceiptStatus,
  WorkflowRunStatus
} from '@prisma/client';
import { WorkerDatabaseService } from '../database/worker-database.service.js';
import { WorkerAuditService } from '../audit/worker-audit.service.js';

export type CreateWorkerReceiptInput = {
  workflowRunId: string;
  finalStatus: ReceiptStatus;
  summary: string;
  resultJson?: Prisma.InputJsonObject;
};

@Injectable()
export class WorkerReceiptService {
  constructor(
    @Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService,
    @Inject(WorkerAuditService) private readonly audit: WorkerAuditService
  ) {}

  async createForRun(input: CreateWorkerReceiptInput): Promise<{ id: string }> {
    const run = await this.database.client.workflowRun.findUniqueOrThrow({
      where: { id: input.workflowRunId },
      include: {
        auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        actionAttempts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        files: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        approvalRequests: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }
      }
    });

    const receipt = await this.database.client.receipt.upsert({
      where: { workflowRunId: run.id },
      create: {
        organizationId: run.organizationId,
        workflowRunId: run.id,
        agentId: run.agentId,
        finalStatus: input.finalStatus,
        summary: input.summary,
        timelineJson: buildTimeline(run),
        screenshotsJson: buildFiles(run.files, 'SCREENSHOT'),
        filesJson: buildFiles(run.files),
        policyDecisionsJson: buildPolicyDecisions(run.actionAttempts),
        approvalDetailsJson: {
          resultJson: input.resultJson ?? null,
          approvals: run.approvalRequests.map((approval) => ({
            id: approval.id,
            status: approval.status,
            summary: approval.summary,
            amountCents: approval.amountCents
          }))
        }
      },
      update: {
        finalStatus: input.finalStatus,
        summary: input.summary,
        timelineJson: buildTimeline(run),
        screenshotsJson: buildFiles(run.files, 'SCREENSHOT'),
        filesJson: buildFiles(run.files),
        policyDecisionsJson: buildPolicyDecisions(run.actionAttempts),
        approvalDetailsJson: {
          resultJson: input.resultJson ?? null,
          approvals: run.approvalRequests.map((approval) => ({
            id: approval.id,
            status: approval.status,
            summary: approval.summary,
            amountCents: approval.amountCents
          }))
        }
      },
      select: { id: true }
    });

    await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      eventType: AuditEventType.RECEIPT_CREATED,
      eventDataJson: {
        receiptId: receipt.id,
        finalStatus: input.finalStatus,
        workflowRunStatus: run.status
      }
    });

    return receipt;
  }
}

function buildTimeline(
  run: Prisma.WorkflowRunGetPayload<{
    include: {
      auditEvents: true;
      actionAttempts: true;
      files: true;
      approvalRequests: true;
    };
  }>
): Prisma.InputJsonArray {
  const events = run.auditEvents.map((event) => ({
    type: 'audit_event',
    id: event.id,
    eventType: event.eventType,
    at: event.createdAt.toISOString(),
    data: event.eventDataJson
  }));
  const attempts = run.actionAttempts.map((attempt) => ({
    type: 'action_attempt',
    id: attempt.id,
    actionType: attempt.actionType,
    policyDecision: attempt.policyDecision,
    riskLevel: attempt.riskLevel,
    at: attempt.createdAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null
  }));
  const files = run.files.map((file) => ({
    type: 'file',
    id: file.id,
    kind: file.kind,
    sha256: file.sha256,
    at: file.createdAt.toISOString()
  }));

  return [...events, ...attempts, ...files].sort((left, right) =>
    String(left.at).localeCompare(String(right.at))
  ) as Prisma.InputJsonArray;
}

function buildFiles(
  files: Prisma.WorkflowRunGetPayload<{ include: { files: true } }>['files'],
  kind?: string
): Prisma.InputJsonArray {
  return files
    .filter((file) => !kind || file.kind === kind)
    .map((file) => ({
      id: file.id,
      kind: file.kind,
      bucket: file.bucket,
      objectKey: file.objectKey,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      createdAt: file.createdAt.toISOString()
    })) as Prisma.InputJsonArray;
}

function buildPolicyDecisions(
  attempts: Prisma.WorkflowRunGetPayload<{ include: { actionAttempts: true } }>['actionAttempts']
): Prisma.InputJsonArray {
  return attempts.map((attempt) => ({
    actionAttemptId: attempt.id,
    actionType: attempt.actionType,
    policyDecision: attempt.policyDecision,
    riskLevel: attempt.riskLevel,
    policyReason: attempt.policyReason
  })) as Prisma.InputJsonArray;
}

export function receiptStatusForRunStatus(status: WorkflowRunStatus): ReceiptStatus {
  switch (status) {
    case WorkflowRunStatus.COMPLETED:
      return ReceiptStatus.COMPLETED;
    case WorkflowRunStatus.DENIED:
      return ReceiptStatus.DENIED;
    case WorkflowRunStatus.CANCELED:
      return ReceiptStatus.CANCELED;
    case WorkflowRunStatus.FAILED:
    case WorkflowRunStatus.QUEUED:
    case WorkflowRunStatus.RUNNING:
    case WorkflowRunStatus.WAITING_FOR_APPROVAL:
      return ReceiptStatus.FAILED;
  }
}
