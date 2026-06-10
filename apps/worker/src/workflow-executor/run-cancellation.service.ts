import { Inject, Injectable } from '@nestjs/common';
import { WorkflowRunStatus } from '@prisma/client';
import { WorkerDatabaseService } from '../database/worker-database.service.js';

@Injectable()
export class RunCancellationService {
  constructor(@Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService) {}

  async isCanceled(workflowRunId: string): Promise<boolean> {
    const run = await this.database.client.workflowRun.findUnique({
      where: { id: workflowRunId },
      select: { status: true }
    });

    return run?.status === WorkflowRunStatus.CANCELED;
  }
}
