import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ActionType,
  AgentStatus,
  AuditEventType,
  PolicyDecision,
  RiskLevel,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { EmailNotificationAdapter } from '../apps/api/src/notifications/email-notification.adapter.js';
import { EmailMessage, EmailSendResult } from '../apps/api/src/notifications/notifications.types.js';

class FakeEmailNotificationAdapter {
  messages: EmailMessage[] = [];
  failure: Error | null = null;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(message);
    if (this.failure) {
      throw this.failure;
    }

    return {
      messageId: `fake-message-${this.messages.length}`,
      recipientCount: message.to.length
    };
  }
}

describe('phase 28 notifications module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let config: ConfigService;
  let emailAdapter: FakeEmailNotificationAdapter;
  let organizationId: string;
  let ownerEmail: string;
  let approverEmail: string;
  let auditorEmail: string;
  let disabledApproverEmail: string;
  let ownerId: string;
  let agentId: string;
  let vendorId: string;
  let workflowId: string;

  beforeAll(async () => {
    emailAdapter = new FakeEmailNotificationAdapter();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(EmailNotificationAdapter)
      .useValue(emailAdapter)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    config = app.get(ConfigService);

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Phase Twenty Eight Org',
        domain: `phase28-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationId = organization.id;
    ownerEmail = `owner-${unique}@phase28.dev`;
    approverEmail = `approver-${unique}@phase28.dev`;
    auditorEmail = `auditor-${unique}@phase28.dev`;
    disabledApproverEmail = `disabled-approver-${unique}@phase28.dev`;

    const [owner] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId,
          email: ownerEmail,
          name: 'Phase Twenty Eight Owner',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId,
          email: approverEmail,
          name: 'Phase Twenty Eight Approver',
          role: UserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId,
          email: auditorEmail,
          name: 'Phase Twenty Eight Auditor',
          role: UserRole.AUDITOR,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId,
          email: disabledApproverEmail,
          name: 'Phase Twenty Eight Disabled Approver',
          role: UserRole.APPROVER,
          status: UserStatus.DISABLED,
          passwordHash: 'unused'
        }
      })
    ]);
    ownerId = owner.id;

    const [agent, vendor] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId,
          name: 'Phase Twenty Eight Bot',
          identifier: `phase28-bot-${unique}@agentpass.local`,
          purpose: 'Notification module tests.',
          status: AgentStatus.ACTIVE,
          createdByUserId: owner.id
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId,
          name: 'Phase Twenty Eight Acme',
          website: `https://phase28-acme-${unique}.example.dev`,
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
        name: 'Phase Twenty Eight Downgrade',
        template: WorkflowTemplate.PLAN_DOWNGRADE_REQUEST,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerId
      }
    });
    workflowId = workflow.id;
  }, 30000);

  beforeEach(() => {
    emailAdapter.messages = [];
    emailAdapter.failure = null;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends a local approval email with dashboard context and without secret policy values', async () => {
    const fixture = await createApprovalFixture();
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${fixture.runId}/approval-requests`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        actionAttemptId: fixture.attemptId,
        summary: 'Approve downgrade to Starter',
        riskLevel: 'HIGH',
        amountCents: 48000,
        policyTriggeredJson: {
          matchedRules: ['action.requires_approval.change_plan'],
          token: 'super-secret-token'
        }
      })
      .expect(201);

    expect(emailAdapter.messages).toHaveLength(1);
    const message = emailAdapter.messages[0];
    const recipients = message.to.map((recipient) => recipient.email);
    expect(recipients).toEqual(expect.arrayContaining([ownerEmail, approverEmail]));
    expect(recipients).not.toEqual(expect.arrayContaining([auditorEmail, disabledApproverEmail]));
    expect(message.subject).toContain('Approval required');
    expect(message.text).toContain(`${config.config.dashboardBaseUrl}/app/approvals/${response.body.data.id}`);
    expect(message.text).toContain('Phase Twenty Eight Acme');
    expect(message.text).toContain('action.requires_approval.change_plan');
    expect(message.text).not.toContain('super-secret-token');
    expect(message.html).not.toContain('super-secret-token');

    const audit = await findApprovalRequestedAudit(fixture.runId);
    expect(audit.eventDataJson).toMatchObject({
      notification: {
        channel: 'email',
        delivered: true,
        approvalRequestId: response.body.data.id,
        recipients: expect.arrayContaining([ownerEmail, approverEmail]),
        dashboardUrl: `${config.config.dashboardBaseUrl}/app/approvals/${response.body.data.id}`
      }
    });
  });

  it('records a warning when email delivery fails without breaking approval creation', async () => {
    emailAdapter.failure = new Error('SMTP offline');
    const fixture = await createApprovalFixture();
    const response = await request(app.getHttpServer())
      .post(`/internal/workers/runs/${fixture.runId}/approval-requests`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({
        actionAttemptId: fixture.attemptId,
        summary: 'Approve risky cancellation',
        riskLevel: 'HIGH',
        amountCents: 90000,
        policyTriggeredJson: { matchedRules: ['action.requires_approval.cancel_subscription'] }
      })
      .expect(201);

    expect(response.body.data.status).toBe('pending');
    expect(emailAdapter.messages).toHaveLength(1);

    const audit = await findApprovalRequestedAudit(fixture.runId);
    expect(audit.eventDataJson).toMatchObject({
      notification: {
        channel: 'email',
        delivered: false,
        approvalRequestId: response.body.data.id,
        warning: 'SMTP offline'
      }
    });
  });

  async function createApprovalFixture(): Promise<{ runId: string; attemptId: string }> {
    const run = await database.client.workflowRun.create({
      data: {
        organizationId,
        workflowId,
        agentId,
        vendorId,
        status: WorkflowRunStatus.RUNNING,
        startedAt: new Date(),
        currentStep: 'change_plan',
        stateJson: {}
      }
    });
    const attempt = await database.client.actionAttempt.create({
      data: {
        organizationId,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: 'http://localhost:4202/billing',
        actionType: ActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Plan changes require human approval.',
        inputSummary: 'Change plan to Starter.',
        amountCents: 48000,
        metadataJson: {}
      }
    });

    return { runId: run.id, attemptId: attempt.id };
  }

  async function findApprovalRequestedAudit(workflowRunId: string) {
    return database.client.auditEvent.findFirstOrThrow({
      where: {
        organizationId,
        workflowRunId,
        eventType: AuditEventType.APPROVAL_REQUESTED
      }
    });
  }
});
