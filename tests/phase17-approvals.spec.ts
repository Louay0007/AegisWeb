import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  ActionType as PrismaActionType,
  AgentStatus,
  ApprovalStatus,
  AuditEventType,
  PolicyDecision,
  RiskLevel,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { connectionFromRedisUrl } from '../apps/api/src/queue/queue-redis.js';
import { WORKFLOW_QUEUE_NAMES, workflowResumeJobId } from '../apps/api/src/queue/workflow-queue.types.js';

describe('phase 17 approvals module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let queue: Queue;
  let organizationAId: string;
  let organizationBId: string;
  let approverToken: string;
  let auditorToken: string;
  let ownerBToken: string;
  let agentAId: string;
  let vendorAId: string;
  let workflowId: string;
  let approvalId: string;
  let runId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);
    queue = new Queue(WORKFLOW_QUEUE_NAMES.resume, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Seventeen Org A',
          domain: `phase17-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Seventeen Org B',
          domain: `phase17-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, approverA, auditorA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase17.dev`,
          name: 'Phase Seventeen Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase17.dev`,
          name: 'Phase Seventeen Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `auditor-a-${unique}@phase17.dev`,
          name: 'Phase Seventeen Auditor A',
          role: PrismaUserRole.AUDITOR,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase17.dev`,
          name: 'Phase Seventeen Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    auditorToken = signFor(auditorA.id, auditorA.organizationId, auditorA.role, auditorA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [agentA, vendorA] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Seventeen Bot',
          identifier: `phase17-bot-${unique}@agentpass.local`,
          purpose: 'Approval lifecycle.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Seventeen Acme',
          website: `https://phase17-acme-${unique}.example.dev`,
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
        name: 'Phase Seventeen Workflow',
        template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerA.id
      }
    });
    workflowId = workflow.id;
  }, 30000);

  afterAll(async () => {
    await queue.close();
    await app.close();
  });

  it('creates a pending approval from the internal worker and moves the run to waiting', async () => {
    const fixture = await createApprovalFixture();
    runId = fixture.runId;

    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${fixture.runId}/approval-requests`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        actionAttemptId: fixture.attemptId,
        summary: 'Approve downgrade to Starter',
        riskLevel: 'HIGH',
        amountCents: 50000,
        policyTriggeredJson: { matchedRules: ['action.requires_approval.change_plan'] }
      })
      .expect(201);

    approvalId = response.body.data.id;
    expect(response.body.data).toMatchObject({
      workflowRunId: fixture.runId,
      actionAttemptId: fixture.attemptId,
      status: 'pending',
      requestedByAgentId: agentAId,
      summary: 'Approve downgrade to Starter',
      riskLevel: 'high',
      amountCents: 50000
    });

    const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: fixture.runId } });
    expect(run.status).toBe(WorkflowRunStatus.WAITING_FOR_APPROVAL);

    const auditTypes = await database.client.auditEvent.findMany({
      where: {
        organizationId: organizationAId,
        workflowRunId: fixture.runId,
        eventType: { in: [AuditEventType.APPROVAL_REQUESTED, AuditEventType.WORKFLOW_RUN_WAITING_FOR_APPROVAL] }
      },
      select: { eventType: true }
    });
    expect(auditTypes.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([AuditEventType.APPROVAL_REQUESTED, AuditEventType.WORKFLOW_RUN_WAITING_FOR_APPROVAL])
    );
  });

  it('lists and gets pending approvals', async () => {
    const list = await request(app.getHttpServer())
      .get('/approvals')
      .query({ status: 'pending', workflowRunId: runId })
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);

    expect(list.body.data.map((approval: { id: string }) => approval.id)).toContain(approvalId);

    const get = await request(app.getHttpServer())
      .get(`/approvals/${approvalId}`)
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);
    expect(get.body.data.id).toBe(approvalId);
  });

  it('allows approvers to approve once and resumes the workflow run', async () => {
    const response = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Approved for savings.' })
      .expect(201);

    expect(response.body.data.approval).toMatchObject({
      id: approvalId,
      status: 'approved',
      comment: 'Approved for savings.'
    });
    expect(response.body.data.resumeJobId).toBe(workflowResumeJobId(runId, approvalId));

    const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe(WorkflowRunStatus.RUNNING);

    const resumeJob = await queue.getJob(workflowResumeJobId(runId, approvalId));
    expect(resumeJob?.data).toMatchObject({
      workflowRunId: runId,
      organizationId: organizationAId,
      approvalRequestId: approvalId,
      mode: 'resume',
      attempt: 1
    });
    expect(resumeJob?.opts.attempts).toBe(3);

    await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Duplicate.' })
      .expect(422);
  });

  it('allows approvers to reject once and marks the run denied', async () => {
    const fixture = await createApprovalFixture();
    const approval = await createApprovalViaApi(fixture.runId, fixture.attemptId, 'Reject risky cancellation');

    const response = await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/reject`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Too risky.' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      id: approval.id,
      status: 'rejected',
      comment: 'Too risky.'
    });

    const run = await database.client.workflowRun.findUniqueOrThrow({ where: { id: fixture.runId } });
    expect(run.status).toBe(WorkflowRunStatus.DENIED);
    expect(run.errorMessage).toBe('Too risky.');

    await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/reject`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Duplicate reject.' })
      .expect(422);
  });

  it('blocks auditors from approving and rejects expired approvals', async () => {
    const fixture = await createApprovalFixture();
    const approval = await createApprovalViaApi(fixture.runId, fixture.attemptId, 'Expired approval', {
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });

    await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${auditorToken}`)
      .send({ comment: 'Auditor cannot approve.' })
      .expect(403);

    const expired = await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Too late.' })
      .expect(400);
    expect(expired.body.error.message).toBe('Expired approvals cannot be decided.');

    const stored = await database.client.approvalRequest.findUniqueOrThrow({ where: { id: approval.id } });
    expect(stored.status).toBe(ApprovalStatus.EXPIRED);
  });

  it('rejects approve after reject and denies cross-org access', async () => {
    const fixture = await createApprovalFixture();
    const approval = await createApprovalViaApi(fixture.runId, fixture.attemptId, 'Reject then approve');

    await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/reject`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Rejected first.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/approvals/${approval.id}/approve`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Changed mind.' })
      .expect(422);

    await request(app.getHttpServer())
      .get(`/approvals/${approval.id}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });

  async function createApprovalFixture(): Promise<{ runId: string; attemptId: string }> {
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId,
        agentId: agentAId,
        vendorId: vendorAId,
        status: WorkflowRunStatus.RUNNING,
        startedAt: new Date(),
        currentStep: 'change_plan',
        stateJson: {}
      }
    });
    const attempt = await database.client.actionAttempt.create({
      data: {
        organizationId: organizationAId,
        workflowRunId: run.id,
        agentId: agentAId,
        vendorId: vendorAId,
        website: 'http://localhost:4202/billing',
        actionType: PrismaActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Action requires human approval.',
        inputSummary: 'Change plan to Starter.',
        amountCents: 50000,
        metadataJson: {}
      }
    });

    return { runId: run.id, attemptId: attempt.id };
  }

  async function createApprovalViaApi(
    targetRunId: string,
    actionAttemptId: string,
    summary: string,
    overrides: Record<string, unknown> = {}
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${targetRunId}/approval-requests`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        actionAttemptId,
        summary,
        riskLevel: 'HIGH',
        amountCents: 50000,
        policyTriggeredJson: { matchedRules: ['action.requires_approval.change_plan'] },
        ...overrides
      })
      .expect(201);

    return { id: response.body.data.id };
  }

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
