import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { toAuditEventDto } from './audit.types.js';

@Injectable()
export class AuditExportService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async exportOrganizationEvents(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const events = await this.database.client.auditEvent.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return {
      data: {
        exportedAt: new Date().toISOString(),
        organizationId,
        formatVersion: 1,
        events: events.map(toAuditEventDto)
      }
    };
  }
}
