import { Inject, Injectable } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { WorkerAuditService } from '../audit/worker-audit.service.js';
import { WorkerDatabaseService } from '../database/worker-database.service.js';

@Injectable()
export class RunHeartbeatService {
  constructor(
    @Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService,
    @Inject(WorkerAuditService) private readonly audit: WorkerAuditService
  ) {}

  async heartbeat(workflowRunId: string, jobId: string): Promise<string> {
    const heartbeatAt = new Date().toISOString();
    const run = await this.database.client.workflowRun.findUniqueOrThrow({
      where: { id: workflowRunId }
    });

    await this.database.client.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        stateJson: this.nextHeartbeatState(run.stateJson, heartbeatAt, jobId)
      }
    });

    await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      eventType: AuditEventType.WORKFLOW_STEP_STARTED,
      eventDataJson: {
        workflowRunId: run.id,
        step: 'worker_heartbeat',
        heartbeatAt,
        jobId
      }
    });

    return heartbeatAt;
  }

  private nextHeartbeatState(existing: Prisma.JsonValue, heartbeatAt: string, jobId: string): Prisma.InputJsonObject {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Prisma.JsonObject) : {};
    return {
      ...base,
      workerHeartbeatAt: heartbeatAt,
      workerHeartbeatJobId: jobId
    };
  }
}
