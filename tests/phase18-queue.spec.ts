import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  ActionType,
  AgentStatus,
  ApprovalStatus,
  AuditEventType,
  PolicyDecision,
  RiskLevel,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { WorkflowQueueService } from '../apps/api/src/queue/workflow-queue.service.js';
import {
  WORKFLOW_QUEUE_NAMES,
  verifyWorkerRunToken,
  workflowCancelJobId,
  workflowResumeJobId,
  workflowStartJobId
} from '@agentpass/domain';

describe('phase 18 queue module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let queueService: WorkflowQueueService;
  let runsQueue: Queue;
  let organizationId: string;
  let ownerToken: string;
  let agentId: string;
  let vendorId: string;
  let workflowId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);
    queueService = app.get(WorkflowQueueService);
    runsQueue = new Queue(WORKFLOW_QUEUE_NAMES.runs, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Eighteen Org',
        domain: `phase18-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const owner = await database.client.user.create({
      data: {
        organizationId,
        email: `owner-${unique}@phase18.dev`,
        name: 'Phase Eighteen Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: 'unused'
      }
    });
    ownerToken = tokenService.signAccessToken({
      sub: owner.id,
      userId: owner.id,
      organizationId: owner.organizationId,
      role: owner.role,
      email: owner.email
    });

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Eighteen Bot',
          identifier: `phase18-bot-${unique}@agentpass.local`,
          purpose: 'Queue reliability tests.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Eighteen Acme',
          website: `https://phase18-acme-${unique}.example.dev`,
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
        name: 'Phase Eighteen Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: owner.id
      }
    });
    workflowId = workflow.id;
  }, 30000);

  afterAll(async () => {
    await runsQueue.close();
    await app.close();
  });

  it('enqueues a workflow run job on the centralized workflow-runs queue', async () => {
    const run = await createRun(WorkflowRunStatus.QUEUED);

    const queued = await queueService.enqueueStart({
      workflowRunId: run.id,
      workflowId,
      organizationId,
      agentId,
      vendorId,
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD
    });

    expect(queued).toMatchObject({
      jobId: workflowStartJobId(run.id),
      queueName: WORKFLOW_QUEUE_NAMES.runs,
      created: true
    });

    const job = await runsQueue.getJob(workflowStartJobId(run.id));
    expect(job?.name).toBe('workflow.run.start');
    expect(job?.data).toMatchObject({
      workflowRunId: run.id,
      organizationId,
      mode: 'start',
      approvalRequestId: null,
      attempt: 1,
      workerRunToken: expect.any(String)
    });
    expect(verifyWorkerRunToken(config.config.workerInternalToken, job?.data.workerRunToken ?? '', {
      organizationId,
      workflowRunId: run.id
    })).toMatchObject({ organizationId, workflowRunId: run.id, scope: 'run' });
  });

  it('keeps duplicate workflow start enqueue idempotent', async () => {
    const run = await createRun(WorkflowRunStatus.QUEUED);
    const input = {
      workflowRunId: run.id,
      workflowId,
      organizationId,
      agentId,
      vendorId,
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD
    };

    const first = await queueService.enqueueStart(input);
    const second = await queueService.enqueueStart(input);

    expect(first.jobId).toBe(second.jobId);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
  });

  it('tells workers to ignore canceled runs before execution', async () => {
    const canceledRun = await createRun(WorkflowRunStatus.CANCELED);
    await expect(queueService.shouldProcessRun(canceledRun.id)).resolves.toBe(false);
  });

  it('marks a run failed after a permanent worker error', async () => {
    const run = await createRun(WorkflowRunStatus.RUNNING);

    await expect(queueService.markPermanentFailure(run.id, 'Vendor portal returned a permanent validation error.')).resolves.toBe(true);

    const failed = await database.client.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(failed.status).toBe(WorkflowRunStatus.FAILED);
    expect(failed.errorMessage).toBe('Vendor portal returned a permanent validation error.');
    expect(failed.stateJson).toMatchObject({
      permanentFailure: true,
      failureReason: 'Vendor portal returned a permanent validation error.'
    });

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId,
        workflowRunId: run.id,
        eventType: AuditEventType.WORKFLOW_RUN_FAILED
      }
    });
    expect(audit?.eventDataJson).toMatchObject({
      workflowRunId: run.id,
      permanent: true
    });
  });

  it('configures retryable start jobs with bounded exponential retries', async () => {
    const run = await createRun(WorkflowRunStatus.QUEUED);
    await queueService.enqueueStart({
      workflowRunId: run.id,
      workflowId,
      organizationId,
      agentId,
      vendorId,
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD
    });

    const job = await runsQueue.getJob(workflowStartJobId(run.id));
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toMatchObject({ type: 'exponential', delay: 1000 });
  });

  it('returns queue diagnostics for start, resume, and cancellation jobs', async () => {
    const run = await createRun(WorkflowRunStatus.RUNNING);
    const approval = await createApproval(run.id);

    await queueService.enqueueStart({
      workflowRunId: run.id,
      workflowId,
      organizationId,
      agentId,
      vendorId,
      template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST
    });
    await queueService.enqueueResume({
      workflowRunId: run.id,
      organizationId,
      approvalRequestId: approval.id
    });
    await queueService.enqueueCancel({
      workflowRunId: run.id,
      organizationId,
      reason: 'Diagnostics test.'
    });

    const response = await request(app.getHttpServer())
      .get(`/workflow-runs/${run.id}/queue`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      workflowRunId: run.id,
      organizationId,
      jobs: {
        start: {
          queueName: WORKFLOW_QUEUE_NAMES.runs,
          jobId: workflowStartJobId(run.id),
          state: expect.any(String)
        },
        cancel: {
          queueName: WORKFLOW_QUEUE_NAMES.maintenance,
          jobId: workflowCancelJobId(run.id),
          state: expect.any(String)
        },
        resume: [
          {
            queueName: WORKFLOW_QUEUE_NAMES.resume,
            jobId: workflowResumeJobId(run.id, approval.id),
            state: expect.any(String)
          }
        ]
      }
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('workerRunToken');
    expect(serialized).not.toContain(config.config.workerInternalToken);
    expect(serialized).not.toContain('workflow.run.start');
    expect(response.body.data.jobs.start).not.toHaveProperty('data');
    expect(response.body.data.jobs.cancel).not.toHaveProperty('data');
    expect(response.body.data.jobs.resume[0]).not.toHaveProperty('data');
  });

  async function createRun(status: WorkflowRunStatus) {
    return database.client.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        agentId,
        vendorId,
        status,
        startedAt: status === WorkflowRunStatus.RUNNING ? new Date() : undefined,
        completedAt: status === WorkflowRunStatus.CANCELED ? new Date() : undefined,
        stateJson: {}
      }
    });
  }

  async function createApproval(workflowRunId: string) {
    const attempt = await database.client.actionAttempt.create({
      data: {
        organizationId,
        workflowRunId,
        agentId,
        vendorId,
        website: 'http://localhost:4202/billing',
        actionType: ActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        metadataJson: {}
      }
    });

    return database.client.approvalRequest.create({
      data: {
        organizationId,
        workflowRunId,
        actionAttemptId: attempt.id,
        status: ApprovalStatus.APPROVED,
        requestedByAgentId: agentId,
        summary: 'Approved diagnostic resume.',
        riskLevel: RiskLevel.HIGH,
        approvedAt: new Date()
      }
    });
  }
});
