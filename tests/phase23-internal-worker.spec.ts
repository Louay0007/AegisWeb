import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditEventType,
  CredentialStatus,
  CredentialType as PrismaCredentialType,
  FileKind,
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
import { AppModule } from '../apps/api/src/app.module.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 23 internal worker API', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let config: ConfigService;
  let organizationAId: string;
  let organizationBId: string;
  let agentAId: string;
  let vendorAId: string;
  let workflowAId: string;
  let runningRunId: string;
  let completeRunId: string;
  let failRunId: string;
  let failedRunId: string;
  let credentialWithoutGrantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    config = app.get(ConfigService);

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Twenty Three Org A',
          domain: `phase23-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Twenty Three Org B',
          domain: `phase23-b-${unique}.dev`,
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
          email: `owner-a-${unique}@phase23.dev`,
          name: 'Phase Twenty Three Owner A',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase23.dev`,
          name: 'Phase Twenty Three Owner B',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    const [agentA, vendorA, agentB, vendorB] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Twenty Three Bot',
          identifier: `phase23-bot-${unique}@agentpass.local`,
          purpose: 'Exercise internal worker APIs.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Twenty Three Acme',
          website: `https://phase23-acme-${unique}.example.dev`,
          category: VendorCategory.ANALYTICS
        }
      }),
      database.client.agent.create({
        data: {
          organizationId: organizationBId,
          name: 'Phase Twenty Three Other Bot',
          identifier: `phase23-other-bot-${unique}@agentpass.local`,
          purpose: 'Cross-organization guard fixture.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerB.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationBId,
          name: 'Phase Twenty Three Other Vendor',
          website: `https://phase23-other-${unique}.example.dev`,
          category: VendorCategory.OTHER
        }
      })
    ]);
    agentAId = agentA.id;
    vendorAId = vendorA.id;

    const [workflowA, workflowB] = await Promise.all([
      database.client.workflow.create({
        data: {
          organizationId: organizationAId,
          agentId: agentA.id,
          vendorId: vendorA.id,
          name: 'Phase Twenty Three Workflow',
          template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
          status: WorkflowStatus.ACTIVE,
          configurationJson: {},
          createdByUserId: ownerA.id
        }
      }),
      database.client.workflow.create({
        data: {
          organizationId: organizationBId,
          agentId: agentB.id,
          vendorId: vendorB.id,
          name: 'Phase Twenty Three Other Workflow',
          template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
          status: WorkflowStatus.ACTIVE,
          configurationJson: {},
          createdByUserId: ownerB.id
        }
      })
    ]);
    workflowAId = workflowA.id;

    const [runningRun, completeRun, failRun, failedRun] = await Promise.all([
      createRun(organizationAId, workflowA.id, agentA.id, vendorA.id, WorkflowRunStatus.RUNNING),
      createRun(organizationAId, workflowA.id, agentA.id, vendorA.id, WorkflowRunStatus.RUNNING),
      createRun(organizationAId, workflowA.id, agentA.id, vendorA.id, WorkflowRunStatus.RUNNING),
      createRun(organizationAId, workflowA.id, agentA.id, vendorA.id, WorkflowRunStatus.FAILED),
      createRun(organizationBId, workflowB.id, agentB.id, vendorB.id, WorkflowRunStatus.RUNNING)
    ]);
    runningRunId = runningRun.id;
    completeRunId = completeRun.id;
    failRunId = failRun.id;
    failedRunId = failedRun.id;

    const encryptedPayload = encryptSecret(
      { username: 'finance@phase23.dev', password: 'phase23-local-password' },
      config.config.vaultMasterKey
    );
    const credential = await database.client.credential.create({
      data: {
        organizationId: organizationAId,
        vendorId: vendorAId,
        label: 'Phase Twenty Three Ungranted Login',
        credentialType: PrismaCredentialType.USERNAME_PASSWORD,
        encryptedPayload,
        encryptionVersion: encryptedPayload.key_version,
        status: CredentialStatus.ACTIVE,
        createdByUserId: ownerA.id
      }
    });
    credentialWithoutGrantId = credential.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects missing and wrong worker tokens but accepts the configured token', async () => {
    const body = {
      organizationId: organizationAId,
      eventType: AuditEventType.WORKFLOW_STEP_STARTED,
      eventDataJson: { step: 'phase23-token-check' }
    };

    await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/events`)
      .send(body)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/events`)
      .set('x-worker-token', 'wrong-token')
      .send(body)
      .expect(403);

    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/events`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send(body)
      .expect(201);

    expect(response.body.data).toMatchObject({
      organizationId: organizationAId,
      workflowRunId: runningRunId,
      agentId: agentAId,
      actorType: 'WORKER',
      actorId: 'internal-worker',
      eventType: AuditEventType.WORKFLOW_STEP_STARTED,
      eventDataJson: {
        workflowRunId: runningRunId,
        step: 'phase23-token-check'
      }
    });
  });

  it('stores screenshots and worker files only for the scoped run', async () => {
    const screenshot = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/screenshots`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationAId,
        filename: 'billing-page.png',
        mimeType: 'image/png',
        bufferBase64: Buffer.from('phase23 screenshot bytes').toString('base64')
      })
      .expect(201);

    expect(screenshot.body.data).toMatchObject({
      organizationId: organizationAId,
      workflowRunId: runningRunId,
      kind: FileKind.SCREENSHOT,
      mimeType: 'image/png',
      sizeBytes: Buffer.byteLength('phase23 screenshot bytes')
    });

    const file = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/files`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationAId,
        kind: FileKind.DOWNLOAD,
        filename: 'invoice.txt',
        mimeType: 'text/plain',
        bufferBase64: Buffer.from('phase23 invoice bytes').toString('base64')
      })
      .expect(201);

    expect(file.body.data).toMatchObject({
      organizationId: organizationAId,
      workflowRunId: runningRunId,
      kind: FileKind.DOWNLOAD,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength('phase23 invoice bytes')
    });

    await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/files`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationBId,
        kind: FileKind.DOWNLOAD,
        filename: 'cross-org.txt',
        mimeType: 'text/plain',
        bufferBase64: Buffer.from('blocked').toString('base64')
      })
      .expect(403);
  });

  it('completes and fails runs through explicit worker transitions', async () => {
    const complete = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${completeRunId}/complete`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationAId,
        currentStep: 'receipt_pending',
        resultSummary: 'Phase 23 completed by worker.',
        stateJson: { extractedInvoiceCount: 1 }
      })
      .expect(201);

    expect(complete.body.data).toMatchObject({
      id: completeRunId,
      organizationId: organizationAId,
      workflowId: workflowAId,
      status: 'completed',
      currentStep: 'receipt_pending',
      resultSummary: 'Phase 23 completed by worker.',
      stateJson: {
        workerTransitions: [
          expect.objectContaining({
            extractedInvoiceCount: 1,
            from: WorkflowRunStatus.RUNNING,
            to: WorkflowRunStatus.COMPLETED
          })
        ]
      }
    });
    expect(complete.body.data.completedAt).toEqual(expect.any(String));

    const fail = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${failRunId}/fail`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationAId,
        currentStep: 'login',
        errorMessage: 'Vendor login form was unavailable.',
        stateJson: { retryable: true }
      })
      .expect(201);

    expect(fail.body.data).toMatchObject({
      id: failRunId,
      status: 'failed',
      currentStep: 'login',
      errorMessage: 'Vendor login form was unavailable.',
      stateJson: {
        workerTransitions: [
          expect.objectContaining({
            retryable: true,
            from: WorkflowRunStatus.RUNNING,
            to: WorkflowRunStatus.FAILED,
            errorMessage: 'Vendor login form was unavailable.'
          })
        ]
      }
    });

    const audits = await database.client.auditEvent.findMany({
      where: {
        organizationId: organizationAId,
        workflowRunId: { in: [completeRunId, failRunId] },
        eventType: { in: [AuditEventType.WORKFLOW_RUN_COMPLETED, AuditEventType.WORKFLOW_RUN_FAILED] }
      },
      select: { eventType: true }
    });
    expect(audits.map((audit) => audit.eventType)).toEqual(
      expect.arrayContaining([AuditEventType.WORKFLOW_RUN_COMPLETED, AuditEventType.WORKFLOW_RUN_FAILED])
    );
  });

  it('blocks worker updates for another organization scope', async () => {
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${runningRunId}/complete`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationBId,
        resultSummary: 'Cross-org update should not happen.'
      })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'ORGANIZATION_ISOLATION_VIOLATION'
    });
  });

  it('blocks credential decrypt without an active credential grant', async () => {
    const response = await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialWithoutGrantId}/decrypt-for-run`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({ workflowRunId: runningRunId })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Credential is not granted to the workflow agent.'
    });
    expect(JSON.stringify(response.body)).not.toContain('phase23-local-password');
  });

  it('does not complete an already failed run', async () => {
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${failedRunId}/complete`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        organizationId: organizationAId,
        resultSummary: 'Too late.'
      })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: 'WORKFLOW_INVALID_TRANSITION'
    });

    const stored = await database.client.workflowRun.findUniqueOrThrow({ where: { id: failedRunId } });
    expect(stored.status).toBe(WorkflowRunStatus.FAILED);
  });

  function createRun(
    organizationId: string,
    workflowId: string,
    agentId: string,
    vendorId: string,
    status: WorkflowRunStatus
  ) {
    return database.client.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        agentId,
        vendorId,
        status,
        startedAt: status === WorkflowRunStatus.RUNNING ? new Date() : undefined,
        completedAt: status === WorkflowRunStatus.FAILED ? new Date() : undefined,
        stateJson: {}
      }
    });
  }
});
