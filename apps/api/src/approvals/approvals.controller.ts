import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApprovalStatus, Prisma, RiskLevel } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { InternalRoute, RequirePermission } from '../authorization/authorization-metadata.js';
import { InternalWorkerGuard } from '../authorization/internal-worker.guard.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { ApprovalListQuery, ApprovalsService } from './approvals.service.js';

type QueryValue = string | string[] | undefined;
type QueryRecord = Record<string, QueryValue>;

const querySchema = z.object({
  status: z.nativeEnum(ApprovalStatus).optional(),
  workflowRunId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const createApprovalSchema = z.object({
  actionAttemptId: z.string().uuid(),
  summary: z.string().min(1).max(1000),
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  amountCents: z.number().int().min(0).optional(),
  screenshotFileId: z.string().uuid().optional(),
  policyTriggeredJson: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional()
});

const decideSchema = z.object({
  comment: z.string().min(1).max(1000).optional()
});

@Controller('approvals')
export class ApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvals: ApprovalsService) {}

  @RequirePermission(Permission.ApprovalRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.approvals.list(organizationId, parseQuery(query));
  }

  @RequirePermission(Permission.ApprovalRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.approvals.get(organizationId, id);
  }

  @RequirePermission(Permission.ApprovalApprove)
  @Post(':id/approve')
  approve(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = decideSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid approval decision request.');
    }

    return this.approvals.approve(currentUser, id, parsed.data);
  }

  @RequirePermission(Permission.ApprovalApprove)
  @Post(':id/reject')
  reject(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = decideSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid approval decision request.');
    }

    return this.approvals.reject(currentUser, id, parsed.data);
  }
}

@Controller('internal/workers/runs')
export class InternalApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvals: ApprovalsService) {}

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/approval-requests')
  create(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = createApprovalSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid approval request create request.');
    }

    return this.approvals.createForRun(runId, {
      ...parsed.data,
      policyTriggeredJson: parsed.data.policyTriggeredJson as Prisma.InputJsonObject | undefined
    });
  }
}

function parseQuery(query: QueryRecord): ApprovalListQuery {
  const parsed = querySchema.safeParse({
    status: normalizeStatus(first(query.status)),
    workflowRunId: first(query.workflowRunId),
    limit: first(query.limit),
    offset: first(query.offset)
  });

  if (!parsed.success) {
    throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid approval query.');
  }

  return parsed.data;
}

function normalizeStatus(value: string | undefined): ApprovalStatus | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(ApprovalStatus).find((status) => status === value.toUpperCase());
}

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
