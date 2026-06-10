import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  AgentStatus,
  AuditEventType,
  CredentialStatus,
  CredentialType,
  FileKind,
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
import { encryptSecret } from '@agentpass/vault';
import { WORKFLOW_QUEUE_NAMES, WorkflowQueueJobData } from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { FileStorageService } from '../apps/api/src/files/file-storage.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';

const validSecret = {
  username: 'finance@northstarlabs.dev',
  password: 'acme-local-password'
};

describe('phase 24 invoice download workflow', () => {
  let api: INestApplication;
  let sandbox: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let worker: WorkerService;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let storage: FileStorageService;
  let queue: Queue<WorkflowQueueJobData>;
  let baseUrl: string;
  let ownerToken: string;
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
    process.env.REDIS_URL = redisDbUrl(previousRedisUrl ?? 'redis://localhost:6379', 10);

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
    storage = api.get(FileStorageService);
    queue = new Queue<WorkflowQueueJobData>(WORKFLOW_QUEUE_NAMES.runs, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });
    await queue.drain(true);

    workerApp = await createWorkerApplicationContext();
    worker = workerApp.get(WorkerService);
    await worker.start();

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Twenty Four Org',
        domain: `phase24-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const owner = await database.client.user.create({
      data: {
        organizationId,
        email: `owner-${unique}@phase24.dev`,
        name: 'Phase Twenty Four Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: 'unused'
      }
    });
    ownerId = owner.id;
    ownerToken = tokenService.signAccessToken({
      sub: owner.id,
      userId: owner.id,
      organizationId,
      role: owner.role,
      email: owner.email
    });

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Twenty Four Invoice Bot',
          identifier: `phase24-invoice-bot-${unique}@agentpass.local`,
          purpose: 'Download vendor invoices end to end.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Twenty Four Acme',
          website: baseUrl,
          category: VendorCategory.ANALYTICS
        }
      })
    ]);
    agentId = agent.id;
    vendorId = vendor.id;
  }, 30000);

  afterAll(async () => {
    await worker.stop();
    await queue.close();
    await workerApp.close();
    await api.close();
    await sandbox.close();

    restoreEnv('REDIS_URL', previousRedisUrl);
    restoreEnv('API_BASE_URL', previousApiBaseUrl);
    restoreEnv('VENDOR_SANDBOX_URL', previousVendorSandboxUrl);
  });

  it('runs invoice download from API request to completed run, files, audit, and receipt', async () => {
    const workflowId = await createInvoiceWorkflow({
      policyDomains: ['127.0.0.1'],
      secretJson: validSecret
    });

    const started = await request(api.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const runId = started.body.data.run.id as string;

    const completed = await waitForRunStatus(runId, WorkflowRunStatus.COMPLETED);
    expect(completed).toMatchObject({
      currentStep: 'invoice_download_completed',
      resultSummary: 'Downloaded latest invoice acme-latest-invoice.pdf.'
    });

    const files = await database.client.file.findMany({
      where: { workflowRunId: runId },
      orderBy: { createdAt: 'asc' }
    });
    expect(files.map((file) => file.kind)).toEqual(expect.arrayContaining([FileKind.INVOICE, FileKind.SCREENSHOT]));
    const invoice = files.find((file) => file.kind === FileKind.INVOICE);
    expect(invoice).toBeTruthy();
    expect(invoice).toMatchObject({
      mimeType: 'application/pdf',
      sizeBytes: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    await expect(storage.objectExists(invoice!.bucket, invoice!.objectKey)).resolves.toBe(true);

    const receipt = await waitForReceipt(runId);
    expect(receipt).toMatchObject({
      organizationId,
      workflowRunId: runId,
      finalStatus: 'COMPLETED',
      summary: `Invoice download completed for workflow run ${runId}.`
    });
    expect(JSON.stringify(receipt)).not.toContain(validSecret.password);
    await waitForAuditEvent(runId, AuditEventType.RECEIPT_CREATED);

    const eventTypes = await database.client.auditEvent.findMany({
      where: { organizationId, workflowRunId: runId },
      select: { eventType: true },
      orderBy: { createdAt: 'asc' }
    });
    expect(eventTypes.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        AuditEventType.WORKFLOW_RUN_STARTED,
        AuditEventType.CREDENTIAL_USED,
        AuditEventType.FILE_DOWNLOADED,
        AuditEventType.WORKFLOW_RUN_COMPLETED,
        AuditEventType.RECEIPT_CREATED
      ])
    );

    const approvals = await database.client.approvalRequest.count({ where: { workflowRunId: runId } });
    expect(approvals).toBe(0);
  }, 30000);

  it('marks the run failed and creates an error receipt for wrong credentials', async () => {
    const workflowId = await createInvoiceWorkflow({
      policyDomains: ['127.0.0.1'],
      secretJson: {
        username: validSecret.username,
        password: 'wrong-password'
      }
    });

    const started = await request(api.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const runId = started.body.data.run.id as string;

    const failed = await waitForRunStatus(runId, WorkflowRunStatus.FAILED);
    expect(failed).toMatchObject({
      currentStep: 'invoice_download_failed',
      errorMessage: 'Sandbox login failed.'
    });

    const receipt = await waitForReceipt(runId);
    expect(receipt).toMatchObject({
      finalStatus: 'FAILED',
      summary: 'Invoice download failed: Sandbox login failed.'
    });
    expect(JSON.stringify(receipt)).not.toContain('wrong-password');
  }, 30000);

  it('marks the run denied and creates a denied receipt for disallowed vendor domains', async () => {
    const workflowId = await createInvoiceWorkflow({
      policyDomains: ['example.com'],
      secretJson: validSecret
    });

    const started = await request(api.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const runId = started.body.data.run.id as string;

    const denied = await waitForRunStatus(runId, WorkflowRunStatus.DENIED);
    expect(denied).toMatchObject({
      currentStep: 'policy_denied',
      errorMessage: 'Vendor domain is not allowed by policy.'
    });

    const receipt = await waitForReceipt(runId);
    expect(receipt).toMatchObject({
      finalStatus: 'DENIED',
      summary: 'Invoice download denied: Vendor domain is not allowed by policy.'
    });

    const credentialUsed = await database.client.auditEvent.count({
      where: { workflowRunId: runId, eventType: AuditEventType.CREDENTIAL_USED }
    });
    expect(credentialUsed).toBe(0);
  }, 30000);

  async function createInvoiceWorkflow(input: {
    policyDomains: string[];
    secretJson: { username: string; password: string };
  }): Promise<string> {
    await database.client.policy.updateMany({
      where: {
        organizationId,
        agentId,
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE
      },
      data: { status: PolicyStatus.ARCHIVED }
    });
    await database.client.policy.create({
      data: {
        organizationId,
        agentId,
        name: `Phase Twenty Four Policy ${crypto.randomUUID()}`,
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE,
        rulesJson: {
          allowedDomains: input.policyDomains,
          allowedActions: ['open_page', 'read_page', 'download_file', 'credential_injection'],
          deniedActions: ['invite_user', 'change_billing_details'],
          approvalRequiredActions: [],
          autoApproveBelowCents: 0,
          approvalRequiredAboveCents: 0,
          denyAboveCents: 100000,
          dangerKeywords: []
        },
        createdByUserId: ownerId
      }
    });

    const encryptedPayload = encryptSecret(input.secretJson, config.config.vaultMasterKey);
    const credential = await database.client.credential.create({
      data: {
        organizationId,
        vendorId,
        label: `Phase Twenty Four Login ${crypto.randomUUID()}`,
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
        name: `Phase Twenty Four Invoice Workflow ${crypto.randomUUID()}`,
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: { credentialId: credential.id },
        createdByUserId: ownerId
      }
    });

    return workflow.id;
  }

  async function waitForRunStatus(runId: string, status: WorkflowRunStatus) {
    const deadline = Date.now() + 15000;
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

  async function waitForReceipt(runId: string) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const receipt = await database.client.receipt.findUnique({ where: { workflowRunId: runId } });
      if (receipt) {
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Receipt for workflow run ${runId} was not created.`);
  }

  async function waitForAuditEvent(runId: string, eventType: AuditEventType) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const event = await database.client.auditEvent.findFirst({
        where: { workflowRunId: runId, eventType }
      });
      if (event) {
        return event;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Audit event ${eventType} for workflow run ${runId} was not created.`);
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
