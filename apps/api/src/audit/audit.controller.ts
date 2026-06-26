import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { AuditActorType, AuditEventType } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditEventListQuery } from './audit.types.js';
import { AuditExportService } from './audit-export.service.js';
import { AuditChainVerificationService } from './audit-chain-verification.service.js';

type QueryValue = string | string[] | undefined;
type QueryRecord = Record<string, QueryValue>;

const querySchema = z.object({
  workflowRunId: z.string().uuid().optional(),
  actorType: z.nativeEnum(AuditActorType).optional(),
  actorId: z.string().optional(),
  eventType: z.nativeEnum(AuditEventType).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

@RequirePermission(Permission.AuditRead)
@Controller('audit-events')
export class AuditController {
  constructor(
    @Inject(AuditQueryService) private readonly auditQuery: AuditQueryService,
    @Inject(AuditExportService) private readonly auditExport: AuditExportService,
    @Inject(AuditChainVerificationService) private readonly auditVerification: AuditChainVerificationService
  ) {}

  @Get()
  async list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.auditQuery.list(organizationId, parseQuery(query));
  }

  @Get('export')
  async export(@CurrentOrganizationId() organizationId: string | undefined) {
    return this.auditExport.exportOrganizationEvents(organizationId);
  }

  @Get('verify')
  async verify(@CurrentOrganizationId() organizationId: string | undefined) {
    return this.auditVerification.verifyOrganizationChain(organizationId);
  }

  @Get(':id')
  async getById(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.auditQuery.getById(organizationId, id);
  }
}

function parseQuery(query: QueryRecord): AuditEventListQuery {
  const parsed = querySchema.safeParse({
    workflowRunId: first(query.workflowRunId),
    actorType: first(query.actorType),
    actorId: first(query.actorId),
    eventType: first(query.eventType),
    from: first(query.from),
    to: first(query.to),
    limit: first(query.limit),
    offset: first(query.offset)
  });

  if (!parsed.success) {
    throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid audit query.');
  }

  return parsed.data;
}

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
