import { Inject, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  AuditEventType,
  Policy,
  PolicyStatus as PrismaPolicyStatus,
  PolicyType as PrismaPolicyType,
  Prisma
} from '@prisma/client';
import { DomainError, DomainErrorCode, PolicyStatus, PolicyType } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { toPolicyDto } from './policies.types.js';
import { toPrismaPolicyStatus, toPrismaPolicyType } from './policy-type-mapping.js';
import { PolicyValidationService } from './policy-validation.service.js';

export type CreatePolicyInput = {
  agentId?: string;
  name: string;
  type: PolicyType;
  status?: PolicyStatus;
  rulesJson: Prisma.InputJsonObject;
};

export type UpdatePolicyInput = {
  agentId?: string | null;
  name?: string;
  type?: PolicyType;
  status?: PolicyStatus;
  rulesJson?: Prisma.InputJsonObject;
};

@Injectable()
export class PoliciesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyValidationService) private readonly validation: PolicyValidationService
  ) {}

  async list(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const policies = await this.database.client.policy.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
    });

    return { data: policies.map(toPolicyDto) };
  }

  async get(organizationId: string | undefined, id: string) {
    const policy = await this.findPolicyInOrganization(organizationId, id);
    return { data: toPolicyDto(policy) };
  }

  async create(currentUser: ContextUser | undefined, input: CreatePolicyInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const rulesJson = this.validation.validateSnapshot(input.rulesJson);
    const type = toPrismaPolicyType(input.type);
    const status = toPrismaPolicyStatus(input.status ?? PolicyStatus.Active);

    if (input.agentId) {
      await this.assertAgentInOrganization(currentUser.organizationId, input.agentId);
    }

    await this.assertOneActiveBundle(currentUser.organizationId, input.agentId ?? null, type, status);

    const policy = await this.database.client.policy.create({
      data: {
        organizationId: currentUser.organizationId,
        agentId: input.agentId,
        name: input.name,
        type,
        status,
        version: 1,
        rulesJson: rulesJson as Prisma.InputJsonObject,
        createdByUserId: currentUser.id
      }
    });

    await this.recordPolicyAudit(currentUser, policy, AuditEventType.POLICY_CREATED, {
      policyId: policy.id,
      agentId: policy.agentId,
      name: policy.name,
      type: input.type,
      version: policy.version,
      status: input.status ?? PolicyStatus.Active
    });

    return { data: toPolicyDto(policy) };
  }

  async update(currentUser: ContextUser | undefined, id: string, input: UpdatePolicyInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findPolicyInOrganization(currentUser.organizationId, id);
    const nextRules = input.rulesJson ? this.validation.validateSnapshot(input.rulesJson) : undefined;
    const nextType = input.type ? toPrismaPolicyType(input.type) : existing.type;
    const nextStatus = input.status ? toPrismaPolicyStatus(input.status) : existing.status;
    const nextAgentId = input.agentId === undefined ? existing.agentId : input.agentId;

    if (nextAgentId) {
      await this.assertAgentInOrganization(currentUser.organizationId, nextAgentId);
    }

    await this.assertOneActiveBundle(currentUser.organizationId, nextAgentId, nextType, nextStatus, existing.id);

    const policy = await this.database.client.policy.update({
      where: { id: existing.id },
      data: {
        agentId: nextAgentId,
        name: input.name,
        type: input.type ? nextType : undefined,
        status: input.status ? nextStatus : undefined,
        rulesJson: nextRules as Prisma.InputJsonObject | undefined,
        version: { increment: 1 }
      }
    });

    await this.recordPolicyAudit(currentUser, policy, AuditEventType.POLICY_UPDATED, {
      policyId: policy.id,
      agentId: policy.agentId,
      previousVersion: existing.version,
      version: policy.version,
      name: policy.name
    });

    return { data: toPolicyDto(policy) };
  }

  private async findPolicyInOrganization(organizationId: string | undefined, id: string): Promise<Policy> {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const policy = await this.database.client.policy.findFirst({
      where: { id, organizationId }
    });

    if (!policy) {
      throw new DomainError(DomainErrorCode.NotFound, 'Policy was not found.');
    }

    return policy;
  }

  private async assertAgentInOrganization(organizationId: string, agentId: string): Promise<void> {
    const agent = await this.database.client.agent.findFirst({
      where: {
        id: agentId,
        organizationId
      },
      select: { id: true }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Policy agent belongs to another organization.');
    }
  }

  private async assertOneActiveBundle(
    organizationId: string,
    agentId: string | null,
    type: PrismaPolicyType,
    status: PrismaPolicyStatus,
    exceptPolicyId?: string
  ): Promise<void> {
    if (!agentId || type !== PrismaPolicyType.AGENT_POLICY_BUNDLE || status !== PrismaPolicyStatus.ACTIVE) {
      return;
    }

    const duplicate = await this.database.client.policy.findFirst({
      where: {
        organizationId,
        agentId,
        type: PrismaPolicyType.AGENT_POLICY_BUNDLE,
        status: PrismaPolicyStatus.ACTIVE,
        id: exceptPolicyId ? { not: exceptPolicyId } : undefined
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Agent already has an active policy bundle.');
    }
  }

  private async recordPolicyAudit(
    currentUser: ContextUser,
    policy: Policy,
    eventType: AuditEventType,
    eventDataJson: Prisma.InputJsonObject
  ): Promise<void> {
    await this.audit.record({
      organizationId: currentUser.organizationId,
      agentId: policy.agentId ?? undefined,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType,
      eventDataJson
    });
  }
}
