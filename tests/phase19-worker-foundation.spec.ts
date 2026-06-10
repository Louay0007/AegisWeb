import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  AgentStatus,
  AuditEventType,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerConfigService, loadWorkerConfig } from '../apps/worker/src/config/worker-config.service.js';
import { WorkerDatabaseService } from '../apps/worker/src/database/worker-database.service.js';
import { InternalApiClient } from '../apps/worker/src/internal-api/internal-api-client.service.js';
import { connectionFromRedisUrl } from '../apps/worker/src/queue/worker-redis.js';
import { WorkerRuntimeService } from '../apps/worker/src/runtime/worker-runtime.service.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';
import { RunHeartbeatService } from '../apps/worker/src/workflow-executor/run-heartbeat.service.js';
import {
  WORKFLOW_QUEUE_JOB_NAMES,
  WORKFLOW_QUEUE_NAMES,
  WorkflowQueueJobData,
  workflowStartJobId
} from '@agentpass/domain';

describe('phase 19 worker foundation', () => {
  let api: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let worker: WorkerService;
  let database: WorkerDatabaseService;
  let heartbeat: RunHeartbeatService;
  let queue: Queue<WorkflowQueueJobData>;
  let previousRedisUrl: string | undefined;
  let previousApiBaseUrl: string | undefined;
  let organizationId: string;
  let agentId: string;
  let vendorId: string;
  let workflowId: string;

  beforeAll(async () => {
    previousRedisUrl = process.env.REDIS_URL;
    previousApiBaseUrl = process.env.API_BASE_URL;
    process.env.REDIS_URL = redisDbUrl(previousRedisUrl ?? 'redis://localhost:6379', 7);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    api = moduleRef.createNestApplication();
    await api.init();
    await api.listen(0);
    const address = api.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    process.env.API_BASE_URL = `http://127.0.0.1:${port}`;

    workerApp = await createWorkerApplicationContext();
    worker = workerApp.get(WorkerService);
    database = workerApp.get(WorkerDatabaseService);
    heartbeat = workerApp.get(RunHeartbeatService);
    const config = workerApp.get(WorkerConfigService);
    queue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.runs, {
      connection: connectionFromRedisUrl(config.config.redisUrl)
    });
    await queue.drain(true);

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Nineteen Org',
        domain: `phase19-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const owner = await database.client.user.create({
      data: {
        organizationId,
        email: `owner-${unique}@phase19.dev`,
        name: 'Phase Nineteen Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: 'unused'
      }
    });

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Nineteen Bot',
          identifier: `phase19-bot-${unique}@agentpass.local`,
          purpose: 'Worker foundation tests.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Nineteen Acme',
          website: `https://phase19-acme-${unique}.example.dev`,
          category: VendorCategory.ANALYTICS
        }
      })
    ]);
    agentId = agent.id;
    vendorId = vendor.id;

    const workflow = await database.client.workflow.create({
      data: {
        organizationId,
        agentId,
        vendorId,
        name: 'Phase Nineteen Noop Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: owner.id
      }
    });
    workflowId = workflow.id;
  }, 30000);

  afterAll(async () => {
    await worker.stop();
    await queue.close();
    await workerApp.close();
    await api.close();

    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }
    if (previousApiBaseUrl === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = previousApiBaseUrl;
    }
  });

  it('boots the worker application with Phase 19 modules', () => {
    expect(worker.getStatus()).toMatchObject({
      service: 'worker',
      state: 'ok',
      mode: 'phase-19-worker-foundation',
      queue: {
        running: false,
        queueName: WORKFLOW_QUEUE_NAMES.runs
      }
    });
  });

  it('connects to Redis, MinIO, browser runtime, and the API health endpoint', async () => {
    const checks = await workerApp.get(WorkerRuntimeService).checkBootDependencies();

    expect(checks.redis.state).toBe('ok');
    expect(checks.api.state).toBe('ok');
    expect(checks.minio.state).toBe('ok');
    expect(checks.browserRuntime.state).toBe('ok');
  }, 30000);

  it('rejects missing internal worker token configuration', () => {
    expect(() => loadWorkerConfig({ ...process.env, WORKER_INTERNAL_TOKEN: '' }, { useDefaults: true })).toThrow();
  });

  it('can call the API with the configured internal worker token', async () => {
    const result = await workerApp.get(InternalApiClient).checkHealth();

    expect(result).toMatchObject({
      reachable: true,
      statusCode: 200
    });
  });

  it('sends a heartbeat event for a running workflow run', async () => {
    const run = await createRun(WorkflowRunStatus.RUNNING);
    const heartbeatAt = await heartbeat.heartbeat(run.id, 'phase19-heartbeat-job');

    const updated = await database.client.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(updated.stateJson).toMatchObject({
      workerHeartbeatAt: heartbeatAt,
      workerHeartbeatJobId: 'phase19-heartbeat-job'
    });

    const event = await database.client.auditEvent.findFirst({
      where: {
        organizationId,
        workflowRunId: run.id,
        eventType: AuditEventType.WORKFLOW_STEP_STARTED
      }
    });
    expect(event?.eventDataJson).toMatchObject({
      step: 'worker_heartbeat',
      jobId: 'phase19-heartbeat-job'
    });
  });

  it('picks a no-op workflow job and marks the run completed', async () => {
    const run = await createRun(WorkflowRunStatus.QUEUED);

    await queue.add(
      WORKFLOW_QUEUE_JOB_NAMES.start,
      {
        workflowRunId: run.id,
        workflowId,
        organizationId,
        agentId,
        vendorId,
        template: 'noop',
        mode: 'start',
        approvalRequestId: null,
        attempt: 1,
        requestedAt: new Date().toISOString()
      },
      {
        jobId: workflowStartJobId(run.id),
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    await worker.start();
    const completed = await waitForRunStatus(run.id, WorkflowRunStatus.COMPLETED);

    expect(completed.currentStep).toBe('noop_completed');
    expect(completed.resultSummary).toBe('Phase 19 no-op worker completed the queued workflow run.');
    expect(completed.stateJson).toMatchObject({
      workerEvents: expect.arrayContaining([
        expect.objectContaining({ phase: 19, status: WorkflowRunStatus.COMPLETED })
      ])
    });
  }, 30000);

  async function createRun(status: WorkflowRunStatus) {
    return database.client.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        agentId,
        vendorId,
        status,
        startedAt: status === WorkflowRunStatus.RUNNING ? new Date() : undefined,
        stateJson: {}
      }
    });
  }

  async function waitForRunStatus(runId: string, status: WorkflowRunStatus) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === status) {
        return run;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Workflow run ${runId} did not reach ${status}.`);
  }
});

function redisDbUrl(redisUrl: string, db: number): string {
  const url = new URL(redisUrl);
  url.pathname = `/${db}`;
  return url.toString();
}
