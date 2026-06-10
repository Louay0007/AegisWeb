import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import {
  ActionType as PrismaActionType,
  AgentStatus,
  ApprovalStatus,
  CredentialStatus,
  CredentialType,
  PolicyDecision,
  PolicyStatus,
  PolicyType,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  WORKFLOW_QUEUE_JOB_NAMES,
  WORKFLOW_QUEUE_NAMES,
  WorkflowQueueJobData
} from '@agentpass/domain';
import { encryptSecret } from '@agentpass/vault';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { workflowResumeJobId } from '../apps/api/src/queue/workflow-queue.types.js';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';

const validSecret = {
  username: 'finance@northstarlabs.dev',
  password: 'acme-local-password'
};

describe('phase 26 plan downgrade approval workflow', () => {
  let api: INestApplication;
  let sandbox: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let worker: WorkerService;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let runQueue: Queue<WorkflowQueueJobData>;
  let resumeQueue: Queue<WorkflowQueueJobData>;
  let baseUrl: string;
  let ownerToken: string;
  let approverToken: string;
  let ownerId: string;
  let organizationId: string;
  let agentId: string;
  let vendorId: string;
  let previousRedisUrl: string | undefined;
  let previousApiBaseUrl: string | undefined;
  let previousVendorSandboxUrl: string | undefined;

  beforeAll(async () => {
    previousRedisUrl = process.env.REDIS_URL;
    previousApiBaseUrl = process.env.API_BASE_URL;
    previousVendorSandboxUrl = process.env.VENDOR_SANDBOX_URL;
    process.env.REDIS_URL = redisDbUrl(previousRedisUrl ?? 'redis://localhost:6379', 12);

    const sandboxModule = await Test.createTestingModule({
      imports: [VendorSandboxModule]
    }).compile();
    sandbox = sandboxModule.createNestApplication();
    await sandbox.init();
    await sandbox.listen(0, '127.0.0.1');
    const sandboxAddress = sandbox.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${sandboxAddress.port}`;
    process.env.VENDOR_SANDBOX_URL = baseUrl;

    const apiModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    api = apiModule.createNestApplication();
    await api.init();
    await api.listen(0, '127.0.0.1');
    const apiAddress = api.getHttpServer().address() as AddressInfo;
    process.env.API_BASE_URL = `http://127.0.0.1:${apiAddress.port}`;

    database = api.get(DatabaseService);
    tokenService = api.get(TokenService);
    config = api.get(ConfigService);
    const connection = connectionFromRedisUrl(config.redisUrl);
    runQueue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.runs, { connection });
    resumeQueue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.resume, { connection });
    await Promise.all([runQueue.drain(true), resumeQueue.drain(true)]);

    workerApp = await createWorkerApplicationContext();
    worker = workerApp.get(WorkerService);
    await worker.start();

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Twenty Six Org',
        domain: `phase26-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const [owner, approver] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId,
          email: `owner-${unique}@phase26.dev`,
          name: 'Phase Twenty Six Owner',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId,
          email: `approver-${unique}@phase26.dev`,
          name: 'Phase Twenty Six Approver',
          role: UserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerId = owner.id;
    ownerToken = signFor(owner.id, owner.organizationId, owner.role, owner.email);
    approverToken = signFor(approver.id, approver.organizationId, approver.role, approver.email);

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Twenty Six Procurement Bot',
          identifier: `phase26-procurement-bot-${unique}@agentpass.local`,
          purpose: 'Prepare and submit approved plan downgrades.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Twenty Six Acme',
          website: baseUrl,
          category: VendorCategory.ANALYTICS
        }
      })
    ]);
    agentId = agent.id;
    vendorId = vendor.id;

    await createActivePolicy();
  }, 30000);

  afterAll(async () => {
    await worker.stop();
    await Promise.all([runQueue.close(), resumeQueue.close()]);
    await workerApp.close();
    await api.close();
    await sandbox.close();

    restoreEnv('REDIS_URL', previousRedisUrl);
    restoreEnv('API_BASE_URL', previousApiBaseUrl);
    restoreEnv('VENDOR_SANDBOX_URL', previousVendorSandboxUrl);
  });

  it('pauses for approval, resumes after approval, submits downgrade once, and creates a receipt', async () => {
    const workflowId = await createPlanDowngradeWorkflow();
    const runId = await startRun(workflowId);

    await waitForRunStatus(runId, WorkflowRunStatus.WAITING_FOR_APPROVAL);
    const approval = await waitForApproval(runId, ApprovalStatus.PENDING);
    expect(approval).toMatchObject({
      summary: 'Downgrade Acme Analytics from Growth to Starter.',
      amountCents: 48000
    });
    expect(approval.screenshotFileId).toEqual(expect.any(String));

    const changePlanAttempt = await database.client.actionAttempt.findUniqueOrThrow({
      where: { id: approval.actionAttemptId }
    });
    expect(changePlanAttempt).toMatchObject({
      actionType: PrismaActionType.CHANGE_PLAN,
      policyDecision: PolicyDecision.REQUIRE_APPROVAL
    });

    const pendingList = await request(api.getHttpServer())
      .get('/approvals')
      .query({ status: 'pending', workflowRunId: runId })
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);
    expect(pendingList.body.data.map((item: { id: string }) => item.id)).toContain(approval.id);

    const approved = await request(api.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Approved for savings.' })
      .expect(201);
    expect(approved.body.data.resumeJobId).toBe(workflowResumeJobId(runId, approval.id));

    const completed = await waitForRunStatus(runId, WorkflowRunStatus.COMPLETED);
    expect(completed).toMatchObject({
      currentStep: 'downgrade_completed',
      resultSummary: 'Approved sandbox downgrade submitted.'
    });

    const allowedSubmits = await countAllowedSubmitAttempts(runId);
    expect(allowedSubmits).toBe(1);

    const receipt = await waitForReceipt(runId);
    expect(receipt).toMatchObject({
      finalStatus: 'COMPLETED',
      summary: 'Approved sandbox downgrade submitted.'
    });
    expect(receipt.approvalDetailsJson).toMatchObject({
      resultJson: expect.objectContaining({
        approvalRequestId: approval.id,
        status: 'submitted'
      }),
      approvals: [
        expect.objectContaining({
          id: approval.id,
          status: ApprovalStatus.APPROVED,
          summary: 'Downgrade Acme Analytics from Growth to Starter.'
        })
      ]
    });
    expect(receipt.policyDecisionsJson).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: PrismaActionType.CHANGE_PLAN, policyDecision: PolicyDecision.REQUIRE_APPROVAL }),
        expect.objectContaining({ actionType: PrismaActionType.CHANGE_PLAN, policyDecision: PolicyDecision.ALLOW })
      ])
    );

    const duplicateJob = await resumeQueue.add(
      WORKFLOW_QUEUE_JOB_NAMES.resume,
      {
        workflowRunId: runId,
        organizationId,
        mode: 'resume',
        approvalRequestId: approval.id,
        attempt: 2,
        requestedAt: new Date().toISOString()
      },
      { jobId: `phase26-duplicate-resume-${runId}`, removeOnComplete: 100, removeOnFail: 100 }
    );
    await waitForJobState(duplicateJob, 'completed');
    expect(await countAllowedSubmitAttempts(runId)).toBe(1);
  }, 45000);

  it('marks the run denied when approval is rejected', async () => {
    const workflowId = await createPlanDowngradeWorkflow();
    const runId = await startRun(workflowId);
    await waitForRunStatus(runId, WorkflowRunStatus.WAITING_FOR_APPROVAL);
    const approval = await waitForApproval(runId, ApprovalStatus.PENDING);

    await request(api.getHttpServer())
      .post(`/approvals/${approval.id}/reject`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Do not change plans.' })
      .expect(201);

    const denied = await waitForRunStatus(runId, WorkflowRunStatus.DENIED);
    expect(denied).toMatchObject({
      currentStep: 'approval_rejected',
      errorMessage: 'Do not change plans.'
    });
    expect(await countAllowedSubmitAttempts(runId)).toBe(0);
  }, 30000);

  it('does not approve or resume an expired approval', async () => {
    const workflowId = await createPlanDowngradeWorkflow();
    const runId = await startRun(workflowId);
    await waitForRunStatus(runId, WorkflowRunStatus.WAITING_FOR_APPROVAL);
    const approval = await waitForApproval(runId, ApprovalStatus.PENDING);

    await database.client.approvalRequest.update({
      where: { id: approval.id },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    const response = await request(api.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Too late.' })
      .expect(400);
    expect(response.body.error.message).toBe('Expired approvals cannot be decided.');

    const expired = await database.client.approvalRequest.findUniqueOrThrow({ where: { id: approval.id } });
    expect(expired.status).toBe(ApprovalStatus.EXPIRED);
    expect(await countAllowedSubmitAttempts(runId)).toBe(0);
  }, 30000);

  it('stops resume when the agent is paused before approval resumes', async () => {
    const workflowId = await createPlanDowngradeWorkflow();
    const runId = await startRun(workflowId);
    await waitForRunStatus(runId, WorkflowRunStatus.WAITING_FOR_APPROVAL);
    const approval = await waitForApproval(runId, ApprovalStatus.PENDING);

    await database.client.agent.update({
      where: { id: agentId },
      data: { status: AgentStatus.PAUSED }
    });

    await request(api.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Approved, but agent is paused.' })
      .expect(201);

    const failed = await waitForRunStatus(runId, WorkflowRunStatus.FAILED);
    expect(failed).toMatchObject({
      currentStep: 'plan_downgrade_failed',
      errorMessage: 'Agent must be active to resume workflow runs.'
    });
    expect(await countAllowedSubmitAttempts(runId)).toBe(0);

    await database.client.agent.update({
      where: { id: agentId },
      data: { status: AgentStatus.ACTIVE }
    });
  }, 30000);

  async function createActivePolicy(): Promise<void> {
    await database.client.policy.create({
      data: {
        organizationId,
        agentId,
        name: 'Phase Twenty Six Standard Policy',
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE,
        rulesJson: {
          allowedDomains: ['127.0.0.1'],
          allowedActions: ['open_page', 'read_page', 'download_file', 'credential_injection'],
          approvalRequiredActions: ['change_plan'],
          deniedActions: ['invite_user', 'change_billing_details'],
          autoApproveBelowCents: 0,
          approvalRequiredAboveCents: 1,
          denyAboveCents: 100000,
          dangerKeywords: ['downgrade', 'cancel']
        },
        createdByUserId: ownerId
      }
    });
  }

  async function createPlanDowngradeWorkflow(): Promise<string> {
    const encryptedPayload = encryptSecret(validSecret, config.config.vaultMasterKey);
    const credential = await database.client.credential.create({
      data: {
        organizationId,
        vendorId,
        label: `Phase Twenty Six Login ${crypto.randomUUID()}`,
        credentialType: CredentialType.USERNAME_PASSWORD,
        encryptedPayload,
        encryptionVersion: encryptedPayload.key_version,
        status: CredentialStatus.ACTIVE,
        createdByUserId: ownerId
      }
    });
    await database.client.credentialAgentGrant.create({
      data: {
        credentialId: credential.id,
        agentId,
        scope: 'login',
        createdByUserId: ownerId
      }
    });

    const workflow = await database.client.workflow.create({
      data: {
        organizationId,
        agentId,
        vendorId,
        name: `Phase Twenty Six Downgrade Workflow ${crypto.randomUUID()}`,
        template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {
          credentialId: credential.id,
          targetPlan: 'Starter'
        },
        createdByUserId: ownerId
      }
    });

    return workflow.id;
  }

  async function startRun(workflowId: string): Promise<string> {
    const response = await request(api.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    return response.body.data.run.id as string;
  }

  async function waitForRunStatus(runId: string, status: WorkflowRunStatus) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === status) {
        return run;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const run = await database.client.workflowRun.findUnique({ where: { id: runId } });
    throw new Error(`Workflow run ${runId} did not reach ${status}. Last status: ${run?.status ?? 'missing'}`);
  }

  async function waitForApproval(runId: string, status: ApprovalStatus) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const approval = await database.client.approvalRequest.findFirst({
        where: { workflowRunId: runId, status },
        orderBy: { createdAt: 'desc' }
      });
      if (approval) {
        return approval;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Approval for workflow run ${runId} did not reach ${status}.`);
  }

  async function waitForReceipt(runId: string) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const receipt = await database.client.receipt.findUnique({ where: { workflowRunId: runId } });
      if (receipt) {
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Receipt for workflow run ${runId} was not created.`);
  }

  async function waitForJobState(job: Job<WorkflowQueueJobData>, state: string): Promise<void> {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if ((await job.getState()) === state) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Job ${job.id} did not reach ${state}.`);
  }

  async function countAllowedSubmitAttempts(runId: string): Promise<number> {
    return database.client.actionAttempt.count({
      where: {
        workflowRunId: runId,
        actionType: PrismaActionType.CHANGE_PLAN,
        policyDecision: PolicyDecision.ALLOW
      }
    });
  }

  function signFor(userId: string, orgId: string, role: string, email: string): string {
    return tokenService.signAccessToken({
      sub: userId,
      userId,
      organizationId: orgId,
      role,
      email
    });
  }
});

function redisDbUrl(redisUrl: string, db: number): string {
  const url = new URL(redisUrl);
  url.pathname = `/${db}`;
  return url.toString();
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
