import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma, WorkflowRunStatus } from '@prisma/client';
import { Job, JobsOptions, Queue } from 'bullmq';
import { DomainError, DomainErrorCode, issueWorkerRunToken } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { connectionFromRedisUrl } from './queue-redis.js';
import {
  EnqueueWorkflowCancelInput,
  EnqueueWorkflowResumeInput,
  EnqueueWorkflowStartInput,
  WORKFLOW_QUEUE_JOB_NAMES,
  WORKFLOW_QUEUE_NAMES,
  WorkflowQueueEnqueueResult,
  WorkflowQueueJobData,
  WorkflowQueueJobDiagnostics,
  WorkflowQueueName,
  WorkflowRunQueueDiagnostics,
  workflowCancelJobId,
  workflowResumeJobId,
  workflowStartJobId
} from './workflow-queue.types.js';

const retryableJobOptions: Pick<JobsOptions, 'attempts' | 'backoff' | 'removeOnComplete' | 'removeOnFail'> = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500
};

const signalJobOptions: Pick<JobsOptions, 'attempts' | 'removeOnComplete' | 'removeOnFail'> = {
  attempts: 1,
  removeOnComplete: 100,
  removeOnFail: 500
};

const executableStatuses = new Set<WorkflowRunStatus>([
  WorkflowRunStatus.QUEUED,
  WorkflowRunStatus.RUNNING,
  WorkflowRunStatus.WAITING_FOR_APPROVAL
]);

@Injectable()
export class WorkflowQueueService implements OnModuleDestroy {
  private readonly queues: Record<WorkflowQueueName, Queue<WorkflowQueueJobData>>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService
  ) {
    const connection = connectionFromRedisUrl(this.config.redisUrl);
    this.queues = {
      [WORKFLOW_QUEUE_NAMES.runs]: new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.runs, { connection }),
      [WORKFLOW_QUEUE_NAMES.resume]: new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.resume, { connection }),
      [WORKFLOW_QUEUE_NAMES.maintenance]: new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.maintenance, { connection })
    };
  }

  async enqueueStart(input: EnqueueWorkflowStartInput): Promise<WorkflowQueueEnqueueResult> {
    return this.addIdempotent(
      WORKFLOW_QUEUE_NAMES.runs,
      WORKFLOW_QUEUE_JOB_NAMES.start,
      workflowStartJobId(input.workflowRunId),
      {
        workflowRunId: input.workflowRunId,
        workflowId: input.workflowId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        vendorId: input.vendorId,
        template: input.template,
        mode: 'start',
        approvalRequestId: null,
        attempt: 1,
        requestedAt: new Date().toISOString(),
        workerRunToken: this.issueRunToken(input.organizationId, input.workflowRunId)
      },
      retryableJobOptions
    );
  }

  async enqueueResume(input: EnqueueWorkflowResumeInput): Promise<WorkflowQueueEnqueueResult> {
    return this.addIdempotent(
      WORKFLOW_QUEUE_NAMES.resume,
      WORKFLOW_QUEUE_JOB_NAMES.resume,
      workflowResumeJobId(input.workflowRunId, input.approvalRequestId),
      {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        mode: 'resume',
        approvalRequestId: input.approvalRequestId,
        attempt: 1,
        requestedAt: new Date().toISOString(),
        workerRunToken: this.issueRunToken(input.organizationId, input.workflowRunId)
      },
      retryableJobOptions
    );
  }

  async enqueueCancel(input: EnqueueWorkflowCancelInput): Promise<WorkflowQueueEnqueueResult> {
    return this.addIdempotent(
      WORKFLOW_QUEUE_NAMES.maintenance,
      WORKFLOW_QUEUE_JOB_NAMES.cancel,
      workflowCancelJobId(input.workflowRunId),
      {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        mode: 'cancel',
        approvalRequestId: null,
        attempt: 1,
        reason: input.reason,
        requestedAt: new Date().toISOString(),
        workerRunToken: this.issueRunToken(input.organizationId, input.workflowRunId)
      },
      signalJobOptions
    );
  }

  async removeStartJob(workflowRunId: string): Promise<boolean> {
    const job = await this.queues[WORKFLOW_QUEUE_NAMES.runs].getJob(workflowStartJobId(workflowRunId));
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
      await job.remove();
      await this.recordQueueDepth(WORKFLOW_QUEUE_NAMES.runs);
      return true;
    }

    return false;
  }

  async getJobState(queueName: WorkflowQueueName, jobId: string): Promise<WorkflowQueueJobDiagnostics> {
    const job = await this.queues[queueName].getJob(jobId);
    if (!job) {
      return this.emptyDiagnostics(queueName, jobId);
    }

    return this.toDiagnostics(queueName, job);
  }

  async getRunDiagnostics(organizationId: string | undefined, workflowRunId: string): Promise<WorkflowRunQueueDiagnostics> {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const run = await this.database.client.workflowRun.findFirst({
      where: { id: workflowRunId, organizationId },
      select: { id: true, organizationId: true }
    });
    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    const approvals = await this.database.client.approvalRequest.findMany({
      where: { workflowRunId, organizationId },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    const [start, cancel, ...resume] = await Promise.all([
      this.getJobState(WORKFLOW_QUEUE_NAMES.runs, workflowStartJobId(workflowRunId)),
      this.getJobState(WORKFLOW_QUEUE_NAMES.maintenance, workflowCancelJobId(workflowRunId)),
      ...approvals.map((approval) => this.getJobState(WORKFLOW_QUEUE_NAMES.resume, workflowResumeJobId(workflowRunId, approval.id)))
    ]);

    return {
      workflowRunId,
      organizationId,
      jobs: {
        start,
        cancel,
        resume
      }
    };
  }

  async shouldProcessRun(workflowRunId: string): Promise<boolean> {
    const run = await this.database.client.workflowRun.findUnique({
      where: { id: workflowRunId },
      select: { status: true }
    });

    return Boolean(run && executableStatuses.has(run.status));
  }

  async markPermanentFailure(workflowRunId: string, errorMessage: string): Promise<boolean> {
    const existing = await this.database.client.workflowRun.findUnique({
      where: { id: workflowRunId }
    });
    if (!existing) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }
    if (!executableStatuses.has(existing.status)) {
      return false;
    }

    const failedAt = new Date();
    const run = await this.database.client.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: WorkflowRunStatus.FAILED,
        completedAt: existing.completedAt ?? failedAt,
        errorMessage,
        stateJson: this.nextFailureState(existing.stateJson, existing.status, errorMessage, failedAt)
      }
    });

    await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.WORKER,
      eventType: AuditEventType.WORKFLOW_RUN_FAILED,
      eventDataJson: {
        workflowRunId: run.id,
        workflowId: run.workflowId,
        previousStatus: existing.status,
        errorMessage,
        permanent: true
      }
    });

    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));
  }

  private async addIdempotent(
    queueName: WorkflowQueueName,
    name: string,
    jobId: string,
    data: WorkflowQueueJobData,
    options: Pick<JobsOptions, 'attempts' | 'backoff' | 'removeOnComplete' | 'removeOnFail'>
  ): Promise<WorkflowQueueEnqueueResult> {
    const queue = this.queues[queueName];
    const existing = await queue.getJob(jobId);
    if (existing) {
      return { jobId: String(existing.id), queueName, created: false };
    }

    const job = await queue.add(name, data, {
      ...options,
      jobId
    });
    this.metrics.recordWorkflowRun('queued', data.template ?? 'unknown');
    await this.recordQueueDepth(queueName);

    return { jobId: String(job.id), queueName, created: true };
  }

  private async recordQueueDepth(queueName: WorkflowQueueName): Promise<void> {
    const counts = await this.queues[queueName].getJobCounts('waiting', 'delayed', 'prioritized');
    this.metrics.setQueueDepth(queueName, Object.values(counts).reduce((sum, count) => sum + count, 0));
  }

  private issueRunToken(organizationId: string, workflowRunId: string): string {
    return issueWorkerRunToken(this.config.config.workerInternalToken, {
      organizationId,
      workflowRunId,
      ttlSeconds: 60 * 60 * 6
    });
  }

  private async toDiagnostics(queueName: WorkflowQueueName, job: Job<WorkflowQueueJobData>): Promise<WorkflowQueueJobDiagnostics> {
    return {
      queueName,
      jobId: String(job.id),
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      timestamp: job.timestamp ?? null,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null
    };
  }

  private emptyDiagnostics(queueName: WorkflowQueueName, jobId: string): WorkflowQueueJobDiagnostics {
    return {
      queueName,
      jobId,
      state: null,
      attemptsMade: null,
      failedReason: null,
      timestamp: null,
      processedOn: null,
      finishedOn: null
    };
  }

  private nextFailureState(
    existing: Prisma.JsonValue,
    previousStatus: WorkflowRunStatus,
    errorMessage: string,
    failedAt: Date
  ): Prisma.InputJsonObject {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Prisma.JsonObject) : {};
    const transitions = Array.isArray(base.transitions) ? base.transitions : [];

    return {
      ...base,
      permanentFailure: true,
      failureReason: errorMessage,
      failedAt: failedAt.toISOString(),
      transitions: [
        ...transitions,
        {
          from: previousStatus,
          to: WorkflowRunStatus.FAILED,
          reason: errorMessage,
          permanent: true,
          at: failedAt.toISOString()
        }
      ]
    };
  }
}
