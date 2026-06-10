import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  ActionType as PrismaActionType,
  AgentStatus,
  ApprovalStatus,
  AuditActorType,
  AuditEventType,
  CredentialStatus,
  CredentialType as PrismaCredentialType,
  FileKind,
  PolicyDecision,
  PolicyStatus,
  PolicyType,
  ReceiptStatus,
  RiskLevel,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory,
  WorkflowRunStatus as PrismaWorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate as PrismaWorkflowTemplate
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
import {
  WORKFLOW_QUEUE_JOB_NAMES,
  WORKFLOW_QUEUE_NAMES,
  workflowCancelJobId,
  workflowStartJobId
} from '../apps/api/src/queue/workflow-queue.types.js';
import { WorkflowRunStateMachine } from '../apps/api/src/workflow-runs/workflow-run-state-machine.js';

const policyRules: AgentPolicySnapshot = {
  allowedDomains: ['localhost', 'acme.example.com'],
  blockedDomains: [],
  allowedActions: [
    ActionType.OpenPage,
    ActionType.ReadPage,
    ActionType.DownloadFile,
    ActionType.CredentialInjection
  ],
  deniedActions: [ActionType.InviteUser, ActionType.ChangeBillingDetails],
  approvalRequiredActions: [ActionType.SubmitForm, ActionType.ChangePlan],
  autoApproveBelowCents: 10000,
  approvalRequiredAboveCents: 10000,
  denyAboveCents: 100000,
  dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
  businessHours: { enabled: false }
};

describe('phase 15 workflow runs module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let stateMachine: WorkflowRunStateMachine;
  let queue: Queue;
  let maintenanceQueue: Queue;
  let organizationAId: string;
  let organizationBId: string;
  let ownerToken: string;
  let developerToken: string;
  let approverToken: string;
  let ownerBToken: string;
  let agentAId: string;
  let vendorAId: string;
  let credentialId: string;
  let workflowId: string;
  let queuedRunId: string;
  let detailRunId: string;
  let runningRunId: string;
  let completedRunId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);
    stateMachine = app.get(WorkflowRunStateMachine);
    queue = new Queue(WORKFLOW_QUEUE_NAMES.runs, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });
    maintenanceQueue = new Queue(WORKFLOW_QUEUE_NAMES.maintenance, {
      connection: connectionFromRedisUrl(config.redisUrl)
    });

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Fifteen Org A',
          domain: `phase15-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Fifteen Org B',
          domain: `phase15-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, developerA, approverA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase15.dev`,
          name: 'Phase Fifteen Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `developer-a-${unique}@phase15.dev`,
          name: 'Phase Fifteen Developer A',
          role: PrismaUserRole.DEVELOPER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase15.dev`,
          name: 'Phase Fifteen Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase15.dev`,
          name: 'Phase Fifteen Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    developerToken = signFor(developerA.id, developerA.organizationId, developerA.role, developerA.email);
    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [agentA, vendorA] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fifteen Bot',
          identifier: `phase15-bot-${unique}@agentpass.local`,
          purpose: 'Track workflow runs.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Fifteen Acme',
          website: `https://phase15-acme-${unique}.example.dev`,
          category: PrismaVendorCategory.ANALYTICS
        }
      })
    ]);
    agentAId = agentA.id;
    vendorAId = vendorA.id;

    await database.client.policy.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        name: 'Phase Fifteen Active Policy',
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE,
        rulesJson: policyRules,
        createdByUserId: ownerA.id
      }
    });

    const encryptedPayload = encryptSecret(
      { username: 'finance@phase15.dev', password: 'phase15-local-password' },
      config.config.vaultMasterKey
    );
    const credential = await database.client.credential.create({
      data: {
        organizationId: organizationAId,
        vendorId: vendorAId,
        label: 'Phase Fifteen Login',
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

    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Fifteen Invoice Workflow',
        template: PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: { credentialId },
        createdByUserId: ownerA.id
      }
    });
    workflowId = workflow.id;

    const queuedRun = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId,
        agentId: agentAId,
        vendorId: vendorAId,
        status: PrismaWorkflowRunStatus.QUEUED,
        stateJson: {
          requestedByUserId: ownerA.id,
          template: PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
          configurationJson: { credentialId },
          testScenario: 'phase15-cancel-queued'
        }
      }
    });
    queuedRunId = queuedRun.id;
    await queue.add(
      WORKFLOW_QUEUE_JOB_NAMES.start,
      {
        workflowRunId: queuedRun.id,
        workflowId,
        organizationId: organizationAId,
        agentId: agentAId,
        vendorId: vendorAId,
        template: PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        mode: 'start',
        approvalRequestId: null,
        attempt: 1,
        requestedAt: new Date().toISOString()
      },
      {
        jobId: workflowStartJobId(queuedRun.id),
        delay: 60 * 60 * 1000,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    const [detailRun, runningRun, completedRun] = await Promise.all([
      database.client.workflowRun.create({
        data: {
          organizationId: organizationAId,
          workflowId,
          agentId: agentAId,
          vendorId: vendorAId,
          status: PrismaWorkflowRunStatus.WAITING_FOR_APPROVAL,
          currentStep: 'awaiting_approval',
          stateJson: { phase: 15 }
        }
      }),
      database.client.workflowRun.create({
        data: {
          organizationId: organizationAId,
          workflowId,
          agentId: agentAId,
          vendorId: vendorAId,
          status: PrismaWorkflowRunStatus.RUNNING,
          currentStep: 'browser_running',
          startedAt: new Date(),
          stateJson: {}
        }
      }),
      database.client.workflowRun.create({
        data: {
          organizationId: organizationAId,
          workflowId,
          agentId: agentAId,
          vendorId: vendorAId,
          status: PrismaWorkflowRunStatus.COMPLETED,
          currentStep: 'done',
          startedAt: new Date(),
          completedAt: new Date(),
          stateJson: {}
        }
      })
    ]);
    detailRunId = detailRun.id;
    runningRunId = runningRun.id;
    completedRunId = completedRun.id;

    await seedRunDetail(detailRun.id);
  }, 30000);

  afterAll(async () => {
    await Promise.all([queue.close(), maintenanceQueue.close()]);
    await app.close();
  });

  it('centralizes allowed and forbidden state transitions', () => {
    expect(() =>
      stateMachine.assertCanTransition(PrismaWorkflowRunStatus.QUEUED, PrismaWorkflowRunStatus.RUNNING)
    ).not.toThrow();
    expect(() =>
      stateMachine.assertCanTransition(PrismaWorkflowRunStatus.RUNNING, PrismaWorkflowRunStatus.CANCELED)
    ).not.toThrow();
    expect(() =>
      stateMachine.assertCanTransition(PrismaWorkflowRunStatus.COMPLETED, PrismaWorkflowRunStatus.RUNNING)
    ).toThrow(/cannot transition/);
  });

  it('lists workflow runs with filters and pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/workflow-runs')
      .query({
        workflowId,
        status: WorkflowRunStatus.Queued,
        limit: 10,
        offset: 0
      })
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((run: { workflowId: string; status: string }) => run.workflowId === workflowId && run.status === WorkflowRunStatus.Queued)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      workflow: {
        id: workflowId,
        name: 'Phase Fifteen Invoice Workflow',
        template: WorkflowTemplate.VendorInvoiceDownload
      },
      agent: {
        id: agentAId
      },
      vendor: {
        id: vendorAId
      }
    });
  });

  it('gets run detail with recent attempts, files, approval request, and receipt link', async () => {
    const response = await request(app.getHttpServer())
      .get(`/workflow-runs/${detailRunId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: detailRunId,
      status: WorkflowRunStatus.WaitingForApproval,
      actionAttempts: [
        {
          actionType: ActionType.ChangePlan,
          policyDecision: 'require_approval'
        }
      ],
      files: [
        {
          kind: 'screenshot',
          mimeType: 'image/png'
        }
      ],
      approvalRequests: [
        {
          status: 'pending',
          summary: 'Approve plan change'
        }
      ],
      receipt: {
        finalStatus: 'completed',
        summary: 'Phase fifteen receipt'
      }
    });
  });

  it('cancels queued runs, stores reason, removes queued job, and records audit', async () => {
    const cancel = await request(app.getHttpServer())
      .post(`/workflow-runs/${queuedRunId}/cancel`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'No longer needed.' })
      .expect(201);

    expect(cancel.body.data).toMatchObject({
      id: queuedRunId,
      status: WorkflowRunStatus.Canceled,
      errorMessage: 'No longer needed.'
    });
    expect(cancel.body.data.stateJson).toMatchObject({
      transitionReason: 'No longer needed.'
    });
    expect(cancel.body.data.stateJson.transitions[0]).toMatchObject({
      to: 'CANCELED',
      reason: 'No longer needed.',
      removedQueuedJob: true
    });

    const job = await queue.getJob(workflowStartJobId(queuedRunId));
    expect(job).toBeFalsy();

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        workflowRunId: queuedRunId,
        eventType: AuditEventType.WORKFLOW_RUN_CANCELED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      workflowRunId: queuedRunId,
      reason: 'No longer needed.',
      previousStatus: 'QUEUED',
      removedQueuedJob: true
    });
  });

  it('cancels running runs and creates a worker cancellation signal', async () => {
    const cancel = await request(app.getHttpServer())
      .post(`/workflow-runs/${runningRunId}/cancel`)
      .set('authorization', `Bearer ${developerToken}`)
      .send({ reason: 'Operator stopped run.' })
      .expect(201);

    expect(cancel.body.data.status).toBe(WorkflowRunStatus.Canceled);

    const cancelJob = await maintenanceQueue.getJob(workflowCancelJobId(runningRunId));
    expect(cancelJob?.data).toMatchObject({
      workflowRunId: runningRunId,
      organizationId: organizationAId,
      reason: 'Operator stopped run.',
      mode: 'cancel'
    });
  });

  it('rejects terminal run cancellation', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workflow-runs/${completedRunId}/cancel`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Too late.' })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: 'WORKFLOW_INVALID_TRANSITION'
    });
  });

  it('returns audit timeline for a run', async () => {
    await database.client.auditEvent.create({
      data: {
        organizationId: organizationAId,
        workflowRunId: detailRunId,
        agentId: agentAId,
        actorType: AuditActorType.SYSTEM,
        eventType: AuditEventType.WORKFLOW_RUN_STARTED,
        eventDataJson: { step: 'started' },
        eventHash: crypto.randomUUID()
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/workflow-runs/${detailRunId}/events`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.map((event: { eventType: string }) => event.eventType)).toContain('WORKFLOW_RUN_STARTED');
  });

  it('enforces RBAC and cross-organization isolation', async () => {
    await request(app.getHttpServer())
      .post(`/workflow-runs/${detailRunId}/cancel`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ reason: 'Approver cannot cancel.' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/workflow-runs/${detailRunId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/workflow-runs/${detailRunId}/events`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });

  async function seedRunDetail(workflowRunId: string): Promise<void> {
    const attempt = await database.client.actionAttempt.create({
      data: {
        organizationId: organizationAId,
        workflowRunId,
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
    const file = await database.client.file.create({
      data: {
        organizationId: organizationAId,
        workflowRunId,
        kind: FileKind.SCREENSHOT,
        bucket: 'agentpass-artifacts',
        objectKey: `${organizationAId}/${workflowRunId}/approval.png`,
        mimeType: 'image/png',
        sizeBytes: 128,
        sha256: 'phase15sha256'
      }
    });
    await database.client.approvalRequest.create({
      data: {
        organizationId: organizationAId,
        workflowRunId,
        actionAttemptId: attempt.id,
        status: ApprovalStatus.PENDING,
        requestedByAgentId: agentAId,
        summary: 'Approve plan change',
        riskLevel: RiskLevel.HIGH,
        amountCents: 50000,
        screenshotFileId: file.id,
        policyTriggeredJson: { matchedRules: ['action.requires_approval.change_plan'] }
      }
    });
    await database.client.receipt.create({
      data: {
        organizationId: organizationAId,
        workflowRunId,
        agentId: agentAId,
        finalStatus: ReceiptStatus.COMPLETED,
        summary: 'Phase fifteen receipt',
        timelineJson: [],
        screenshotsJson: [],
        filesJson: [],
        policyDecisionsJson: [],
        approvalDetailsJson: {}
      }
    });
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
