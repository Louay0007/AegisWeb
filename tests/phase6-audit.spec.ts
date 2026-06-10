import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditActorType,
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
import { AuditHashService } from '../apps/api/src/audit/audit-hash.service.js';
import { AuditRedactionService } from '../apps/api/src/audit/audit-redaction.service.js';
import { AuditService } from '../apps/api/src/audit/audit.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';

describe('phase 6 audit module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let auditService: AuditService;
  let hashService: AuditHashService;
  let redactionService: AuditRedactionService;
  let organizationAId: string;
  let organizationBId: string;
  let actorId: string;
  let workflowRunId: string;
  let ownerToken: string;
  let auditorToken: string;
  let approverToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    auditService = app.get(AuditService);
    hashService = app.get(AuditHashService);
    redactionService = app.get(AuditRedactionService);

    const unique = crypto.randomUUID();
    const organizationA = await database.client.organization.create({
      data: {
        name: 'Phase Six Org A',
        domain: `phase6-a-${unique}.dev`,
        plan: 'local'
      }
    });
    const organizationB = await database.client.organization.create({
      data: {
        name: 'Phase Six Org B',
        domain: `phase6-b-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [owner, auditor, approver] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-${unique}@phase6.dev`,
          name: 'Phase Six Owner',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `auditor-${unique}@phase6.dev`,
          name: 'Phase Six Auditor',
          role: PrismaUserRole.AUDITOR,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-${unique}@phase6.dev`,
          name: 'Phase Six Approver',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    actorId = owner.id;
    ownerToken = signFor(owner.id, owner.organizationId, owner.role, owner.email);
    auditorToken = signFor(auditor.id, auditor.organizationId, auditor.role, auditor.email);
    approverToken = signFor(approver.id, approver.organizationId, approver.role, approver.email);

    const agent = await database.client.agent.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Six Agent',
        identifier: `phase-six-agent-${unique}@agentpass.local`,
        purpose: 'Support audit tests.',
        status: AgentStatus.ACTIVE,
        createdByUserId: owner.id
      }
    });
    const vendor = await database.client.vendor.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Six Vendor',
        website: `https://phase6-${unique}.example.dev`,
        category: VendorCategory.OTHER,
        ownerUserId: owner.id
      }
    });
    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agent.id,
        vendorId: vendor.id,
        name: 'Phase Six Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        createdByUserId: owner.id
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: agent.id,
        vendorId: vendor.id,
        status: WorkflowRunStatus.RUNNING,
        currentStep: 'audit-test'
      }
    });
    workflowRunId = run.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('hashes audit events deterministically and changes when payload changes', () => {
    const input = {
      organizationId: organizationAId,
      workflowRunId,
      agentId: null,
      actorType: AuditActorType.USER,
      actorId,
      eventType: AuditEventType.POLICY_EVALUATED,
      eventDataJson: { b: 2, a: 1 },
      prevHash: null
    };

    expect(hashService.hash(input)).toBe(hashService.hash({ ...input, eventDataJson: { a: 1, b: 2 } }));
    expect(hashService.hash(input)).not.toBe(hashService.hash({ ...input, eventDataJson: { a: 1, b: 3 } }));
  });

  it('redacts secret-shaped fields recursively before storage', () => {
    expect(
      redactionService.redact({
        username: 'safe-user',
        password: 'not-safe',
        nested: {
          authorization: 'Bearer token',
          cookie: 'session=value',
          visible: 'kept'
        },
        items: [{ apiToken: 'raw-token' }]
      })
    ).toEqual({
      username: 'safe-user',
      password: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        visible: 'kept'
      },
      items: [{ apiToken: '[REDACTED]' }]
    });
  });

  it('creates append-only events with valid hash chaining and redacted payloads', async () => {
    const first = await auditService.record({
      organizationId: organizationAId,
      workflowRunId,
      actorType: AuditActorType.USER,
      actorId,
      eventType: AuditEventType.POLICY_EVALUATED,
      eventDataJson: {
        decision: 'allow',
        password: 'plaintext-password',
        nested: { token: 'raw-token' }
      }
    });
    const second = await auditService.record({
      organizationId: organizationAId,
      workflowRunId,
      actorType: AuditActorType.USER,
      actorId,
      eventType: AuditEventType.WORKFLOW_RUN_STARTED,
      eventDataJson: {
        step: 'started'
      }
    });

    expect(first.prevHash).toBeNull();
    expect(first.eventDataJson).toMatchObject({
      decision: 'allow',
      password: '[REDACTED]',
      nested: { token: '[REDACTED]' }
    });
    expect(first.eventHash).toBe(
      hashService.hash({
        organizationId: first.organizationId,
        workflowRunId: first.workflowRunId,
        agentId: first.agentId,
        actorType: AuditActorType.USER,
        actorId: first.actorId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: first.eventDataJson,
        prevHash: first.prevHash
      })
    );
    expect(second.prevHash).toBe(first.eventHash);
  });

  it('rejects unknown audit event enums before persistence', async () => {
    await expect(
      auditService.record({
        organizationId: organizationAId,
        actorType: AuditActorType.USER,
        actorId,
        eventType: 'NOT_A_REAL_EVENT' as AuditEventType,
        eventDataJson: { action: 'invalid' }
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
  });

  it('serializes concurrent audit writes into a single valid organization chain', async () => {
    const events = await Promise.all(
      Array.from({ length: 8 }, (_, index) => auditService.record({
        organizationId: organizationAId,
        workflowRunId,
        actorType: AuditActorType.USER,
        actorId,
        eventType: AuditEventType.POLICY_EVALUATED,
        eventDataJson: { concurrentIndex: index }
      }))
    );
    const stored = await database.client.auditEvent.findMany({
      where: {
        id: { in: events.map((event) => event.id) }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    for (const event of stored) {
      expect(event.eventHash).toBe(hashService.hash({
        organizationId: event.organizationId,
        workflowRunId: event.workflowRunId,
        agentId: event.agentId,
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: event.eventType,
        eventDataJson: event.eventDataJson,
        prevHash: event.prevHash
      }));
    }

    const prevHashes = new Set(stored.map((event) => event.prevHash).filter(Boolean));
    expect(prevHashes.size).toBe(stored.length);
  });

  it('lists audit events with workflow, actor, event type, and date filters', async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const response = await request(app.getHttpServer())
      .get('/audit-events')
      .query({
        workflowRunId,
        actorType: AuditActorType.USER,
        actorId,
        eventType: AuditEventType.POLICY_EVALUATED,
        from,
        limit: '10',
        offset: '0'
      })
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((event: { organizationId: string }) => event.organizationId === organizationAId)).toBe(true);
    expect(response.body.data.every((event: { workflowRunId: string }) => event.workflowRunId === workflowRunId)).toBe(true);
    expect(response.body.data.every((event: { eventType: string }) => event.eventType === AuditEventType.POLICY_EVALUATED)).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('plaintext-password');
    expect(JSON.stringify(response.body)).not.toContain('raw-token');
  });

  it('allows owners and auditors to read audit events but blocks approvers', async () => {
    await request(app.getHttpServer())
      .get('/audit-events')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/audit-events')
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/audit-events')
      .set('authorization', `Bearer ${approverToken}`)
      .expect(403);
  });

  it('rejects cross-organization audit reads', async () => {
    const orgBUser = await database.client.user.create({
      data: {
        organizationId: organizationBId,
        email: `owner-b-${crypto.randomUUID()}@phase6.dev`,
        name: 'Phase Six Owner B',
        role: PrismaUserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: 'unused'
      }
    });
    const orgBEvent = await auditService.record({
      organizationId: organizationBId,
      actorType: AuditActorType.USER,
      actorId: orgBUser.id,
      eventType: AuditEventType.USER_REGISTERED,
      eventDataJson: { email: orgBUser.email }
    });

    await request(app.getHttpServer())
      .get(`/audit-events/${orgBEvent.id}`)
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
