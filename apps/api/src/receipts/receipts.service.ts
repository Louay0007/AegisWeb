import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { ReceiptRedactionService } from './receipt-redaction.service.js';
import { ReceiptSummaryBuilder } from './receipt-summary.builder.js';
import { ReceiptTimelineBuilder } from './receipt-timeline.builder.js';
import {
  ReceiptDetailDto,
  ReceiptListQuery,
  ReceiptRecord,
  enumToDomain,
  toReceiptListDto
} from './receipts.types.js';

@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ReceiptTimelineBuilder) private readonly timelineBuilder: ReceiptTimelineBuilder,
    @Inject(ReceiptSummaryBuilder) private readonly summaryBuilder: ReceiptSummaryBuilder,
    @Inject(ReceiptRedactionService) private readonly redaction: ReceiptRedactionService
  ) {}

  async list(organizationId: string | undefined, query: ReceiptListQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where: Prisma.ReceiptWhereInput = {
      organizationId,
      workflowRunId: query.workflowRunId,
      finalStatus: query.finalStatus
    };
    const [receipts, total] = await Promise.all([
      this.database.client.receipt.findMany({
        where,
        include: {
          workflowRun: {
            select: {
              id: true,
              status: true,
              currentStep: true,
              errorMessage: true,
              vendor: { select: { id: true, name: true, website: true } }
            }
          },
          agent: { select: { id: true, name: true, identifier: true } }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset
      }),
      this.database.client.receipt.count({ where })
    ]);

    return {
      data: receipts.map((receipt) => toReceiptListDto(receipt)),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset
      }
    };
  }

  async get(organizationId: string | undefined, id: string) {
    const receipt = await this.findReceipt(organizationId, id);
    return { data: this.toDetailDto(receipt) };
  }

  async getDetail(organizationId: string | undefined, id: string): Promise<ReceiptDetailDto> {
    return this.toDetailDto(await this.findReceipt(organizationId, id));
  }

  private async findReceipt(organizationId: string | undefined, id: string): Promise<ReceiptRecord> {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const receipt = await this.database.client.receipt.findFirst({
      where: { id, organizationId },
      include: {
        workflowRun: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            errorMessage: true,
            resultSummary: true,
            workflow: { select: { id: true, name: true, template: true } },
            vendor: { select: { id: true, name: true, website: true } },
            auditEvents: {
              select: {
                id: true,
                eventType: true,
                actorType: true,
                actorId: true,
                eventDataJson: true,
                createdAt: true
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
            },
            actionAttempts: {
              select: {
                id: true,
                actionType: true,
                riskLevel: true,
                policyDecision: true,
                policyReason: true,
                inputSummary: true,
                outputSummary: true,
                amountCents: true,
                metadataJson: true,
                createdAt: true,
                completedAt: true
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
            },
            files: {
              select: {
                id: true,
                kind: true,
                mimeType: true,
                sizeBytes: true,
                sha256: true,
                createdAt: true
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
            },
            approvalRequests: {
              select: {
                id: true,
                status: true,
                summary: true,
                riskLevel: true,
                amountCents: true,
                approvedAt: true,
                rejectedAt: true,
                createdAt: true
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
            }
          }
        },
        agent: { select: { id: true, name: true, identifier: true } }
      }
    });

    if (!receipt) {
      throw new DomainError(DomainErrorCode.NotFound, 'Receipt was not found.');
    }

    return receipt as ReceiptRecord;
  }

  private toDetailDto(receipt: ReceiptRecord): ReceiptDetailDto {
    const summary = this.summaryBuilder.build({
      storedSummary: receipt.summary,
      run: {
        status: receipt.workflowRun.status,
        errorMessage: receipt.workflowRun.errorMessage,
        resultSummary: receipt.workflowRun.resultSummary
      }
    });

    return {
      ...toReceiptListDto(receipt, summary),
      workflow: {
        id: receipt.workflowRun.workflow.id,
        name: receipt.workflowRun.workflow.name,
        template: enumToDomain(receipt.workflowRun.workflow.template)
      },
      vendor: receipt.workflowRun.vendor,
      timeline: this.timelineBuilder.build(receipt.workflowRun),
      screenshots: this.redaction.redact(receipt.screenshotsJson),
      files: this.redaction.redact(receipt.filesJson),
      policyDecisions: this.redaction.redact(receipt.policyDecisionsJson),
      approvalDetails: this.redaction.redact(receipt.approvalDetailsJson)
    };
  }
}
