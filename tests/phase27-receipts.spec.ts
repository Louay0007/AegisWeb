import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ActionType,
  AgentStatus,
  ApprovalStatus,
  AuditActorType,
  AuditEventType,
  FileKind,
  PolicyDecision,
  ReceiptStatus,
  RiskLevel,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 27 receipts module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerToken: string;
  let auditorToken: string;
  let ownerBToken: string;
  let ownerAId: string;
  let agentAId: string;
  let vendorAId: string;
  let completedInvoiceReceiptId: string;
  let completedApprovalReceiptId: string;
  let failedReceiptId: string;
  let deniedReceiptId: string;
  let orgBReceiptId: string;
  let completedInvoiceRunId: string;

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
          name: 'Phase Twenty Seven Org A',
          domain: `phase27-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Twenty Seven Org B',
          domain: `phase27-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, auditorA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase27.dev`,
          name: 'Phase Twenty Seven Owner A',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `auditor-a-${unique}@phase27.dev`,
          name: 'Phase Twenty Seven Auditor A',
          role: UserRole.AUDITOR,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase27.dev`,
          name: 'Phase Twenty Seven Owner B',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerAId = ownerA.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    auditorToken = signFor(auditorA.id, auditorA.organizationId, auditorA.role, auditorA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [agentA, vendorA] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Twenty Seven Bot',
          identifier: `phase27-bot-${unique}@agentpass.local`,
          purpose: 'Receipt module tests.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Twenty Seven Acme',
          website: `https://phase27-acme-${unique}.example.dev`,
          category: VendorCategory.ANALYTICS
        }
      })
    ]);
    agentAId = agentA.id;
    vendorAId = vendorA.id;

    completedInvoiceReceiptId = await seedReceipt({
      name: 'Completed Invoice',
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
      runStatus: WorkflowRunStatus.COMPLETED,
      receiptStatus: ReceiptStatus.COMPLETED,
      summary: 'Invoice receipt ready.',
      resultSummary: 'Downloaded latest invoice.',
      includeInvoice: true,
      includeSecretAudit: true
    });
    completedApprovalReceiptId = await seedReceipt({
      name: 'Completed Approval',
      template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
      runStatus: WorkflowRunStatus.COMPLETED,
      receiptStatus: ReceiptStatus.COMPLETED,
      summary: 'Approved downgrade receipt ready.',
      resultSummary: 'Approved sandbox downgrade submitted.',
      includeApproval: true
    });
    failedReceiptId = await seedReceipt({
      name: 'Failed Invoice',
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
      runStatus: WorkflowRunStatus.FAILED,
      receiptStatus: ReceiptStatus.FAILED,
      summary: 'Invoice workflow failed.',
      errorMessage: 'Sandbox login failed.'
    });
    deniedReceiptId = await seedReceipt({
      name: 'Denied Policy',
      template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
      runStatus: WorkflowRunStatus.DENIED,
      receiptStatus: ReceiptStatus.DENIED,
      summary: 'Policy denied invoice workflow.',
      errorMessage: 'Vendor domain is not allowed by policy.'
    });
    orgBReceiptId = await seedOtherOrgReceipt(unique, ownerB.id);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('lists receipts with pagination and final status filtering', async () => {
    const list = await request(app.getHttpServer())
      .get('/receipts')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(list.body.meta.total).toBeGreaterThanOrEqual(4);
    expect(list.body.data.map((receipt: { id: string }) => receipt.id)).toEqual(
      expect.arrayContaining([completedInvoiceReceiptId, completedApprovalReceiptId, failedReceiptId, deniedReceiptId])
    );
    expect(list.body.data.map((receipt: { id: string }) => receipt.id)).not.toContain(orgBReceiptId);

    const failed = await request(app.getHttpServer())
      .get('/receipts')
      .query({ finalStatus: 'failed' })
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(200);

    expect(failed.body.data.map((receipt: { id: string }) => receipt.id)).toContain(failedReceiptId);
    expect(failed.body.data.every((receipt: { finalStatus: string }) => receipt.finalStatus === 'failed')).toBe(true);
  });

  it('gets a completed invoice receipt with sorted timeline, files, and policy decisions', async () => {
    const response = await request(app.getHttpServer())
      .get(`/receipts/${completedInvoiceReceiptId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: completedInvoiceReceiptId,
      finalStatus: 'completed',
      workflowRunId: completedInvoiceRunId,
      summary: expect.stringContaining('Downloaded latest invoice.'),
      files: expect.arrayContaining([
        expect.objectContaining({
          kind: FileKind.INVOICE,
          mimeType: 'application/pdf'
        })
      ]),
      policyDecisions: expect.arrayContaining([
        expect.objectContaining({
          actionType: ActionType.DOWNLOAD_FILE,
          policyDecision: PolicyDecision.ALLOW
        })
      ])
    });

    const timeline = response.body.data.timeline as Array<{ at: string; type: string }>;
    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline.map((entry) => entry.at)).toEqual([...timeline.map((entry) => entry.at)].sort());
  });

  it('gets approval, failed, and denied receipts with the required details', async () => {
    const approval = await request(app.getHttpServer())
      .get(`/receipts/${completedApprovalReceiptId}`)
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(200);
    expect(approval.body.data.approvalDetails).toMatchObject({
      approvals: [
        expect.objectContaining({
          status: ApprovalStatus.APPROVED,
          summary: 'Approve downgrade'
        })
      ]
    });

    const failed = await request(app.getHttpServer())
      .get(`/receipts/${failedReceiptId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(failed.body.data).toMatchObject({
      finalStatus: 'failed',
      summary: expect.stringContaining('Sandbox login failed.'),
      workflowRun: {
        errorMessage: 'Sandbox login failed.'
      }
    });

    const denied = await request(app.getHttpServer())
      .get(`/receipts/${deniedReceiptId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(denied.body.data).toMatchObject({
      finalStatus: 'denied',
      workflowRun: {
        errorMessage: 'Vendor domain is not allowed by policy.'
      }
    });
  });

  it('redacts secrets from receipt detail and export', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/receipts/${completedInvoiceReceiptId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const detailJson = JSON.stringify(detail.body);

    expect(detailJson).not.toContain('raw-phase27-password');
    expect(detailJson).not.toContain('phase27-token');
    expect(detailJson).not.toContain('ciphertext-value');
    expect(detailJson).toContain('[REDACTED]');

    const exported = await request(app.getHttpServer())
      .get(`/receipts/${completedInvoiceReceiptId}/export`)
      .set('authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(exported.headers['content-type']).toContain('application/json');
    expect(exported.headers['content-disposition']).toContain(`receipt-${completedInvoiceReceiptId}.json`);
    const exportText = (exported.body as Buffer).toString('utf8');
    expect(exportText).not.toContain('raw-phase27-password');
    expect(exportText).not.toContain('phase27-token');
    expect(exportText).toContain(completedInvoiceReceiptId);
  });

  it('denies cross-organization receipt reads and export', async () => {
    await request(app.getHttpServer())
      .get(`/receipts/${completedInvoiceReceiptId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/receipts/${completedInvoiceReceiptId}/export`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });

  async function seedReceipt(input: {
    name: string;
    template: WorkflowTemplate;
    runStatus: WorkflowRunStatus;
    receiptStatus: ReceiptStatus;
    summary: string;
    resultSummary?: string;
    errorMessage?: string;
    includeInvoice?: boolean;
    includeApproval?: boolean;
    includeSecretAudit?: boolean;
  }): Promise<string> {
    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        vendorId: vendorAId,
        name: `Phase Twenty Seven ${input.name}`,
        template: input.template,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerAId
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: agentAId,
        vendorId: vendorAId,
        status: input.runStatus,
        startedAt: new Date('2026-06-06T10:00:00.000Z'),
        completedAt: new Date('2026-06-06T10:05:00.000Z'),
        currentStep: input.runStatus === WorkflowRunStatus.COMPLETED ? 'done' : 'stopped',
        resultSummary: input.resultSummary,
        errorMessage: input.errorMessage,
        stateJson: {}
      }
    });
    if (input.includeInvoice) {
      completedInvoiceRunId = run.id;
    }

    await database.client.auditEvent.createMany({
      data: [
        {
          organizationId: organizationAId,
          workflowRunId: run.id,
          agentId: agentAId,
          actorType: AuditActorType.WORKER,
          eventType: AuditEventType.WORKFLOW_RUN_STARTED,
          eventDataJson: { step: 'started' },
          eventHash: crypto.randomUUID(),
          createdAt: new Date('2026-06-06T10:00:00.000Z')
        },
        {
          organizationId: organizationAId,
          workflowRunId: run.id,
          agentId: agentAId,
          actorType: AuditActorType.WORKER,
          eventType: input.runStatus === WorkflowRunStatus.DENIED ? AuditEventType.WORKFLOW_RUN_DENIED : AuditEventType.WORKFLOW_RUN_COMPLETED,
          eventDataJson: input.includeSecretAudit
            ? {
                password: 'raw-phase27-password',
                token: 'phase27-token',
                encryptedPayload: { ciphertext: 'ciphertext-value' }
              }
            : { step: 'terminal' },
          eventHash: crypto.randomUUID(),
          createdAt: new Date('2026-06-06T10:04:00.000Z')
        }
      ]
    });

    const action = await database.client.actionAttempt.create({
      data: {
        organizationId: organizationAId,
        workflowRunId: run.id,
        agentId: agentAId,
        vendorId: vendorAId,
        website: 'http://localhost:4202/billing',
        actionType: input.includeApproval ? ActionType.CHANGE_PLAN : ActionType.DOWNLOAD_FILE,
        riskLevel: input.includeApproval ? RiskLevel.HIGH : RiskLevel.LOW,
        policyDecision: input.includeApproval ? PolicyDecision.REQUIRE_APPROVAL : PolicyDecision.ALLOW,
        policyReason: input.includeApproval ? 'Approval required.' : 'Read-only allowed.',
        inputSummary: input.includeApproval ? 'Prepare downgrade.' : 'Download invoice.',
        outputSummary: input.includeApproval ? 'Approval requested.' : 'Invoice downloaded.',
        amountCents: input.includeApproval ? 48000 : null,
        metadataJson: input.includeSecretAudit ? { password: 'raw-phase27-password' } : {},
        createdAt: new Date('2026-06-06T10:01:00.000Z'),
        completedAt: new Date('2026-06-06T10:02:00.000Z')
      }
    });

    const file = input.includeInvoice
      ? await database.client.file.create({
          data: {
            organizationId: organizationAId,
            workflowRunId: run.id,
            kind: FileKind.INVOICE,
            bucket: 'agentpass-artifacts',
            objectKey: `organizations/${organizationAId}/workflow-runs/${run.id}/invoice.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 128,
            sha256: 'phase27invoicehash',
            createdAt: new Date('2026-06-06T10:03:00.000Z')
          }
        })
      : null;

    if (input.includeApproval) {
      await database.client.approvalRequest.create({
        data: {
          organizationId: organizationAId,
          workflowRunId: run.id,
          actionAttemptId: action.id,
          status: ApprovalStatus.APPROVED,
          requestedByAgentId: agentAId,
          approverUserId: ownerAId,
          summary: 'Approve downgrade',
          riskLevel: RiskLevel.HIGH,
          amountCents: 48000,
          approvedAt: new Date('2026-06-06T10:03:00.000Z'),
          policyTriggeredJson: { matchedRules: ['action.requires_approval.change_plan'] }
        }
      });
    }

    const receipt = await database.client.receipt.create({
      data: {
        organizationId: organizationAId,
        workflowRunId: run.id,
        agentId: agentAId,
        finalStatus: input.receiptStatus,
        summary: input.summary,
        timelineJson: [],
        screenshotsJson: [],
        filesJson: file
          ? [
              {
                id: file.id,
                kind: file.kind,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                sha256: file.sha256
              }
            ]
          : [],
        policyDecisionsJson: [
          {
            actionAttemptId: action.id,
            actionType: action.actionType,
            policyDecision: action.policyDecision,
            riskLevel: action.riskLevel
          }
        ],
        approvalDetailsJson: input.includeApproval
          ? {
              resultJson: { status: 'submitted' },
              approvals: [{ status: ApprovalStatus.APPROVED, summary: 'Approve downgrade' }]
            }
          : {}
      }
    });

    return receipt.id;
  }

  async function seedOtherOrgReceipt(unique: string, ownerBId: string): Promise<string> {
    const agent = await database.client.agent.create({
      data: {
        organizationId: organizationBId,
        name: 'Phase Twenty Seven Other Bot',
        identifier: `phase27-other-bot-${unique}@agentpass.local`,
        purpose: 'Cross org receipt fixture.',
        status: AgentStatus.ACTIVE,
        createdByUserId: ownerBId
      }
    });
    const vendor = await database.client.vendor.create({
      data: {
        organizationId: organizationBId,
        name: 'Phase Twenty Seven Other Vendor',
        website: `https://phase27-other-${unique}.example.dev`,
        category: VendorCategory.OTHER
      }
    });
    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationBId,
        agentId: agent.id,
        vendorId: vendor.id,
        name: 'Phase Twenty Seven Other Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerBId
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationBId,
        workflowId: workflow.id,
        agentId: agent.id,
        vendorId: vendor.id,
        status: WorkflowRunStatus.COMPLETED,
        stateJson: {}
      }
    });
    const receipt = await database.client.receipt.create({
      data: {
        organizationId: organizationBId,
        workflowRunId: run.id,
        agentId: agent.id,
        finalStatus: ReceiptStatus.COMPLETED,
        summary: 'Other org receipt.',
        timelineJson: [],
        screenshotsJson: [],
        filesJson: [],
        policyDecisionsJson: [],
        approvalDetailsJson: {}
      }
    });

    return receipt.id;
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
