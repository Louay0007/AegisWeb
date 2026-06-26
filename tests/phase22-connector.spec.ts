import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ActionType as PrismaActionType,
  AgentStatus,
  PolicyDecision as PrismaPolicyDecision,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createControlledContext, ControlledBrowserContext } from '@agentpass/browser-runtime';
import { ActionType, DomainError, PolicyDecision } from '@agentpass/domain';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerDatabaseService } from '../apps/worker/src/database/worker-database.service.js';
import { SandboxVendorConnector } from '../apps/worker/src/connector/sandbox-vendor.connector.js';
import { ConnectorExecutionContext } from '../apps/worker/src/connector/vendor-connector.types.js';

describe('phase 22 connector module', () => {
  let sandboxApp: INestApplication;
  let workerApp: Awaited<ReturnType<typeof createWorkerApplicationContext>>;
  let database: WorkerDatabaseService;
  let connector: SandboxVendorConnector;
  let baseUrl: string;
  let artifactDir: string;
  let organizationId: string;
  let agentId: string;
  let vendorId: string;
  let workflowId: string;

  beforeAll(async () => {
    artifactDir = await mkdtemp(join(tmpdir(), 'agentpass-connector-'));

    const sandboxModule = await Test.createTestingModule({
      imports: [VendorSandboxModule]
    }).compile();
    sandboxApp = sandboxModule.createNestApplication();
    await sandboxApp.init();
    await sandboxApp.listen(0, '127.0.0.1');
    const address = sandboxApp.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    workerApp = await createWorkerApplicationContext();
    database = workerApp.get(WorkerDatabaseService);
    connector = workerApp.get(SandboxVendorConnector);

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Twenty Two Org',
        domain: `phase22-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;

    const owner = await database.client.user.create({
      data: {
        organizationId,
        email: `owner-${unique}@phase22.dev`,
        name: 'Phase Twenty Two Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: 'unused'
      }
    });

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Twenty Two Bot',
          identifier: `phase22-bot-${unique}@agentpass.local`,
          purpose: 'Connector module tests.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Twenty Two Acme',
          website: baseUrl,
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
        name: 'Phase Twenty Two Workflow',
        template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: owner.id
      }
    });
    workflowId = workflow.id;
  }, 30000);

  afterAll(async () => {
    await workerApp.close();
    await sandboxApp.close();
    await rm(artifactDir, { recursive: true, force: true });
  });

  it('logs in to the sandbox with credentials supplied by execution context', async () => {
    const { context, browser } = await connectorContext();

    try {
      await connector.login(context);
      const body = (await browser.page.locator('body').textContent()) ?? '';
      expect(body).toContain('"ok":true');

      const attempt = await latestAttempt(context.workflowRunId, PrismaActionType.CREDENTIAL_INJECTION);
      expect(attempt).toMatchObject({
        policyDecision: PrismaPolicyDecision.ALLOW,
        outputSummary: 'Sandbox login credentials accepted.'
      });
      expect(JSON.stringify(attempt?.metadataJson)).not.toContain('acme-local-password');
    } finally {
      await browser.closeContext();
    }
  });

  it('downloads the latest sandbox invoice and records an action attempt', async () => {
    const { context, browser } = await connectorContext();

    try {
      const invoice = await connector.downloadLatestInvoice(context);

      expect(invoice).toMatchObject({
        kind: 'invoice',
        suggestedFilename: 'acme-latest-invoice.pdf',
        sizeBytes: expect.any(Number),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
      });

      const attempt = await latestAttempt(context.workflowRunId, PrismaActionType.DOWNLOAD_FILE);
      expect(attempt).toMatchObject({
        policyDecision: PrismaPolicyDecision.ALLOW,
        outputSummary: 'Latest sandbox invoice downloaded.'
      });
    } finally {
      await browser.closeContext();
    }
  });

  it('extracts renewal information from the sandbox billing page', async () => {
    const { context, browser } = await connectorContext();

    try {
      const renewal = await connector.readRenewalInfo(context);

      expect(renewal).toEqual({
        vendorName: 'Acme Analytics',
        currentPlan: 'Growth',
        currentMonthlyPriceCents: 80000,
        renewalMonthlyPriceCents: 110000,
        renewalDate: '2026-07-15',
        seatCount: 28,
        unusedSeats: 5,
        estimatedMonthlySavingsCents: 48000,
        recommendation: 'downgrade_to_starter'
      });

      const attempt = await latestAttempt(context.workflowRunId, PrismaActionType.READ_PAGE);
      expect(attempt?.outputSummary).toBe('Sandbox renewal data extracted.');
    } finally {
      await browser.closeContext();
    }
  });

  it('prepares a downgrade proposal and records approval-required policy state', async () => {
    const { context, browser } = await connectorContext();

    try {
      const proposal = await connector.prepareDowngrade(context);

      expect(proposal).toMatchObject({
        actionType: ActionType.ChangePlan,
        policyDecision: PolicyDecision.RequireApproval,
        approvalRequired: true,
        amountCents: 48000,
        summary: 'Downgrade Acme Analytics from Growth to Starter.'
      });

      const attempt = await database.client.actionAttempt.findUniqueOrThrow({
        where: { id: proposal.actionAttemptId }
      });
      expect(attempt).toMatchObject({
        actionType: PrismaActionType.CHANGE_PLAN,
        policyDecision: PrismaPolicyDecision.REQUIRE_APPROVAL,
        amountCents: 48000
      });
    } finally {
      await browser.closeContext();
    }
  });

  it('does not submit downgrade without approval token or approved state', async () => {
    const { context, browser } = await connectorContext();

    try {
      await expect(connector.submitDowngrade(context)).rejects.toBeInstanceOf(DomainError);

      const allowedDowngradeAttempts = await database.client.actionAttempt.count({
        where: {
          workflowRunId: context.workflowRunId,
          actionType: PrismaActionType.CHANGE_PLAN,
          policyDecision: PrismaPolicyDecision.ALLOW
        }
      });
      expect(allowedDowngradeAttempts).toBe(0);
    } finally {
      await browser.closeContext();
    }
  });

  async function connectorContext(extra: Partial<ConnectorExecutionContext> = {}): Promise<{
    context: ConnectorExecutionContext;
    browser: ControlledBrowserContext;
  }> {
    const run = await database.client.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        agentId,
        vendorId,
        status: WorkflowRunStatus.RUNNING,
        startedAt: new Date(),
        stateJson: {}
      }
    });

    const browser = await createControlledContext({
      workflowRunId: run.id,
      organizationId,
      allowedDomains: ['127.0.0.1'],
      allowPrivateNetwork: true,
      artifactDir,
      timeoutMs: 5000,
      headless: true
    });

    return {
      browser,
      context: {
        workflowRunId: run.id,
        organizationId,
        agentId,
        vendorId,
        baseUrl,
        browser,
        credentials: {
          username: 'finance@northstarlabs.dev',
          password: 'acme-local-password'
        },
        ...extra
      }
    };
  }

  async function latestAttempt(workflowRunId: string, actionType: PrismaActionType) {
    return database.client.actionAttempt.findFirst({
      where: {
        workflowRunId,
        actionType
      },
      orderBy: { createdAt: 'desc' }
    });
  }
});
