import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditEventType,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module.js';
import { AgentIdentifierService } from '../apps/api/src/agents/agent-identifier.service.js';
import { AgentStatusService } from '../apps/api/src/agents/agent-status.service.js';
import { AgentsService } from '../apps/api/src/agents/agents.service.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 9 agents module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let identifierService: AgentIdentifierService;
  let statusService: AgentStatusService;
  let agentsService: AgentsService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerBId: string;
  let ownerToken: string;
  let approverToken: string;
  let ownerBToken: string;
  let agentId: string;
  let revokedAgentId: string;
  let uniqueSuffix: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    identifierService = app.get(AgentIdentifierService);
    statusService = app.get(AgentStatusService);
    agentsService = app.get(AgentsService);

    const unique = crypto.randomUUID();
    uniqueSuffix = unique;
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Nine Org A',
          domain: `phase9-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Nine Org B',
          domain: `phase9-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, approverA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase9.dev`,
          name: 'Phase Nine Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase9.dev`,
          name: 'Phase Nine Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase9.dev`,
          name: 'Phase Nine Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('generates agentpass.local identifiers and avoids duplicates', async () => {
    const first = await identifierService.generate('Procurement Bot');
    expect(first).toMatch(/^procurement-bot(?:-\d+)?@agentpass\.local$/);
    expect(identifierService.isValid(first)).toBe(true);
    expect(identifierService.isValid('bad@example.com')).toBe(false);
  });

  it('creates, lists, gets, and updates agents with audit events', async () => {
    const create = await request(app.getHttpServer())
      .post('/agents')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Phase Nine Procurement Bot ${uniqueSuffix}`,
        purpose: 'Manage SaaS renewal workflows.'
      })
      .expect(201);

    agentId = create.body.data.id;
    expect(create.body.data).toMatchObject({
      organizationId: organizationAId,
      name: `Phase Nine Procurement Bot ${uniqueSuffix}`,
      purpose: 'Manage SaaS renewal workflows.',
      status: AgentStatus.ACTIVE
    });
    expect(create.body.data.identifier).toMatch(/^phase-nine-procurement-bot-[a-f0-9-]+(?:-\d+)?@agentpass\.local$/);

    const list = await request(app.getHttpServer())
      .get('/agents')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.some((agent: { id: string }) => agent.id === agentId)).toBe(true);
    expect(list.body.data.every((agent: { organizationId: string }) => agent.organizationId === organizationAId)).toBe(true);

    const get = await request(app.getHttpServer())
      .get(`/agents/${agentId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(get.body.data.id).toBe(agentId);

    const update = await request(app.getHttpServer())
      .patch(`/agents/${agentId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        purpose: 'Manage SaaS invoices, renewals, and vendor billing workflows.'
      })
      .expect(200);
    expect(update.body.data.purpose).toContain('vendor billing');

    const auditTypes = await database.client.auditEvent.findMany({
      where: {
        organizationId: organizationAId,
        agentId,
        actorId: ownerAId
      },
      select: { eventType: true }
    });
    expect(auditTypes.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([AuditEventType.AGENT_CREATED, AuditEventType.AGENT_UPDATED])
    );
  });

  it('blocks approvers from creating agents but allows them to read agents', async () => {
    await request(app.getHttpServer())
      .post('/agents')
      .set('authorization', `Bearer ${approverToken}`)
      .send({
        name: 'Blocked Agent',
        purpose: 'Should not be created.'
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/agents/${agentId}`)
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);
  });

  it('pauses and resumes agents while rejecting invalid workflow starts for paused agents', async () => {
    const paused = await request(app.getHttpServer())
      .post(`/agents/${agentId}/pause`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(paused.body.data.status).toBe(AgentStatus.PAUSED);

    const pausedAgent = await database.client.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(() => statusService.assertCanStartWorkflow(pausedAgent)).toThrow(/active/);
    await expect(agentsService.assertAgentCanStartWorkflow(organizationAId, agentId)).rejects.toMatchObject({
      code: 'AGENT_NOT_ACTIVE'
    });

    const resumed = await request(app.getHttpServer())
      .post(`/agents/${agentId}/resume`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(resumed.body.data.status).toBe(AgentStatus.ACTIVE);

    await expect(agentsService.assertAgentCanStartWorkflow(organizationAId, agentId)).resolves.toBeUndefined();
  });

  it('revokes agents and rejects resume/update/revoke transitions after revocation', async () => {
    const revoke = await request(app.getHttpServer())
      .post(`/agents/${agentId}/revoke`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    revokedAgentId = agentId;

    expect(revoke.body.data.status).toBe(AgentStatus.REVOKED);
    expect(revoke.body.data.revokedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/agents/${agentId}/resume`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(422);

    await request(app.getHttpServer())
      .patch(`/agents/${agentId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ purpose: 'Should fail.' })
      .expect(422);

    await request(app.getHttpServer())
      .post(`/agents/${agentId}/revoke`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(422);

    await expect(agentsService.assertAgentCanStartWorkflow(organizationAId, agentId)).rejects.toMatchObject({
      code: 'AGENT_NOT_ACTIVE'
    });
  });

  it('returns activity with audit events and recent workflow runs', async () => {
    const vendor = await database.client.vendor.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Nine Vendor',
        website: `https://phase9-${crypto.randomUUID()}.example.dev`,
        category: VendorCategory.OTHER,
        ownerUserId: ownerAId
      }
    });
    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: revokedAgentId,
        vendorId: vendor.id,
        name: 'Phase Nine Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        createdByUserId: ownerAId
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: revokedAgentId,
        vendorId: vendor.id,
        status: WorkflowRunStatus.FAILED,
        currentStep: 'status-check',
        errorMessage: 'Agent revoked.'
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/agents/${revokedAgentId}/activity`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.agent.id).toBe(revokedAgentId);
    expect(response.body.data.auditEvents.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining([
        AuditEventType.AGENT_CREATED,
        AuditEventType.AGENT_UPDATED,
        AuditEventType.AGENT_PAUSED,
        AuditEventType.AGENT_RESUMED,
        AuditEventType.AGENT_REVOKED
      ])
    );
    expect(response.body.data.workflowRuns.some((workflowRun: { id: string }) => workflowRun.id === run.id)).toBe(true);
  });

  it('rejects cross-organization agent access', async () => {
    await request(app.getHttpServer())
      .get(`/agents/${revokedAgentId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/agents/${revokedAgentId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .send({ name: 'Cross Org Rename' })
      .expect(404);

    const orgBAgent = await database.client.agent.create({
      data: {
        organizationId: organizationBId,
        name: 'Other Org Agent',
        identifier: `other-org-agent-${crypto.randomUUID()}@agentpass.local`,
        purpose: 'Belongs to org B.',
        status: AgentStatus.ACTIVE,
        createdByUserId: ownerBId
      }
    });

    await request(app.getHttpServer())
      .get(`/agents/${orgBAgent.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
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
