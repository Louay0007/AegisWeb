import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory,
  WorkflowRunStatus as PrismaWorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate as PrismaWorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActionType, PolicyDecision, RiskLevel, RiskSignal } from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 16 action attempts module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerToken: string;
  let ownerBToken: string;
  let agentAId: string;
  let vendorAId: string;
  let runAId: string;
  let attemptId: string;
  let failedAttemptId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Sixteen Org A',
          domain: `phase16-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Sixteen Org B',
          domain: `phase16-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase16.dev`,
          name: 'Phase Sixteen Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase16.dev`,
          name: 'Phase Sixteen Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [agentA, vendorA] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Sixteen Bot',
          identifier: `phase16-bot-${unique}@agentpass.local`,
          purpose: 'Record action attempts.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Sixteen Acme',
          website: `https://phase16-acme-${unique}.example.dev`,
          category: PrismaVendorCategory.ANALYTICS
        }
      })
    ]);
    agentAId = agentA.id;
    vendorAId = vendorA.id;

    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Sixteen Workflow',
        template: PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerA.id
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: agentAId,
        vendorId: vendorAId,
        status: PrismaWorkflowRunStatus.RUNNING,
        startedAt: new Date(),
        stateJson: {}
      }
    });
    runAId = run.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates action attempts from the worker token and applies risk classification', async () => {
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        website: 'http://localhost:4202/login',
        actionType: ActionType.CredentialInjection,
        riskSignals: [RiskSignal.CredentialUsed],
        inputSummary: 'Inject login credential.',
        metadataJson: { selector: '#login-form' }
      })
      .expect(201);

    attemptId = response.body.data.id;
    expect(response.body.data).toMatchObject({
      organizationId: organizationAId,
      workflowRunId: runAId,
      agentId: agentAId,
      vendorId: vendorAId,
      actionType: ActionType.CredentialInjection,
      riskLevel: RiskLevel.Medium,
      policyDecision: PolicyDecision.Allow,
      inputSummary: 'Inject login credential.',
      metadataJson: {
        selector: '#login-form',
        riskSignals: [RiskSignal.CredentialUsed]
      },
      completedAt: null
    });

    const stored = await database.client.actionAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(stored.actionType).toBe('CREDENTIAL_INJECTION');
    expect(stored.policyDecision).toBe('ALLOW');
  });

  it('blocks non-worker callers from internal create', async () => {
    await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        website: 'http://localhost:4202/billing',
        actionType: ActionType.ReadPage
      })
      .expect(403);
  });

  it('requires policy decisions before risky submit/change/purchase actions', async () => {
    const blocked = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        website: 'http://localhost:4202/billing',
        actionType: ActionType.ChangePlan,
        riskLevel: RiskLevel.High,
        inputSummary: 'Change plan to Starter.'
      })
      .expect(400);
    expect(blocked.body.error.message).toBe('Policy decision is required before recording risky actions.');

    const allowed = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        website: 'http://localhost:4202/billing',
        actionType: ActionType.ChangePlan,
        riskLevel: RiskLevel.High,
        policyDecision: PolicyDecision.RequireApproval,
        policyReason: 'Action requires human approval by policy.',
        inputSummary: 'Change plan to Starter.',
        amountCents: 50000
      })
      .expect(201);

    expect(allowed.body.data).toMatchObject({
      actionType: ActionType.ChangePlan,
      riskLevel: RiskLevel.High,
      policyDecision: PolicyDecision.RequireApproval,
      policyReason: 'Action requires human approval by policy.',
      amountCents: 50000
    });
  });

  it('completes and fails action attempts with timestamps and summaries', async () => {
    const complete = await request(app.getHttpServer())
      .patch(`/internal/workers/action-attempts/${attemptId}/complete`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        workflowRunId: runAId,
        outputSummary: 'Credential fields were filled.',
        metadataJson: { fieldsFilled: 2 }
      })
      .expect(200);

    expect(complete.body.data).toMatchObject({
      id: attemptId,
      outputSummary: 'Credential fields were filled.',
      metadataJson: {
        outcome: 'completed',
        fieldsFilled: 2
      }
    });
    expect(complete.body.data.completedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/internal/workers/action-attempts/${attemptId}/complete`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({ workflowRunId: runAId, outputSummary: 'Duplicate complete.' })
      .expect(422);

    const createdForFail = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        website: 'http://localhost:4202/invoices',
        actionType: ActionType.DownloadFile,
        inputSummary: 'Download invoice PDF.'
      })
      .expect(201);
    failedAttemptId = createdForFail.body.data.id;

    const failed = await request(app.getHttpServer())
      .patch(`/internal/workers/action-attempts/${failedAttemptId}/fail`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        workflowRunId: runAId,
        errorSummary: 'Invoice download button was missing.',
        metadataJson: { selector: '#download-invoice' }
      })
      .expect(200);

    expect(failed.body.data).toMatchObject({
      id: failedAttemptId,
      outputSummary: 'Invoice download button was missing.',
      metadataJson: {
        outcome: 'failed',
        errorSummary: 'Invoice download button was missing.',
        selector: '#download-invoice'
      }
    });
    expect(failed.body.data.completedAt).toEqual(expect.any(String));
  });

  it('lists action attempts for a workflow run and denies cross-org reads', async () => {
    const list = await request(app.getHttpServer())
      .get(`/workflow-runs/${runAId}/action-attempts`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(list.body.data.map((attempt: { id: string }) => attempt.id)).toEqual(
      expect.arrayContaining([attemptId, failedAttemptId])
    );
    expect(list.body.data.every((attempt: { organizationId: string }) => attempt.organizationId === organizationAId)).toBe(true);

    await request(app.getHttpServer())
      .get(`/workflow-runs/${runAId}/action-attempts`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });

  it('redacts secret-like metadata from action attempt responses', async () => {
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runAId}/action-attempts`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        website: 'http://localhost:4202/login',
        actionType: ActionType.CredentialInjection,
        policyDecision: PolicyDecision.Allow,
        inputSummary: 'Inject login credential.',
        metadataJson: {
          username: 'finance@example.dev',
          nested: {
            password: 'phase16-secret-password',
            responseText: 'token=phase16-secret-token'
          }
        }
      })
      .expect(201);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('finance@example.dev');
    expect(serialized).not.toContain('phase16-secret-password');
    expect(serialized).not.toContain('phase16-secret-token');
    expect(response.body.data.metadataJson).toMatchObject({
      username: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        responseText: '[REDACTED]'
      }
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
