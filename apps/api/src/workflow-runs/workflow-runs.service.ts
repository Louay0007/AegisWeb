import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma, WorkflowRunStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { ContextUser } from '../request-context/types.js';
import { toWorkflowRunDto } from '../workflows/workflows.types.js';
import { DatabaseService } from '../database/database.service.js';
import { WorkflowQueueService } from '../queue/workflow-queue.service.js';
import { WorkflowRunQueryService } from './workflow-run-query.service.js';
import { WorkflowRunStateMachine } from './workflow-run-state-machine.js';

export type CancelWorkflowRunInput = {
  reason: string;
};

@Injectable()
export class WorkflowRunsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowRunQueryService) private readonly query: WorkflowRunQueryService,
    @Inject(WorkflowRunStateMachine) private readonly stateMachine: WorkflowRunStateMachine,
    @Inject(WorkflowQueueService) private readonly queue: WorkflowQueueService
  ) {}

  async cancel(currentUser: ContextUser | undefined, id: string, input: CancelWorkflowRunInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.query.findRunInOrganization(currentUser.organizationId, id);
    this.stateMachine.assertCanTransition(existing.status, WorkflowRunStatus.CANCELED);

    const removedQueuedJob = existing.status === WorkflowRunStatus.QUEUED ? await this.queue.removeStartJob(id) : false;
    const cancelJob =
      existing.status === WorkflowRunStatus.RUNNING || existing.status === WorkflowRunStatus.WAITING_FOR_APPROVAL
        ? await this.queue.enqueueCancel({
            workflowRunId: id,
            organizationId: currentUser.organizationId,
            reason: input.reason
          })
        : null;

    const run = await this.database.client.workflowRun.update({
      where: { id: existing.id },
      data: {
        status: WorkflowRunStatus.CANCELED,
        completedAt: existing.completedAt ?? new Date(),
        errorMessage: input.reason,
        stateJson: this.nextState(existing.stateJson, {
          from: existing.status,
          to: WorkflowRunStatus.CANCELED,
          reason: input.reason,
          requestedByUserId: currentUser.id,
          removedQueuedJob,
          cancelJobId: cancelJob?.jobId ?? null
        })
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.WORKFLOW_RUN_CANCELED,
      eventDataJson: {
        workflowRunId: run.id,
        workflowId: run.workflowId,
        reason: input.reason,
        previousStatus: existing.status,
        removedQueuedJob,
        cancelJobId: cancelJob?.jobId ?? null
      }
    });

    return { data: toWorkflowRunDto(run) };
  }

  private nextState(existing: Prisma.JsonValue, transition: Prisma.InputJsonObject): Prisma.InputJsonObject {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Prisma.JsonObject)
        : {};
    const transitions = Array.isArray(base.transitions) ? base.transitions : [];

    return {
      ...base,
      transitionReason: transition.reason,
      canceledAt: new Date().toISOString(),
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
