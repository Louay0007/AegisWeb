import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  AgentStatus,
  AuditEventType,
  CredentialStatus,
  CredentialType as PrismaCredentialType,
  PolicyStatus,
  PolicyType,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionType,
  AgentPolicySnapshot,
  WorkflowRunStatus,
  WorkflowTemplate
} from '@agentpass/domain';
import { encryptSecret } from '@agentpass/vault';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { WORKFLOW_QUEUE_NAMES, workflowStartJobId } from '../apps/api/src/queue/workflow-queue.types.js';

const policyRules: AgentPolicySnapshot = {
  allowedDomains: ['localhost', 'acme.example.com'],
  blockedDomains: [],
  allowedActions: [
    ActionType.OpenPage,
    ActionType.ReadPage,
    ActionType.DownloadFile,
    ActionType.CredentialInjection,
    ActionType.ChangePlan,
    ActionType.SubmitForm
  ],
  deniedActions: [ActionType.InviteUser, ActionType.ChangeBillingDetails],
  approvalRequiredActions: [ActionType.ChangePlan, ActionType.SubmitForm],
  autoApproveBelowCents: 10000,
  approvalRequiredAboveCents: 10000,
  denyAboveCents: 100000,
  dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
  businessHours: { enabled: false }
};

describe('phase 14 workflows module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let queue: Queue;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerToken: string;
  let developerToken: string;
  let ownerBToken: string;
  let agentAId: string;
  let revokedAgentId: string;
  let vendorAId: string;
  let deletedVendorId: string;
  let credentialId: string;
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
    queue = new Queue(WORKFLOW_QUEUE_NAMES.runs, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Fourteen Org A',
          domain: `phase14-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Fourteen Org B',
          domain: `phase14-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, developerA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase14.dev`,
          name: 'Phase Fourteen Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `developer-a-${unique}@phase14.dev`,
          name: 'Phase Fourteen Developer A',
          role: PrismaUserRole.DEVELOPER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase14.dev`,
          name: 'Phase Fourteen Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerAId = ownerA.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    developerToken = signFor(developerA.id, developerA.organizationId, developerA.role, developerA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [agentA, revokedAgent] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fourteen Procurement Bot',
          identifier: `phase14-procurement-${unique}@agentpass.local`,
          purpose: 'Run workflow templates.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fourteen Revoked Bot',
          identifier: `phase14-revoked-${unique}@agentpass.local`,
          purpose: 'Rejected workflow test.',
          status: AgentStatus.REVOKED,
          createdByUserId: ownerA.id,
          revokedAt: new Date()
        }
      })
    ]);
    agentAId = agentA.id;
    revokedAgentId = revokedAgent.id;

    const [vendorA, deletedVendor] = await Promise.all([
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fourteen Acme',
          website: `https://phase14-acme-${unique}.example.dev`,
          category: PrismaVendorCategory.ANALYTICS
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fourteen Deleted Vendor',
          website: `https://phase14-deleted-${unique}.example.dev`,
          category: PrismaVendorCategory.OTHER,
          deletedAt: new Date()
        }
      })
    ]);
    vendorAId = vendorA.id;
    deletedVendorId = deletedVendor.id;

    await database.client.policy.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        name: 'Phase Fourteen Active Policy',
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE,
        rulesJson: policyRules,
        createdByUserId: ownerA.id
      }
    });

    const encryptedPayload = encryptSecret(
      { username: 'finance@phase14.dev', password: 'phase14-local-password' },
      config.config.vaultMasterKey
    );
    const credential = await database.client.credential.create({
      data: {
        organizationId: organizationAId,
        vendorId: vendorAId,
        label: 'Phase Fourteen Vendor Login',
        credentialType: PrismaCredentialType.USERNAME_PASSWORD,
        encryptedPayload,
        encryptionVersion: encryptedPayload.key_version,
        status: CredentialStatus.ACTIVE,
        createdByUserId: ownerA.id
      }
    });
    credentialId = credential.id;
    await database.client.credentialAgentGrant.create({
      data: {
        credentialId,
        agentId: agentAId,
        scope: 'login',
        createdByUserId: ownerA.id
      }
    });
  }, 30000);

  afterAll(async () => {
    await queue.close();
    await app.close();
  });

  it('lists workflow template definitions for Angular', async () => {
    const response = await request(app.getHttpServer())
      .get('/workflows/templates')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.map((template: { template: string }) => template.template)).toEqual(
      expect.arrayContaining([
        WorkflowTemplate.VendorInvoiceDownload,
        WorkflowTemplate.SaasRenewalCheck,
        WorkflowTemplate.PlanDowngradeRequest
      ])
    );
  });

  it('creates, lists, and gets a workflow for an active agent and vendor', async () => {
    const create = await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Fourteen Invoice Download',
        template: WorkflowTemplate.VendorInvoiceDownload,
        configurationJson: {
          credentialId
        }
      })
      .expect(201);

    workflowId = create.body.data.id;
    expect(create.body.data).toMatchObject({
      organizationId: organizationAId,
      agentId: agentAId,
      vendorId: vendorAId,
      name: 'Phase Fourteen Invoice Download',
      template: WorkflowTemplate.VendorInvoiceDownload,
      status: 'active',
      configurationJson: { credentialId }
    });

    const list = await request(app.getHttpServer())
      .get('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.some((workflow: { id: string }) => workflow.id === workflowId)).toBe(true);

    const get = await request(app.getHttpServer())
      .get(`/workflows/${workflowId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(get.body.data.id).toBe(workflowId);

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.WORKFLOW_CREATED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      workflowId,
      agentId: agentAId,
      vendorId: vendorAId
    });
  });

  it('creates all three MVP workflow templates with valid configuration', async () => {
    const renewal = await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Fourteen Renewal Check',
        template: WorkflowTemplate.SaasRenewalCheck,
        configurationJson: { credentialId }
      })
      .expect(201);
    expect(renewal.body.data.template).toBe(WorkflowTemplate.SaasRenewalCheck);

    const downgrade = await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Fourteen Downgrade Request',
        template: WorkflowTemplate.PlanDowngradeRequest,
        configurationJson: {
          credentialId,
          targetPlan: 'Starter'
        }
      })
      .expect(201);
    expect(downgrade.body.data.template).toBe(WorkflowTemplate.PlanDowngradeRequest);
  });

  it('rejects revoked agents, deleted vendors, invalid config, and missing grants', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: revokedAgentId,
        vendorId: vendorAId,
        name: 'Revoked Agent Workflow',
        template: WorkflowTemplate.VendorInvoiceDownload,
        configurationJson: { credentialId }
      })
      .expect(422);

    await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: deletedVendorId,
        name: 'Deleted Vendor Workflow',
        template: WorkflowTemplate.VendorInvoiceDownload,
        configurationJson: { credentialId }
      })
      .expect(400);

    const invalidConfig = await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Invalid Config Workflow',
        template: WorkflowTemplate.PlanDowngradeRequest,
        configurationJson: { credentialId }
      })
      .expect(400);
    expect(invalidConfig.body.error.message).toBe('Workflow configuration requires targetPlan.');

    const ungrantedCredential = await database.client.credential.create({
      data: {
        organizationId: organizationAId,
        vendorId: vendorAId,
        label: 'Phase Fourteen Ungranted Login',
        credentialType: PrismaCredentialType.USERNAME_PASSWORD,
        encryptedPayload: encryptSecret({ username: 'blocked', password: 'blocked' }, config.config.vaultMasterKey),
        encryptionVersion: 'local-v1',
        status: CredentialStatus.ACTIVE,
        createdByUserId: ownerAId
      }
    });
    const missingGrant = await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Missing Grant Workflow',
        template: WorkflowTemplate.VendorInvoiceDownload,
        configurationJson: { credentialId: ungrantedCredential.id }
      })
      .expect(403);
    expect(missingGrant.body.error.message).toBe('Workflow credential is not granted to the selected agent.');
  });

  it('starts a workflow run with queued status and enqueues a BullMQ job', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(response.body.data.run).toMatchObject({
      organizationId: organizationAId,
      workflowId,
      agentId: agentAId,
      vendorId: vendorAId,
      status: WorkflowRunStatus.Queued
    });
    expect(response.body.data.queueJobId).toBe(workflowStartJobId(response.body.data.run.id));

    const storedRun = await database.client.workflowRun.findUniqueOrThrow({
      where: { id: response.body.data.run.id }
    });
    expect(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'WAITING_FOR_APPROVAL']).toContain(storedRun.status);

    const job = await queue.getJob(workflowStartJobId(response.body.data.run.id));
    expect(job?.data).toMatchObject({
      workflowRunId: response.body.data.run.id,
      workflowId,
      organizationId: organizationAId,
      agentId: agentAId,
      vendorId: vendorAId,
      mode: 'start',
      approvalRequestId: null,
      attempt: 1
    });
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toMatchObject({ type: 'exponential', delay: 1000 });

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.WORKFLOW_RUN_REQUESTED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      workflowId,
      workflowRunId: response.body.data.run.id,
      queueJobId: workflowStartJobId(response.body.data.run.id)
    });
  });

  it('rejects runs without active policy and without credential grant', async () => {
    const noPolicyAgent = await database.client.agent.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Fourteen No Policy Bot',
        identifier: `phase14-no-policy-${crypto.randomUUID()}@agentpass.local`,
        purpose: 'Policy rejection test.',
        status: AgentStatus.ACTIVE,
        createdByUserId: ownerAId
      }
    });
    const noPolicyWorkflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: noPolicyAgent.id,
        vendorId: vendorAId,
        name: 'No Policy Workflow',
        template: 'VENDOR_INVOICE_DOWNLOAD',
        status: 'ACTIVE',
        configurationJson: { credentialId },
        createdByUserId: ownerAId
      }
    });

    const noPolicy = await request(app.getHttpServer())
      .post(`/workflows/${noPolicyWorkflow.id}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(400);
    expect(noPolicy.body.error.message).toBe('Workflow agent requires an active policy bundle.');

    const revokedGrant = await database.client.credentialAgentGrant.update({
      where: { credentialId_agentId: { credentialId, agentId: agentAId } },
      data: { revokedAt: new Date() }
    });
    const noGrant = await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(403);
    expect(noGrant.body.error.message).toBe('Workflow credential is not granted to the selected agent.');

    await database.client.credentialAgentGrant.update({
      where: { id: revokedGrant.id },
      data: { revokedAt: null }
    });
  });

  it('enforces RBAC and organization isolation for workflows', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('authorization', `Bearer ${developerToken}`)
      .send({
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Blocked Developer Create',
        template: WorkflowTemplate.VendorInvoiceDownload,
        configurationJson: { credentialId }
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${developerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/workflows/${workflowId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });

  function signFor(userId: string, organizationId: string, role: string, email: string): string {
    return tokenService.signAccessToken({
      sub: userId,
      userId,
      organizationId,
      role,
      email
    });
  }
});
