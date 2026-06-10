import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';

type AuthAuditInput = {
  organizationId: string;
  actorType: AuditActorType;
  actorId?: string;
  eventType: AuditEventType;
  eventDataJson: Prisma.InputJsonObject;
};

@Injectable()
export class SessionAuditService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async record(input: AuthAuditInput): Promise<void> {
    const previous = await this.database.client.auditEvent.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' }
    });
    const prevHash = previous?.eventHash;
    const eventHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: input.organizationId,
          workflowRunId: null,
          agentId: null,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          eventDataJson: input.eventDataJson,
          prevHash: prevHash ?? null
        })
      )
      .digest('hex');

    await this.database.client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorType: input.actorType,
        actorId: input.actorId,
        eventType: input.eventType,
        eventDataJson: input.eventDataJson,
        prevHash,
        eventHash
      }
    });
  }
}
