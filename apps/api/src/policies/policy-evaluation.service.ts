import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Policy } from '@prisma/client';
import { evaluatePolicy } from '@agentpass/policy-engine';
import {
  ActionType,
  DomainError,
  DomainErrorCode,
  PolicyEvaluationResult,
  RiskSignal
} from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { fromPrismaAgentStatus } from './policy-type-mapping.js';
import { PolicySnapshotService } from './policy-snapshot.service.js';
import { PolicyValidationService } from './policy-validation.service.js';

export type EvaluatePolicyInput = {
  policyId?: string;
  agentId: string;
  website: string;
  actionType: ActionType;
  amountCents?: number;
  riskSignals?: RiskSignal[];
  policySnapshot?: unknown;
};

export type PolicyEvaluationDto = {
  policyId: string | null;
  policyVersion: number | null;
  agentId: string;
  result: PolicyEvaluationResult;
};

@Injectable()
export class PolicyEvaluationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicySnapshotService) private readonly snapshots: PolicySnapshotService,
    @Inject(PolicyValidationService) private readonly validation: PolicyValidationService
  ) {}

  async evaluate(currentUser: ContextUser | undefined, input: EvaluatePolicyInput): Promise<{ data: PolicyEvaluationDto }> {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const agent = await this.database.client.agent.findFirst({
      where: {
        id: input.agentId,
        organizationId: currentUser.organizationId
      }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.NotFound, 'Agent was not found.');
    }

    const policy = input.policyId ? await this.findPolicy(currentUser.organizationId, input.policyId) : null;
    if (policy?.agentId && policy.agentId !== agent.id) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Policy belongs to another agent.');
    }

    const policySnapshot = policy ? this.snapshots.fromPolicy(policy) : this.validation.validateSnapshot(input.policySnapshot);
    const result = evaluatePolicy({
      organizationId: currentUser.organizationId,
      agentId: agent.id,
      agentStatus: fromPrismaAgentStatus(agent.status),
      website: input.website,
      actionType: input.actionType,
      amountCents: input.amountCents,
      riskSignals: input.riskSignals ?? [],
      policySnapshot,
      now: new Date().toISOString()
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      agentId: agent.id,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.POLICY_EVALUATED,
      eventDataJson: {
        policyId: policy?.id ?? null,
        policyVersion: policy?.version ?? null,
        agentId: agent.id,
        actionType: input.actionType,
        website: input.website,
        amountCents: input.amountCents ?? null,
        decision: result.decision,
        riskLevel: result.riskLevel,
        reason: result.reason,
        matchedRules: result.matchedRules
      }
    });

    return {
      data: {
        policyId: policy?.id ?? null,
        policyVersion: policy?.version ?? null,
        agentId: agent.id,
        result
      }
    };
  }

  private async findPolicy(organizationId: string, policyId: string): Promise<Policy> {
    const policy = await this.database.client.policy.findFirst({
      where: {
        id: policyId,
        organizationId
      }
    });

    if (!policy) {
      throw new DomainError(DomainErrorCode.NotFound, 'Policy was not found.');
    }

    return policy;
  }
}
