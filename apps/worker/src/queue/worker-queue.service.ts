import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker as BullWorker } from 'bullmq';
import { WORKFLOW_QUEUE_NAMES, WorkflowQueueJobData, WorkflowQueueName } from '@agentpass/domain';
import { WorkerConfigService } from '../config/worker-config.service.js';
import { WorkerLogger } from '../logging/worker-logger.service.js';
import { WorkflowExecutorService } from '../workflow-executor/workflow-executor.service.js';
import { connectionFromRedisUrl } from './worker-redis.js';

export type WorkerQueueStatus = {
  running: boolean;
  queueName: string;
  queues: Array<{
    queueName: WorkflowQueueName;
    running: boolean;
  }>;
};

@Injectable()
export class WorkerQueueService implements OnModuleDestroy {
  private workers: Partial<Record<WorkflowQueueName, BullWorker<WorkflowQueueJobData>>> = {};

  constructor(
    @Inject(WorkerConfigService) private readonly config: WorkerConfigService,
    @Inject(WorkflowExecutorService) private readonly executor: WorkflowExecutorService,
    @Inject(WorkerLogger) private readonly logger: WorkerLogger
  ) {}

  async start(): Promise<void> {
    this.startWorker(WORKFLOW_QUEUE_NAMES.runs);
    this.startWorker(WORKFLOW_QUEUE_NAMES.resume);
  }

  async stop(): Promise<void> {
    await Promise.all(Object.values(this.workers).map((worker) => worker.close()));
    this.workers = {};
  }

  getStatus(): WorkerQueueStatus {
    const queues = [WORKFLOW_QUEUE_NAMES.runs, WORKFLOW_QUEUE_NAMES.resume].map((queueName) => ({
      queueName,
      running: Boolean(this.workers[queueName])
    }));

    return {
      running: queues.some((queue) => queue.running),
      queueName: WORKFLOW_QUEUE_NAMES.runs,
      queues
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  private startWorker(queueName: WorkflowQueueName): void {
    if (this.workers[queueName]) {
      return;
    }

    const worker = new BullWorker<WorkflowQueueJobData>(
      queueName,
      async (job: Job<WorkflowQueueJobData>) => this.executor.execute(job.data, String(job.id)),
      {
        connection: connectionFromRedisUrl(this.config.config.redisUrl),
        concurrency: 1
      }
    );

    worker.on('failed', (job, error) => {
      this.logger.error('Workflow job failed.', error, {
        queueName,
        jobId: job?.id,
        workflowRunId: job?.data.workflowRunId
      });
    });

    this.workers[queueName] = worker;
  }
}
