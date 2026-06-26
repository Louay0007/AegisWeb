import { Inject, Injectable } from '@nestjs/common';
import { AgentStatus, AuditActorType, AuditEventType, Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { PageQuery, pageToSkip, paginationMeta } from '../common/pagination.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { AgentIdentifierService } from './agent-identifier.service.js';
import { AgentStatusService } from './agent-status.service.js';
import { toAgentDto } from './agents.types.js';

export type CreateAgentInput = {
  name: string;
  purpose: string;
  identifier?: string;
};

export type UpdateAgentInput = {
  name?: string;
  purpose?: string;
};

@Injectable()
export class AgentsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AgentIdentifierService) private readonly identifiers: AgentIdentifierService,
    @Inject(AgentStatusService) private readonly statusRules: AgentStatusService
  ) {}

  async list(organizationId: string | undefined, page: PageQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where = { organizationId };
    const [agents, total] = await Promise.all([
      this.database.client.agent.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
        skip: pageToSkip(page),
        take: page.limit
      }),
      this.database.client.agent.count({ where })
    ]);

    return { data: agents.map(toAgentDto), meta: paginationMeta(total, page) };
  }

  async get(organizationId: string | undefined, id: string) {
    const agent = await this.findAgentInOrganization(organizationId, id);
    return { data: toAgentDto(agent) };
  }

  async create(currentUser: ContextUser | undefined, input: CreateAgentInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const identifier = input.identifier ?? (await this.identifiers.generate(input.name));

    if (!this.identifiers.isValid(identifier)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Agent identifier must use the agentpass.local format.');
    }

    const duplicate = await this.database.client.agent.findUnique({
      where: { identifier }
    });

    if (duplicate) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Agent identifier already exists.');
    }

    const agent = await this.database.client.agent.create({
      data: {
        organizationId: currentUser.organizationId,
        name: input.name,
        identifier,
        purpose: input.purpose,
        status: AgentStatus.ACTIVE,
        createdByUserId: currentUser.id
      }
    });

    await this.recordAgentAudit(currentUser, agent.id, AuditEventType.AGENT_CREATED, {
      name: agent.name,
      identifier: agent.identifier,
      purpose: agent.purpose
    });

    return { data: toAgentDto(agent) };
  }

  async update(currentUser: ContextUser | undefined, id: string, input: UpdateAgentInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findAgentInOrganization(currentUser.organizationId, id);

    if (existing.status === AgentStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Revoked agents cannot be updated.');
    }

    const agent = await this.database.client.agent.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        purpose: input.purpose
      }
    });

    await this.recordAgentAudit(currentUser, agent.id, AuditEventType.AGENT_UPDATED, {
      name: agent.name,
      purpose: agent.purpose
    });

    return { data: toAgentDto(agent) };
  }

  async pause(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findAgentInOrganization(currentUser.organizationId, id);
    this.statusRules.assertCanPause(existing);

    const agent = await this.database.client.agent.update({
      where: { id: existing.id },
      data: { status: AgentStatus.PAUSED }
    });

    await this.recordAgentAudit(currentUser, agent.id, AuditEventType.AGENT_PAUSED, {
      previousStatus: existing.status,
      nextStatus: agent.status
    });

    return { data: toAgentDto(agent) };
  }

  async resume(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findAgentInOrganization(currentUser.organizationId, id);
    this.statusRules.assertCanResume(existing);

    const agent = await this.database.client.agent.update({
      where: { id: existing.id },
      data: { status: AgentStatus.ACTIVE }
    });

    await this.recordAgentAudit(currentUser, agent.id, AuditEventType.AGENT_RESUMED, {
      previousStatus: existing.status,
      nextStatus: agent.status
    });

    return { data: toAgentDto(agent) };
  }

  async revoke(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findAgentInOrganization(currentUser.organizationId, id);
    this.statusRules.assertCanRevoke(existing);

    const agent = await this.database.client.agent.update({
      where: { id: existing.id },
      data: {
        status: AgentStatus.REVOKED,
        revokedAt: new Date()
      }
    });

    await this.recordAgentAudit(currentUser, agent.id, AuditEventType.AGENT_REVOKED, {
      previousStatus: existing.status,
      nextStatus: agent.status
    });

    return { data: toAgentDto(agent) };
  }

  async assertAgentCanStartWorkflow(organizationId: string, id: string): Promise<void> {
    const agent = await this.findAgentInOrganization(organizationId, id);
    this.statusRules.assertCanStartWorkflow(agent);
  }

  private async findAgentInOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const agent = await this.database.client.agent.findFirst({
      where: { id, organizationId }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.NotFound, 'Agent was not found.');
    }

    return agent;
  }

  private async recordAgentAudit(
    currentUser: ContextUser,
    agentId: string,
    eventType: AuditEventType,
    eventDataJson: Prisma.InputJsonObject
  ): Promise<void> {
    await this.audit.record({
      organizationId: currentUser.organizationId,
      agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType,
      eventDataJson
    });
  }
}
