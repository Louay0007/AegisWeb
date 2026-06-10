import { Injectable } from '@nestjs/common';
import { WorkflowRunStatus } from '@prisma/client';
import { DomainError, DomainErrorCode, WorkflowRunStatus as DomainWorkflowRunStatus, canTransitionWorkflowRun } from '@agentpass/domain';
import { fromPrismaWorkflowRunStatus } from '../workflows/workflow-type-mapping.js';

@Injectable()
export class WorkflowRunStateMachine {
  assertCanTransition(from: WorkflowRunStatus, to: WorkflowRunStatus): void {
    const fromDomain = fromPrismaWorkflowRunStatus(from);
    const toDomain = fromPrismaWorkflowRunStatus(to);

    if (!canTransitionWorkflowRun(fromDomain, toDomain)) {
      throw new DomainError(
        DomainErrorCode.WorkflowInvalidTransition,
        `Workflow run cannot transition from ${fromDomain} to ${toDomain}.`,
        { from: fromDomain, to: toDomain }
      );
    }
  }

  terminalStatuses(): readonly WorkflowRunStatus[] {
    return [WorkflowRunStatus.COMPLETED, WorkflowRunStatus.FAILED, WorkflowRunStatus.CANCELED, WorkflowRunStatus.DENIED];
  }

  isTerminal(status: WorkflowRunStatus): boolean {
    return this.terminalStatuses().includes(status);
  }

  allowedDomainTransitions(from: DomainWorkflowRunStatus): readonly DomainWorkflowRunStatus[] {
    return {
      [DomainWorkflowRunStatus.Queued]: [DomainWorkflowRunStatus.Running, DomainWorkflowRunStatus.Canceled],
      [DomainWorkflowRunStatus.Running]: [
        DomainWorkflowRunStatus.WaitingForApproval,
        DomainWorkflowRunStatus.Completed,
        DomainWorkflowRunStatus.Failed,
        DomainWorkflowRunStatus.Canceled
      ],
      [DomainWorkflowRunStatus.WaitingForApproval]: [
        DomainWorkflowRunStatus.Running,
        DomainWorkflowRunStatus.Denied,
        DomainWorkflowRunStatus.Failed,
        DomainWorkflowRunStatus.Canceled
      ],
      [DomainWorkflowRunStatus.Completed]: [],
      [DomainWorkflowRunStatus.Failed]: [],
      [DomainWorkflowRunStatus.Canceled]: [],
      [DomainWorkflowRunStatus.Denied]: []
    }[from];
  }
}
