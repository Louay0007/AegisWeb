import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma } from '@prisma/client';
import { WorkerDatabaseService } from '../database/worker-database.service.js';

export type WorkerAuditInput = {
  organizationId: string;
  workflowRunId?: string;
  agentId?: string;
  eventType: AuditEventType;
  eventDataJson: Prisma.InputJsonObject;
};

@Injectable()
export class WorkerAuditService {
  constructor(@Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService) {}

  async record(input: WorkerAuditInput): Promise<void> {
    const previous = await this.database.client.auditEvent.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const prevHash = previous?.eventHash ?? null;
    const eventHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: input.organizationId,
          workflowRunId: input.workflowRunId ?? null,
          agentId: input.agentId ?? null,
          actorType: AuditActorType.WORKER,
          actorId: 'worker',
          eventType: input.eventType,
          eventDataJson: input.eventDataJson,
          prevHash
        })
      )
      .digest('hex');

    await this.database.client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        workflowRunId: input.workflowRunId,
        agentId: input.agentId,
        actorType: AuditActorType.WORKER,
        actorId: 'worker',
        eventType: input.eventType,
        eventDataJson: input.eventDataJson,
        prevHash,
        eventHash
      }
    });
  }
}
