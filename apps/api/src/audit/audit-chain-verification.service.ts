import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { AuditHashService } from './audit-hash.service.js';

@Injectable()
export class AuditChainVerificationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditHashService) private readonly hashService: AuditHashService
  ) {}

  async verifyOrganizationChain(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const events = await this.database.client.auditEvent.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    let previousHash: string | null = null;
    for (const event of events) {
      const expected = this.hashService.hash({
        organizationId: event.organizationId,
        workflowRunId: event.workflowRunId,
        agentId: event.agentId,
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: event.eventType,
        eventDataJson: event.eventDataJson as Prisma.JsonValue,
        prevHash: event.prevHash
      });

      if (event.prevHash !== previousHash || event.eventHash !== expected) {
        return {
          data: {
            valid: false,
            checked: events.indexOf(event) + 1,
            firstBrokenEventId: event.id,
            expectedPrevHash: previousHash,
            actualPrevHash: event.prevHash,
            expectedEventHash: expected,
            actualEventHash: event.eventHash
          }
        };
      }

      previousHash = event.eventHash;
    }

    return {
      data: {
        valid: true,
        checked: events.length,
        firstBrokenEventId: null
      }
    };
  }
}
