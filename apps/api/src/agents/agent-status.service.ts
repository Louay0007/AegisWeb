import { Injectable } from '@nestjs/common';
import { Agent, AgentStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';

@Injectable()
export class AgentStatusService {
  assertCanPause(agent: Agent): void {
    if (agent.status === AgentStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Revoked agents cannot be paused.');
    }
  }

  assertCanResume(agent: Agent): void {
    if (agent.status === AgentStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Revoked agents cannot be resumed.');
    }

    if (agent.status !== AgentStatus.PAUSED) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Only paused agents can be resumed.');
    }
  }

  assertCanRevoke(agent: Agent): void {
    if (agent.status === AgentStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Agent is already revoked.');
    }
  }

  assertCanStartWorkflow(agent: Agent): void {
    if (agent.status !== AgentStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.AgentNotActive, 'Agent must be active to start workflow runs.');
    }
  }
}
