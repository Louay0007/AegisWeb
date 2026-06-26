import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  ACTION_TYPES,
  ActionType,
  DomainError,
  DomainErrorCode,
  Permission,
  POLICY_STATUSES,
  POLICY_TYPES,
  PolicyStatus,
  PolicyType,
  RISK_SIGNALS,
  RiskSignal,
  UserRole
} from '@agentpass/domain';
import { RequirePermission, RequireRole, RequireStepUp } from '../authorization/authorization-metadata.js';
import { parsePageQuery, QueryRecord } from '../common/pagination.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { PolicyEvaluationService } from './policy-evaluation.service.js';
import { PoliciesService } from './policies.service.js';

const policyTypeSchema = z.custom<PolicyType>(
  (value) => typeof value === 'string' && POLICY_TYPES.includes(value as PolicyType)
);
const policyStatusSchema = z.custom<PolicyStatus>(
  (value) => typeof value === 'string' && POLICY_STATUSES.includes(value as PolicyStatus)
);
const actionTypeSchema = z.custom<ActionType>(
  (value) => typeof value === 'string' && ACTION_TYPES.includes(value as ActionType)
);
const riskSignalSchema = z.custom<RiskSignal>(
  (value) => typeof value === 'string' && RISK_SIGNALS.includes(value as RiskSignal)
);
const rulesSchema = z.record(z.unknown());

const createPolicySchema = z.object({
  agentId: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  type: policyTypeSchema,
  status: policyStatusSchema.optional(),
  rulesJson: rulesSchema
});

const updatePolicySchema = z
  .object({
    agentId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(160).optional(),
    type: policyTypeSchema.optional(),
    status: policyStatusSchema.optional(),
    rulesJson: rulesSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one policy field is required.' });

const evaluatePolicySchema = z
  .object({
    policyId: z.string().uuid().optional(),
    agentId: z.string().uuid(),
    website: z.string().min(1).max(2048),
    actionType: actionTypeSchema,
    amountCents: z.number().int().min(0).optional(),
    riskSignals: z.array(riskSignalSchema).optional(),
    policySnapshot: rulesSchema.optional()
  })
  .refine((value) => Boolean(value.policyId) || Boolean(value.policySnapshot), {
    message: 'Either policyId or policySnapshot is required.'
  });

@Controller('policies')
export class PoliciesController {
  constructor(
    @Inject(PoliciesService) private readonly policiesService: PoliciesService,
    @Inject(PolicyEvaluationService) private readonly evaluationService: PolicyEvaluationService
  ) {}

  @RequirePermission(Permission.PolicyRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.policiesService.list(organizationId, parsePageQuery(query));
  }

  @RequirePermission(Permission.PolicyCreate)
  @Post()
  create(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = createPolicySchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid policy create request.');
    }

    return this.policiesService.create(currentUser, {
      ...parsed.data,
      rulesJson: parsed.data.rulesJson as Prisma.InputJsonObject
    });
  }

  @RequireRole(UserRole.Owner, UserRole.Admin)
  @RequirePermission(Permission.PolicyUpdate)
  @Post('evaluate')
  evaluate(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = evaluatePolicySchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid policy evaluation request.');
    }

    return this.evaluationService.evaluate(currentUser, parsed.data);
  }

  @RequirePermission(Permission.PolicyRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.policiesService.get(organizationId, id);
  }

  @RequirePermission(Permission.PolicyUpdate)
  @RequireStepUp()
  @Patch(':id')
  update(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updatePolicySchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid policy update request.');
    }

    return this.policiesService.update(currentUser, id, {
      ...parsed.data,
      rulesJson: parsed.data.rulesJson as Prisma.InputJsonObject | undefined
    });
  }
}
