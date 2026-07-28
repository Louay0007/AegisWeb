import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ApprovalRequest, ApprovalStatus, AuditActorType, AuditEventType, WorkflowRunStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { WorkflowRunStateMachine } from '../workflow-runs/workflow-run-state-machine.js';

const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH_SIZE = 100;

@Injectable()
export class ApprovalExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApprovalExpirationService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowRunStateMachine) private readonly stateMachine: WorkflowRunStateMachine
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweepExpiredApprovals().catch((error) => {
        this.logger.error(
          `Approval expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isExpired(approval: ApprovalRequest, now = new Date()): boolean {
    return approval.status === ApprovalStatus.PENDING && Boolean(approval.expiresAt && approval.expiresAt <= now);
  }

  async expireDue(now = new Date()): Promise<number> {
    const due = await this.database.client.approvalRequest.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: { lte: now }
      },
      take: SWEEP_BATCH_SIZE,
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }]
    });

    let expiredCount = 0;
    for (const approval of due) {
      await this.expireApproval(approval);
      expiredCount += 1;
    }
    return expiredCount;
  }

  async expireApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    if (approval.status !== ApprovalStatus.PENDING) {
      return approval;
    }

    const expired = await this.database.client.approvalRequest.update({
      where: { id: approval.id },
      data: { status: ApprovalStatus.EXPIRED }
    });

    const run = await this.database.client.workflowRun.findFirst({
      where: { id: expired.workflowRunId, organizationId: expired.organizationId }
    });

    if (run && run.status === WorkflowRunStatus.WAITING_FOR_APPROVAL) {
      this.stateMachine.assertCanTransition(run.status, WorkflowRunStatus.DENIED);
      await this.database.client.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.DENIED,
          completedAt: run.completedAt ?? new Date(),
          currentStep: 'approval_expired',
          errorMessage: 'Approval request expired before a decision was made.'
        }
      });
    }

    await this.audit.record({
      organizationId: expired.organizationId,
      workflowRunId: expired.workflowRunId,
      agentId: expired.requestedByAgentId,
      actorType: AuditActorType.SYSTEM,
      eventType: AuditEventType.APPROVAL_EXPIRED,
      eventDataJson: {
        approvalRequestId: expired.id,
        expiresAt: expired.expiresAt?.toISOString() ?? null
      }
    });

    return expired;
  }

  private async sweepExpiredApprovals(): Promise<void> {
    if (this.sweeping) {
      return;
    }
    this.sweeping = true;
    try {
      const expiredCount = await this.expireDue();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} overdue approval request(s).`);
      }
    } finally {
      this.sweeping = false;
    }
  }
}
