import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReceiptRedactionService } from './receipt-redaction.service.js';

export type ReceiptTimelineSource = {
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

export type ReceiptTimelineEntry = {
  type: string;
  id: string;
  at: string;
  [key: string]: unknown;
};

@Injectable()
export class ReceiptTimelineBuilder {
  constructor(@Inject(ReceiptRedactionService) private readonly redaction: ReceiptRedactionService) {}

  build(source: ReceiptTimelineSource): ReceiptTimelineEntry[] {
    const entries: ReceiptTimelineEntry[] = [
      ...source.auditEvents.map((event) => ({
        type: 'audit_event',
        id: event.id,
        at: event.createdAt.toISOString(),
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        data: this.redaction.redact(event.eventDataJson)
      })),
      ...source.actionAttempts.map((attempt) => ({
        type: 'action_attempt',
        id: attempt.id,
        at: attempt.createdAt.toISOString(),
        actionType: attempt.actionType,
        riskLevel: attempt.riskLevel,
        policyDecision: attempt.policyDecision,
        policyReason: attempt.policyReason,
        inputSummary: attempt.inputSummary,
        outputSummary: attempt.outputSummary,
        amountCents: attempt.amountCents,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        metadataJson: this.redaction.redact(attempt.metadataJson)
      })),
      ...source.files.map((file) => ({
        type: 'file',
        id: file.id,
        at: file.createdAt.toISOString(),
        kind: file.kind,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256
      })),
      ...source.approvalRequests.map((approval) => ({
        type: 'approval_request',
        id: approval.id,
        at: approval.createdAt.toISOString(),
        status: approval.status,
        summary: approval.summary,
        riskLevel: approval.riskLevel,
        amountCents: approval.amountCents,
        approvedAt: approval.approvedAt?.toISOString() ?? null,
        rejectedAt: approval.rejectedAt?.toISOString() ?? null
      }))
    ];

    return entries.sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
  }
}
