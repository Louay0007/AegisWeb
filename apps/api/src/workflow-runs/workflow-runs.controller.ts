import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { WorkflowRunStatus } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { WorkflowQueueService } from '../queue/workflow-queue.service.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { WorkflowRunListQuery, WorkflowRunQueryService } from './workflow-run-query.service.js';
import { WorkflowRunsService } from './workflow-runs.service.js';

type QueryValue = string | string[] | undefined;
type QueryRecord = Record<string, QueryValue>;

const querySchema = z.object({
  workflowId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  status: z.nativeEnum(WorkflowRunStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const cancelSchema = z.object({
  reason: z.string().min(1).max(500).default('Canceled by user.')
});

@Controller('workflow-runs')
export class WorkflowRunsController {
  constructor(
    @Inject(WorkflowRunQueryService) private readonly queryService: WorkflowRunQueryService,
    @Inject(WorkflowRunsService) private readonly runsService: WorkflowRunsService,
    @Inject(WorkflowQueueService) private readonly queueService: WorkflowQueueService
  ) {}

  @RequirePermission(Permission.WorkflowRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.queryService.list(organizationId, parseQuery(query));
  }

  @RequirePermission(Permission.WorkflowRead)
  @Get(':id/events')
  events(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.queryService.events(organizationId, id);
  }

  @RequirePermission(Permission.WorkflowCancel)
  @Post(':id/cancel')
  cancel(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = cancelSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid workflow run cancel request.');
    }

    return this.runsService.cancel(currentUser, id, parsed.data);
  }

  @RequirePermission(Permission.WorkflowRead)
  @Get(':id/queue')
  async queue(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return { data: await this.queueService.getRunDiagnostics(organizationId, id) };
  }

  @RequirePermission(Permission.WorkflowRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.queryService.get(organizationId, id);
  }
}

function parseQuery(query: QueryRecord): WorkflowRunListQuery {
  const status = normalizeStatus(first(query.status));
  const parsed = querySchema.safeParse({
    workflowId: first(query.workflowId),
    agentId: first(query.agentId),
    vendorId: first(query.vendorId),
    status,
    limit: first(query.limit),
    offset: first(query.offset)
  });

  if (!parsed.success) {
    throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid workflow run query.');
  }

  return parsed.data;
}

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): WorkflowRunStatus | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toUpperCase();
  return Object.values(WorkflowRunStatus).find((status) => status === normalized);
}
