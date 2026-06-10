import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { AuditEventListQuery, toAuditEventDto } from './audit.types.js';

@Injectable()
export class AuditQueryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(organizationId: string | undefined, query: AuditEventListQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where: Prisma.AuditEventWhereInput = {
      organizationId,
      workflowRunId: query.workflowRunId,
      actorType: query.actorType,
      actorId: query.actorId,
      eventType: query.eventType,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from,
              lte: query.to
            }
          : undefined
    };

    const [events, total] = await Promise.all([
      this.database.client.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset
      }),
      this.database.client.auditEvent.count({ where })
    ]);

    return {
      data: events.map(toAuditEventDto),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset
      }
    };
  }

  async getById(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const event = await this.database.client.auditEvent.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!event) {
      throw new DomainError(DomainErrorCode.NotFound, 'Audit event was not found.');
    }

    return {
      data: toAuditEventDto(event)
    };
  }
}
