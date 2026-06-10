import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  ActionType as PrismaActionType,
  AgentStatus,
  AuditEventType,
  CredentialStatus,
  CredentialType,
  FileKind,
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
import { WORKFLOW_QUEUE_NAMES, WorkflowQueueJobData } from '@agentpass/domain';
import { encryptSecret } from '@agentpass/vault';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { parseRenewalInfo } from '../apps/worker/src/connector/sandbox-vendor.connector.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';
import { buildRenewalResult } from '../apps/worker/src/workflow-executor/workflow-executor.service.js';

const validSecret = {
  username: 'finance@northstarlabs.dev',
  password: 'acme-local-password'
};

const expectedRenewal = {
  vendorName: 'Acme Analytics',
  currentPlan: 'Growth',
  currentMonthlyPriceCents: 80000,
  renewalMonthlyPriceCents: 110000,
  renewalDate: '2026-07-15',
  seatCount: 28,
  unusedSeats: 5,
  estimatedMonthlySavingsCents: 48000,
  recommendation: 'downgrade_to_starter'
};

describe('phase 25 renewal check workflow', () => {
  let api: INestApplication;
  let sandbox: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let worker: WorkerService;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
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
    process.env.REDIS_URL = redisDbUrl(previousRedisUrl ?? 'redis://localhost:6379', 11);

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
        name: 'Phase Twenty Five Org',
        domain: `phase25-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const owner = await database.client.user.create({
      data: {
        organizationId,
        email: `owner-${unique}@phase25.dev`,
        name: 'Phase Twenty Five Owner',
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
          name: 'Phase Twenty Five Renewal Bot',
          identifier: `phase25-renewal-bot-${unique}@agentpass.local`,
          purpose: 'Extract renewal data from vendor portals.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Twenty Five Acme',
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

  it('parses renewal data and rejects missing fields with a controlled error', () => {
    expect(parseRenewalInfo(JSON.stringify(expectedRenewal))).toEqual(expectedRenewal);
    let thrown: unknown;
    try {
      parseRenewalInfo(JSON.stringify({ ...expectedRenewal, currentPlan: undefined }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Sandbox renewal data is missing currentPlan.'
    });
  });

  it('calculates price increase and savings opportunity from extracted renewal data', () => {
    expect(buildRenewalResult(expectedRenewal)).toEqual({
      ...expectedRenewal,
      monthlyPriceIncreaseCents: 30000,
      monthlyPriceIncreasePercent: 37.5,
      annualizedSavingsOpportunityCents: 576000
    });
  });

  it('runs renewal check from API request to completed run, result summary, audit, and receipt', async () => {
    const workflowId = await createRenewalWorkflow();

    const started = await request(api.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const runId = started.body.data.run.id as string;

    const completed = await waitForRunStatus(runId, WorkflowRunStatus.COMPLETED);
    const result = buildRenewalResult(expectedRenewal);
    expect(completed).toMatchObject({
      currentStep: 'renewal_check_completed',
      resultSummary:
        'Acme Analytics renews on 2026-07-15: monthly price increases by $300.00, with $480.00 monthly savings opportunity.',
      stateJson: {
        workerTransitions: [
          expect.objectContaining({
            renewalResult: result
          })
        ]
      }
    });

    const receipt = await waitForReceipt(runId);
    expect(receipt).toMatchObject({
      finalStatus: 'COMPLETED',
      summary:
        'Acme Analytics renews on 2026-07-15: monthly price increases by $300.00, with $480.00 monthly savings opportunity.'
    });
    expect(receipt.approvalDetailsJson).toMatchObject({
      resultJson: result,
      approvals: []
    });
    expect(JSON.stringify(receipt)).not.toContain(validSecret.password);

    const screenshotCount = await database.client.file.count({
      where: { workflowRunId: runId, kind: FileKind.SCREENSHOT }
    });
    expect(screenshotCount).toBeGreaterThanOrEqual(1);

    const readAttempt = await database.client.actionAttempt.findFirst({
      where: {
        workflowRunId: runId,
        actionType: PrismaActionType.READ_PAGE
      }
    });
    expect(readAttempt).toMatchObject({
      policyDecision: PolicyDecision.ALLOW,
      outputSummary: 'Sandbox renewal data extracted.'
    });

    const policyEvents = await database.client.auditEvent.findMany({
      where: {
        workflowRunId: runId,
        eventType: AuditEventType.POLICY_EVALUATED
      },
      select: { eventDataJson: true }
    });
    expect(policyEvents.map((event) => event.eventDataJson)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: 'open_page', decision: 'allow' }),
        expect.objectContaining({ actionType: 'read_page', decision: 'allow' })
      ])
    );

    const approvals = await database.client.approvalRequest.count({ where: { workflowRunId: runId } });
    expect(approvals).toBe(0);
  }, 30000);

  async function createRenewalWorkflow(): Promise<string> {
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
        name: `Phase Twenty Five Policy ${crypto.randomUUID()}`,
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE,
        rulesJson: {
          allowedDomains: ['127.0.0.1'],
          allowedActions: ['open_page', 'read_page', 'credential_injection'],
          deniedActions: ['invite_user', 'change_billing_details'],
          approvalRequiredActions: ['change_plan'],
          autoApproveBelowCents: 0,
          approvalRequiredAboveCents: 0,
          denyAboveCents: 100000,
          dangerKeywords: []
        },
        createdByUserId: ownerId
      }
    });

    const encryptedPayload = encryptSecret(validSecret, config.config.vaultMasterKey);
    const credential = await database.client.credential.create({
      data: {
        organizationId,
        vendorId,
        label: `Phase Twenty Five Login ${crypto.randomUUID()}`,
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
        name: `Phase Twenty Five Renewal Workflow ${crypto.randomUUID()}`,
        template: WorkflowTemplate.SAAS_RENEWAL_CHECK,
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
