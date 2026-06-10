import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditEventType,
  PolicyStatus as PrismaPolicyStatus,
  PolicyType as PrismaPolicyType,
  UserRole as PrismaUserRole,
  UserStatus
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionType,
  AgentPolicySnapshot,
  PolicyDecision,
  PolicyStatus,
  PolicyType,
  RiskSignal
} from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

const basePolicyRules: AgentPolicySnapshot = {
  allowedDomains: ['localhost', 'acme.example.com'],
  blockedDomains: ['bank.example'],
  allowedActions: [
    ActionType.OpenPage,
    ActionType.ReadPage,
    ActionType.DownloadFile,
    ActionType.CredentialInjection,
    ActionType.MakePurchase
  ],
  deniedActions: [ActionType.InviteUser, ActionType.ChangeBillingDetails],
  approvalRequiredActions: [ActionType.SubmitForm, ActionType.ChangePlan, ActionType.CancelSubscription],
  autoApproveBelowCents: 10000,
  approvalRequiredAboveCents: 10000,
  denyAboveCents: 100000,
  dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
  businessHours: { enabled: false }
};

describe('phase 12 policies module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerToken: string;
  let developerToken: string;
  let ownerBToken: string;
  let agentAId: string;
  let agentBId: string;
  let policyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Twelve Org A',
          domain: `phase12-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Twelve Org B',
          domain: `phase12-b-${unique}.dev`,
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
          email: `owner-a-${unique}@phase12.dev`,
          name: 'Phase Twelve Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `developer-a-${unique}@phase12.dev`,
          name: 'Phase Twelve Developer A',
          role: PrismaUserRole.DEVELOPER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase12.dev`,
          name: 'Phase Twelve Owner B',
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

    const [agentA, agentB] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Twelve Procurement Bot',
          identifier: `phase-twelve-procurement-${unique}@agentpass.local`,
          purpose: 'Evaluate SaaS billing changes.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.agent.create({
        data: {
          organizationId: organizationBId,
          name: 'Phase Twelve Other Bot',
          identifier: `phase-twelve-other-${unique}@agentpass.local`,
          purpose: 'Cross organization policy checks.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerB.id
        }
      })
    ]);

    agentAId = agentA.id;
    agentBId = agentB.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, and gets a valid agent policy bundle with audit', async () => {
    const create = await request(app.getHttpServer())
      .post('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        name: 'Procurement Bot Standard Policy',
        type: PolicyType.AgentPolicyBundle,
        status: PolicyStatus.Active,
        rulesJson: basePolicyRules
      })
      .expect(201);

    policyId = create.body.data.id;
    expect(create.body.data).toMatchObject({
      organizationId: organizationAId,
      agentId: agentAId,
      name: 'Procurement Bot Standard Policy',
      type: PolicyType.AgentPolicyBundle,
      status: PolicyStatus.Active,
      version: 1,
      rulesJson: {
        allowedDomains: ['localhost', 'acme.example.com']
      }
    });

    const list = await request(app.getHttpServer())
      .get('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.some((policy: { id: string }) => policy.id === policyId)).toBe(true);
    expect(list.body.data.every((policy: { organizationId: string }) => policy.organizationId === organizationAId)).toBe(true);

    const get = await request(app.getHttpServer())
      .get(`/policies/${policyId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(get.body.data.id).toBe(policyId);

    const createdAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.POLICY_CREATED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(createdAudit?.eventDataJson).toMatchObject({
      policyId,
      agentId: agentAId,
      version: 1
    });
  });

  it('rejects invalid policy domains and invalid thresholds', async () => {
    const invalidDomain = await request(app.getHttpServer())
      .post('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        name: 'Invalid Domain Policy',
        type: PolicyType.AgentPolicyBundle,
        status: PolicyStatus.Draft,
        rulesJson: {
          ...basePolicyRules,
          allowedDomains: ['https://bad.example.com']
        }
      })
      .expect(400);
    expect(invalidDomain.body.error.message).toBe('Policy domains must be hostnames without a URL scheme.');

    const invalidThresholds = await request(app.getHttpServer())
      .post('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        name: 'Invalid Threshold Policy',
        type: PolicyType.AgentPolicyBundle,
        status: PolicyStatus.Draft,
        rulesJson: {
          ...basePolicyRules,
          autoApproveBelowCents: 20000,
          approvalRequiredAboveCents: 10000
        }
      })
      .expect(400);
    expect(invalidThresholds.body.error.message).toBe('Auto-approval threshold cannot exceed the approval threshold.');
  });

  it('enforces one active policy bundle per agent in the MVP', async () => {
    const response = await request(app.getHttpServer())
      .post('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        name: 'Duplicate Active Bundle',
        type: PolicyType.AgentPolicyBundle,
        status: PolicyStatus.Active,
        rulesJson: basePolicyRules
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Agent already has an active policy bundle.'
    });
  });

  it('increments policy version on update and records audit', async () => {
    const update = await request(app.getHttpServer())
      .patch(`/policies/${policyId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Procurement Bot Standard Policy v2',
        rulesJson: {
          ...basePolicyRules,
          dangerKeywords: [...basePolicyRules.dangerKeywords, 'downgrade']
        }
      })
      .expect(200);

    expect(update.body.data).toMatchObject({
      id: policyId,
      name: 'Procurement Bot Standard Policy v2',
      version: 2
    });

    const updatedAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.POLICY_UPDATED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(updatedAudit?.eventDataJson).toMatchObject({
      policyId,
      previousVersion: 1,
      version: 2
    });
  });

  it('evaluates policies, returns decision reasons, and records evaluation audit', async () => {
    const evaluation = await request(app.getHttpServer())
      .post('/policies/evaluate')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        policyId,
        agentId: agentAId,
        website: 'http://localhost:4202/billing',
        actionType: ActionType.ChangePlan,
        amountCents: 50000,
        riskSignals: [RiskSignal.PlanChangeDetected]
      })
      .expect(201);

    expect(evaluation.body.data).toMatchObject({
      policyId,
      policyVersion: 2,
      agentId: agentAId,
      result: {
        decision: PolicyDecision.RequireApproval,
        reason: 'Action requires human approval by policy.',
        matchedRules: [`action.requires_approval.${ActionType.ChangePlan}`]
      }
    });

    const evaluatedAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        agentId: agentAId,
        actorId: ownerAId,
        eventType: AuditEventType.POLICY_EVALUATED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(evaluatedAudit?.eventDataJson).toMatchObject({
      policyId,
      policyVersion: 2,
      decision: PolicyDecision.RequireApproval,
      reason: 'Action requires human approval by policy.'
    });
  });

  it('keeps evaluation admin/internal only while allowing developer read access', async () => {
    await request(app.getHttpServer())
      .get(`/policies/${policyId}`)
      .set('authorization', `Bearer ${developerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/policies/evaluate')
      .set('authorization', `Bearer ${developerToken}`)
      .send({
        policyId,
        agentId: agentAId,
        website: 'http://localhost:4202/billing',
        actionType: ActionType.ReadPage
      })
      .expect(403);
  });

  it('denies cross-organization policy and agent access', async () => {
    await request(app.getHttpServer())
      .get(`/policies/${policyId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/policies/${policyId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .send({ name: 'Cross Org Update' })
      .expect(404);
    expect(updateResponse.body.error.code).toBe('NOT_FOUND');

    const agentResponse = await request(app.getHttpServer())
      .post('/policies')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentBId,
        name: 'Cross Org Agent Policy',
        type: PolicyType.AgentPolicyBundle,
        status: PolicyStatus.Draft,
        rulesJson: basePolicyRules
      })
      .expect(403);
    expect(agentResponse.body.error.code).toBe('ORGANIZATION_ISOLATION_VIOLATION');
  });

  it('stores Prisma enum values while returning Angular-friendly domain values', async () => {
    const stored = await database.client.policy.findUniqueOrThrow({
      where: { id: policyId },
      select: { type: true, status: true }
    });

    expect(stored).toEqual({
      type: PrismaPolicyType.AGENT_POLICY_BUNDLE,
      status: PrismaPolicyStatus.ACTIVE
    });
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
