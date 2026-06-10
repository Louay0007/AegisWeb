import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  ActionType,
  AgentStatus,
  ApprovalStatus,
  CredentialStatus,
  CredentialType,
  FileKind,
  PolicyDecision,
  PolicyStatus,
  PolicyType,
  ReceiptStatus,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WORKFLOW_QUEUE_NAMES, WorkflowQueueJobData } from '@agentpass/domain';
import { encryptSecret } from '@agentpass/vault';
import { AppModule } from '../apps/api/src/app.module.js';
import { PasswordService } from '../apps/api/src/auth/password.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';

const loginPassword = 'Password123!';
const vendorCredentials = {
  username: 'finance@northstarlabs.dev',
  password: 'acme-local-password'
};
const mailpitApiBaseUrl = 'http://localhost:8025/api/v1';

describe('MVP backend acceptance flow', () => {
  let api: INestApplication;
  let sandbox: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let worker: WorkerService;
  let database: DatabaseService;
  let passwordService: PasswordService;
  let config: ConfigService;
  let runQueue: Queue<WorkflowQueueJobData>;
  let resumeQueue: Queue<WorkflowQueueJobData>;
  let sandboxBaseUrl: string;
  let previousRedisUrl: string | undefined;
  let previousApiBaseUrl: string | undefined;
  let previousVendorSandboxUrl: string | undefined;

  beforeAll(async () => {
    await ensureMailpitReady();
    await clearMailpitInbox();

    previousRedisUrl = process.env.REDIS_URL;
    previousApiBaseUrl = process.env.API_BASE_URL;
    previousVendorSandboxUrl = process.env.VENDOR_SANDBOX_URL;
    process.env.REDIS_URL = redisDbUrl(previousRedisUrl ?? 'redis://localhost:6379', 14);

    const sandboxModule = await Test.createTestingModule({
      imports: [VendorSandboxModule]
    }).compile();
    sandbox = sandboxModule.createNestApplication();
    await sandbox.init();
    await sandbox.listen(0, '127.0.0.1');
    const sandboxAddress = sandbox.getHttpServer().address() as AddressInfo;
    sandboxBaseUrl = `http://127.0.0.1:${sandboxAddress.port}`;
    process.env.VENDOR_SANDBOX_URL = sandboxBaseUrl;

    const apiModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    api = apiModule.createNestApplication();
    await api.init();
    await api.listen(0, '127.0.0.1');
    const apiAddress = api.getHttpServer().address() as AddressInfo;
    process.env.API_BASE_URL = `http://127.0.0.1:${apiAddress.port}`;

    database = api.get(DatabaseService);
    passwordService = api.get(PasswordService);
    config = api.get(ConfigService);

    const connection = connectionFromRedisUrl(config.redisUrl);
    runQueue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.runs, { connection });
    resumeQueue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.resume, { connection });
    await Promise.all([runQueue.drain(true), resumeQueue.drain(true)]);

    workerApp = await createWorkerApplicationContext();
    worker = workerApp.get(WorkerService);
    await worker.start();
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

  it('runs the complete local MVP demo from login to approval, receipt, and Mailpit notification', async () => {
    const fixture = await createAcceptanceWorkspace();
    const ownerToken = await login(fixture.ownerEmail);
    const approverToken = await login(fixture.approverEmail);

    const start = await request(api.getHttpServer())
      .post(`/workflows/${fixture.workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const runId = start.body.data.run.id as string;
    expect(start.body.data.run.status).toBe('queued');

    await waitForRunStatus(runId, WorkflowRunStatus.WAITING_FOR_APPROVAL);
    const approval = await waitForApproval(runId);
    expect(approval).toMatchObject({
      status: ApprovalStatus.PENDING,
      summary: 'Downgrade Acme Analytics from Growth to Starter.',
      amountCents: 48000
    });

    const mail = await waitForMailpitMessage('Approval required: Downgrade Acme Analytics from Growth to Starter.', [
      fixture.ownerEmail,
      fixture.approverEmail
    ]);
    expect(mail.To.map((recipient) => recipient.Address)).toEqual(
      expect.arrayContaining([fixture.ownerEmail, fixture.approverEmail])
    );
    expect(mail.Snippet).toContain('Downgrade Acme Analytics from Growth to Starter.');
    expect(mail.Snippet).not.toContain(vendorCredentials.password);

    const approvals = await request(api.getHttpServer())
      .get('/approvals')
      .query({ status: 'pending', workflowRunId: runId })
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);
    expect(approvals.body.data.map((item: { id: string }) => item.id)).toContain(approval.id);

    await request(api.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Approved in MVP acceptance demo.' })
      .expect(201);

    const completed = await waitForRunStatus(runId, WorkflowRunStatus.COMPLETED);
    expect(completed).toMatchObject({
      currentStep: 'downgrade_completed',
      resultSummary: 'Approved sandbox downgrade submitted.'
    });

    const receiptRecord = await waitForReceipt(runId);
    expect(receiptRecord).toMatchObject({
      finalStatus: ReceiptStatus.COMPLETED,
      summary: 'Approved sandbox downgrade submitted.'
    });

    const receipt = await request(api.getHttpServer())
      .get(`/receipts/${receiptRecord.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const receiptJson = JSON.stringify(receipt.body);
    expect(receipt.body.data).toMatchObject({
      id: receiptRecord.id,
      finalStatus: 'completed',
      approvalDetails: {
        approvals: [
          expect.objectContaining({
            id: approval.id,
            status: ApprovalStatus.APPROVED
          })
        ]
      }
    });
    expect(receiptJson).toContain('Approved sandbox downgrade submitted.');
    expect(receiptJson).not.toContain(vendorCredentials.password);

    const files = await database.client.file.findMany({
      where: { workflowRunId: runId },
      select: { kind: true }
    });
    expect(files.map((file) => file.kind)).toEqual(expect.arrayContaining([FileKind.SCREENSHOT]));

    const submitAttempts = await database.client.actionAttempt.count({
      where: {
        workflowRunId: runId,
        actionType: ActionType.CHANGE_PLAN,
        policyDecision: PolicyDecision.ALLOW
      }
    });
    expect(submitAttempts).toBe(1);
  }, 60000);

  async function createAcceptanceWorkspace(): Promise<{
    ownerEmail: string;
    approverEmail: string;
    workflowId: string;
  }> {
    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'MVP Acceptance Org',
        domain: `mvp-acceptance-${unique}.dev`,
        plan: 'local'
      }
    });

    const ownerEmail = `owner-${unique}@mvp-acceptance.dev`;
    const approverEmail = `approver-${unique}@mvp-acceptance.dev`;
    const passwordHash = await passwordService.hashPassword(loginPassword);

    const [owner] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organization.id,
          email: ownerEmail,
          name: 'MVP Acceptance Owner',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organization.id,
          email: approverEmail,
          name: 'MVP Acceptance Approver',
          role: UserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash
        }
      })
    ]);

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organization.id,
          name: 'MVP Procurement Bot',
          identifier: `mvp-procurement-bot-${unique}@agentpass.local`,
          purpose: 'Run the complete MVP downgrade acceptance flow.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organization.id,
          name: 'MVP Acme Analytics',
          website: sandboxBaseUrl,
          category: VendorCategory.ANALYTICS
        }
      })
    ]);

    await database.client.policy.create({
      data: {
        organizationId: organization.id,
        agentId: agent.id,
        name: 'MVP Acceptance Policy',
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
        createdByUserId: owner.id
      }
    });

    const encryptedPayload = encryptSecret(vendorCredentials, config.config.vaultMasterKey);
    const credential = await database.client.credential.create({
      data: {
        organizationId: organization.id,
        vendorId: vendor.id,
        label: 'MVP Acme Login',
        credentialType: CredentialType.USERNAME_PASSWORD,
        encryptedPayload,
        encryptionVersion: encryptedPayload.key_version,
        status: CredentialStatus.ACTIVE,
        createdByUserId: owner.id
      }
    });
    await database.client.credentialAgentGrant.create({
      data: {
        credentialId: credential.id,
        agentId: agent.id,
        scope: 'login',
        createdByUserId: owner.id
      }
    });

    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organization.id,
        agentId: agent.id,
        vendorId: vendor.id,
        name: 'MVP Acme Downgrade Request',
        template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {
          credentialId: credential.id,
          targetPlan: 'Starter'
        },
        createdByUserId: owner.id
      }
    });

    return { ownerEmail, approverEmail, workflowId: workflow.id };
  }

  async function login(email: string): Promise<string> {
    const response = await request(api.getHttpServer())
      .post('/auth/login')
      .send({ email, password: loginPassword })
      .expect(201);

    return response.body.data.accessToken as string;
  }

  async function waitForRunStatus(runId: string, status: WorkflowRunStatus) {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === status) {
        return run;
      }
      await sleep(150);
    }

    const run = await database.client.workflowRun.findUnique({ where: { id: runId } });
    throw new Error(`Workflow run ${runId} did not reach ${status}. Last status: ${run?.status ?? 'missing'}`);
  }

  async function waitForApproval(runId: string) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const approval = await database.client.approvalRequest.findFirst({
        where: { workflowRunId: runId },
        orderBy: { createdAt: 'desc' }
      });
      if (approval) {
        return approval;
      }
      await sleep(100);
    }

    throw new Error(`Approval for workflow run ${runId} was not created.`);
  }

  async function waitForReceipt(runId: string) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const receipt = await database.client.receipt.findUnique({ where: { workflowRunId: runId } });
      if (receipt) {
        return receipt;
      }
      await sleep(100);
    }

    throw new Error(`Receipt for workflow run ${runId} was not created.`);
  }
});

type MailpitAddress = {
  Name: string;
  Address: string;
};

type MailpitMessage = {
  ID: string;
  Subject: string;
  Snippet: string;
  To: MailpitAddress[];
};

type MailpitMessagesResponse = {
  messages?: MailpitMessage[];
};

async function ensureMailpitReady(): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://localhost:8025/livez');
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling while Docker finishes exposing the port.
    }
    await sleep(250);
  }

  throw new Error('Mailpit was not reachable on http://localhost:8025.');
}

async function clearMailpitInbox(): Promise<void> {
  const response = await fetch(`${mailpitApiBaseUrl}/messages`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to clear Mailpit inbox: HTTP ${response.status}`);
  }
}

async function waitForMailpitMessage(subject: string, expectedRecipients: string[]): Promise<MailpitMessage> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitApiBaseUrl}/messages`);
    if (response.ok) {
      const body = (await response.json()) as MailpitMessagesResponse;
      const message = body.messages?.find((item) => {
        const recipients = new Set(item.To.map((recipient) => recipient.Address));
        return item.Subject === subject && expectedRecipients.every((recipient) => recipients.has(recipient));
      });
      if (message) {
        return message;
      }
    }
    await sleep(250);
  }

  throw new Error(`Mailpit message with subject "${subject}" for ${expectedRecipients.join(', ')} was not received.`);
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
