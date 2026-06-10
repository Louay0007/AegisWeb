import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  ACTION_TYPES,
  ActionType,
  DomainError,
  DomainErrorCode,
  Permission,
  POLICY_DECISIONS,
  PolicyDecision,
  RISK_LEVELS,
  RiskLevel
} from '@agentpass/domain';
import { InternalRoute, RequirePermission } from '../authorization/authorization-metadata.js';
import { InternalWorkerGuard } from '../authorization/internal-worker.guard.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { ActionAttemptsService } from './action-attempts.service.js';

const actionTypeSchema = z.custom<ActionType>(
  (value) => typeof value === 'string' && ACTION_TYPES.includes(value as ActionType)
);
const riskLevelSchema = z.custom<RiskLevel>(
  (value) => typeof value === 'string' && RISK_LEVELS.includes(value as RiskLevel)
);
const policyDecisionSchema = z.custom<PolicyDecision>(
  (value) => typeof value === 'string' && POLICY_DECISIONS.includes(value as PolicyDecision)
);
const metadataSchema = z.record(z.unknown()).optional();

const createAttemptSchema = z.object({
  website: z.string().min(1).max(2048),
  actionType: actionTypeSchema,
  riskLevel: riskLevelSchema.optional(),
  riskSignals: z.array(z.string()).optional(),
  policyDecision: policyDecisionSchema.optional(),
  policyReason: z.string().min(1).max(500).optional(),
  inputSummary: z.string().min(1).max(1000).optional(),
  outputSummary: z.string().min(1).max(1000).optional(),
  amountCents: z.number().int().min(0).optional(),
  metadataJson: metadataSchema
});

const completeAttemptSchema = z.object({
  outputSummary: z.string().min(1).max(1000).optional(),
  metadataJson: metadataSchema
});

const failAttemptSchema = z.object({
  errorSummary: z.string().min(1).max(1000),
  metadataJson: metadataSchema
});

const scopedAttemptSchema = z.object({
  workflowRunId: z.string().uuid()
});

@Controller('workflow-runs/:runId/action-attempts')
export class ActionAttemptsReadController {
  constructor(@Inject(ActionAttemptsService) private readonly actionAttempts: ActionAttemptsService) {}

  @RequirePermission(Permission.WorkflowRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Param('runId') runId: string) {
    return this.actionAttempts.listForRun(organizationId, runId);
  }
}

@Controller('internal/workers')
export class InternalActionAttemptsController {
  constructor(@Inject(ActionAttemptsService) private readonly actionAttempts: ActionAttemptsService) {}

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post('runs/:runId/action-attempts')
  create(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = createAttemptSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid action attempt create request.');
    }

    return this.actionAttempts.createForRun(runId, {
      ...parsed.data,
      metadataJson: parsed.data.metadataJson as Prisma.InputJsonObject | undefined
    });
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Patch('action-attempts/:id/complete')
  complete(@Param('id') id: string, @Body() body: unknown) {
    const parsed = completeAttemptSchema.merge(scopedAttemptSchema).safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid action attempt complete request.');
    }

    return this.actionAttempts.complete(id, {
      ...parsed.data,
      metadataJson: parsed.data.metadataJson as Prisma.InputJsonObject | undefined
    });
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Patch('action-attempts/:id/fail')
  fail(@Param('id') id: string, @Body() body: unknown) {
    const parsed = failAttemptSchema.merge(scopedAttemptSchema).safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid action attempt fail request.');
    }

    return this.actionAttempts.fail(id, {
      ...parsed.data,
      metadataJson: parsed.data.metadataJson as Prisma.InputJsonObject | undefined
    });
  }
}
