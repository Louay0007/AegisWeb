import { Inject, Injectable } from '@nestjs/common';
import {
  ApprovalRequest,
  ApprovalStatus,
  AuditActorType,
  AuditEventType,
  PolicyDecision,
  Prisma,
  RiskLevel,
  WorkflowRunStatus
} from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { ContextUser } from '../request-context/types.js';
import { WorkflowRunStateMachine } from '../workflow-runs/workflow-run-state-machine.js';
import { ApprovalExpirationService } from './approval-expiration.service.js';
import { ApprovalResumeService } from './approval-resume.service.js';
import { toApprovalRequestDto } from './approvals.types.js';

export type ApprovalListQuery = {
  status?: ApprovalStatus;
  workflowRunId?: string;
  limit: number;
  offset: number;
};

export type CreateApprovalRequestInput = {
  actionAttemptId: string;
  summary: string;
  riskLevel?: RiskLevel;
  amountCents?: number;
  screenshotFileId?: string;
  policyTriggeredJson?: Prisma.InputJsonObject;
  expiresAt?: string;
};

export type DecideApprovalInput = {
  comment?: string;
};

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowRunStateMachine) private readonly stateMachine: WorkflowRunStateMachine,
    @Inject(ApprovalExpirationService) private readonly expiration: ApprovalExpirationService,
    @Inject(ApprovalResumeService) private readonly resume: ApprovalResumeService,
    @Inject(NotificationService) private readonly notifications: NotificationService
  ) {}

  async list(organizationId: string | undefined, query: ApprovalListQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    await this.expiration.expireDue();

    const where: Prisma.ApprovalRequestWhereInput = {
      organizationId,
      status: query.status,
      workflowRunId: query.workflowRunId
    };
    const [approvals, total] = await Promise.all([
      this.database.client.approvalRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset
      }),
      this.database.client.approvalRequest.count({ where })
    ]);

    return {
      data: approvals.map(toApprovalRequestDto),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset
      }
    };
  }

  async get(organizationId: string | undefined, id: string) {
    const approval = await this.findApprovalInOrganization(organizationId, id);
    return { data: toApprovalRequestDto(approval) };
  }

  async createForRun(runId: string, input: CreateApprovalRequestInput) {
    const run = await this.database.client.workflowRun.findUnique({
      where: { id: runId }
    });

    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    const attempt = await this.database.client.actionAttempt.findFirst({
      where: {
        id: input.actionAttemptId,
        workflowRunId: run.id,
        organizationId: run.organizationId
      }
    });

    if (!attempt) {
      throw new DomainError(DomainErrorCode.NotFound, 'Action attempt was not found.');
    }

    if (attempt.policyDecision !== PolicyDecision.REQUIRE_APPROVAL) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Approval requests require an action attempt with require_approval decision.');
    }

    if (input.screenshotFileId) {
      await this.assertScreenshotInRun(run.organizationId, run.id, input.screenshotFileId);
    }

    if (run.status !== WorkflowRunStatus.WAITING_FOR_APPROVAL) {
      this.stateMachine.assertCanTransition(run.status, WorkflowRunStatus.WAITING_FOR_APPROVAL);
      await this.database.client.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.WAITING_FOR_APPROVAL,
          currentStep: 'waiting_for_approval',
          stateJson: this.nextRunState(run.stateJson, {
            from: run.status,
            to: WorkflowRunStatus.WAITING_FOR_APPROVAL,
            reason: 'Approval requested.',
            actionAttemptId: attempt.id
          })
        }
      });
    }

    const approval = await this.database.client.approvalRequest.create({
      data: {
        organizationId: run.organizationId,
        workflowRunId: run.id,
        actionAttemptId: attempt.id,
        status: ApprovalStatus.PENDING,
        requestedByAgentId: run.agentId,
        summary: input.summary,
        riskLevel: input.riskLevel ?? attempt.riskLevel,
        amountCents: input.amountCents ?? attempt.amountCents,
        screenshotFileId: input.screenshotFileId,
        policyTriggeredJson: input.policyTriggeredJson ?? {},
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
      }
    });

    const notification = await this.notifications.notifyApprovalRequested(approval);

    await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.WORKER,
      actorId: 'internal-worker',
      eventType: AuditEventType.APPROVAL_REQUESTED,
      eventDataJson: {
        approvalRequestId: approval.id,
        actionAttemptId: attempt.id,
        summary: approval.summary,
        notification
      }
    });

    await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.WORKER,
      actorId: 'internal-worker',
      eventType: AuditEventType.WORKFLOW_RUN_WAITING_FOR_APPROVAL,
      eventDataJson: {
        workflowRunId: run.id,
        approvalRequestId: approval.id,
        actionAttemptId: attempt.id
      }
    });

    return { data: toApprovalRequestDto(approval) };
  }

  async approve(currentUser: ContextUser | undefined, id: string, input: DecideApprovalInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const approval = await this.findApprovalInOrganization(currentUser.organizationId, id);
    await this.assertPendingOrExpire(approval);

    const run = await this.database.client.workflowRun.findFirstOrThrow({
      where: { id: approval.workflowRunId, organizationId: currentUser.organizationId }
    });
    this.stateMachine.assertCanTransition(run.status, WorkflowRunStatus.RUNNING);

    const updatedApproval = await this.database.client.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverUserId: currentUser.id,
        approvedAt: new Date(),
        comment: input.comment
      }
    });
    const resumeJob = await this.resume.enqueueResume(updatedApproval);

    await this.database.client.workflowRun.update({
      where: { id: run.id },
      data: {
        status: WorkflowRunStatus.RUNNING,
        currentStep: 'approval_approved',
        stateJson: this.nextRunState(run.stateJson, {
          from: run.status,
          to: WorkflowRunStatus.RUNNING,
          reason: 'Approval approved.',
          approvalRequestId: approval.id,
          resumeJobId: resumeJob.jobId
        })
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.APPROVAL_APPROVED,
      eventDataJson: {
        approvalRequestId: approval.id,
        workflowRunId: run.id,
        comment: input.comment ?? null,
        resumeJobId: resumeJob.jobId
      }
    });

    return { data: { approval: toApprovalRequestDto(updatedApproval), resumeJobId: resumeJob.jobId } };
  }

  async reject(currentUser: ContextUser | undefined, id: string, input: DecideApprovalInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const approval = await this.findApprovalInOrganization(currentUser.organizationId, id);
    await this.assertPendingOrExpire(approval);

    const run = await this.database.client.workflowRun.findFirstOrThrow({
      where: { id: approval.workflowRunId, organizationId: currentUser.organizationId }
    });
    this.stateMachine.assertCanTransition(run.status, WorkflowRunStatus.DENIED);

    const updatedApproval = await this.database.client.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: ApprovalStatus.REJECTED,
        approverUserId: currentUser.id,
        rejectedAt: new Date(),
        comment: input.comment
      }
    });

    await this.database.client.workflowRun.update({
      where: { id: run.id },
      data: {
        status: WorkflowRunStatus.DENIED,
        completedAt: run.completedAt ?? new Date(),
        currentStep: 'approval_rejected',
        errorMessage: input.comment ?? 'Approval rejected.',
        stateJson: this.nextRunState(run.stateJson, {
          from: run.status,
          to: WorkflowRunStatus.DENIED,
          reason: 'Approval rejected.',
          approvalRequestId: approval.id
        })
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.APPROVAL_REJECTED,
      eventDataJson: {
        approvalRequestId: approval.id,
        workflowRunId: run.id,
        comment: input.comment ?? null
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.WORKFLOW_RUN_DENIED,
      eventDataJson: {
        workflowRunId: run.id,
        approvalRequestId: approval.id,
        reason: input.comment ?? 'Approval rejected.'
      }
    });

    return { data: toApprovalRequestDto(updatedApproval) };
  }

  private async assertPendingOrExpire(approval: ApprovalRequest): Promise<void> {
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Approval request has already been decided.');
    }

    if (this.expiration.isExpired(approval)) {
      await this.expiration.expireApproval(approval);
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Expired approvals cannot be decided.');
    }
  }

  private async findApprovalInOrganization(organizationId: string | undefined, id: string): Promise<ApprovalRequest> {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const approval = await this.database.client.approvalRequest.findFirst({
      where: { id, organizationId }
    });

    if (!approval) {
      throw new DomainError(DomainErrorCode.NotFound, 'Approval request was not found.');
    }

    return approval;
  }

  private async assertScreenshotInRun(organizationId: string, workflowRunId: string, screenshotFileId: string): Promise<void> {
    const file = await this.database.client.file.findFirst({
      where: {
        id: screenshotFileId,
        organizationId,
        workflowRunId
      },
      select: { id: true }
    });

    if (!file) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Approval screenshot belongs to another workflow run.');
    }
  }

  private nextRunState(existing: Prisma.JsonValue, transition: Prisma.InputJsonObject): Prisma.InputJsonObject {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Prisma.JsonObject)
        : {};
    const transitions = Array.isArray(base.transitions) ? base.transitions : [];

    return {
      ...base,
      transitionReason: transition.reason,
      transitions: [
        ...transitions,
        {
          ...transition,
          at: new Date().toISOString()
        }
      ]
    };
  }
}
