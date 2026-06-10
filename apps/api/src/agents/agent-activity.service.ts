import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { toAgentActivityDto } from './agents.types.js';

@Injectable()
export class AgentActivityService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getActivity(organizationId: string | undefined, agentId: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const agent = await this.database.client.agent.findFirst({
      where: { id: agentId, organizationId }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.NotFound, 'Agent was not found.');
    }

    const [auditEvents, workflowRuns] = await Promise.all([
      this.database.client.auditEvent.findMany({
        where: {
          organizationId,
          agentId
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25
      }),
      this.database.client.workflowRun.findMany({
        where: {
          organizationId,
          agentId
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10
      })
    ]);

    return { data: toAgentActivityDto(agent, auditEvents, workflowRuns) };
  }
}
