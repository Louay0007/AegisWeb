import { Inject, Injectable } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { InternalApiClient } from '../internal-api/internal-api-client.service.js';

export type WorkerAuditInput = {
  organizationId: string;
  workflowRunId?: string;
  agentId?: string;
  eventType: AuditEventType;
  eventDataJson: Prisma.InputJsonObject;
};

@Injectable()
export class WorkerAuditService {
  constructor(@Inject(InternalApiClient) private readonly internalApi: InternalApiClient) {}

  async record(input: WorkerAuditInput): Promise<void> {
    if (!input.workflowRunId) {
      throw new Error('Worker audit events require a workflow run ID.');
    }

    await this.internalApi.recordRunEvent(input.workflowRunId, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      eventDataJson: {
        ...(input.eventDataJson as Record<string, unknown>),
        agentId: input.agentId
      }
    });
  }
}
