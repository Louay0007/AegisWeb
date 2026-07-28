import 'dotenv/config';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import {
  ActionType,
  AgentStatus,
  ApprovalStatus,
  AuditActorType,
  AuditEventType,
  ConnectorType,
  CredentialStatus,
  CredentialType,
  FileKind,
  PolicyDecision,
  PolicyStatus,
  PolicyType,
  ReceiptStatus,
  RiskLevel,
  UserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { encryptSecret } from '@agentpass/vault';
import { createPrismaClient } from './prisma.js';

const prisma = createPrismaClient();

const DEMO_DOMAIN = 'northstarlabs.dev';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const VENDOR_SANDBOX_URL = (process.env.VENDOR_SANDBOX_URL ?? 'http://localhost:4202').replace(/\/$/, '');
const VENDOR_SANDBOX_HOST = new URL(VENDOR_SANDBOX_URL).hostname;
const VENDOR_ALLOWED_DOMAINS = Array.from(
  new Set(['localhost', 'vendor-sandbox', VENDOR_SANDBOX_HOST, 'sandbox.aegisweb.local', 'dashboard.stripe.com', 'github.com'])
);

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

type AuditInput = {
  organizationId: string;
  workflowRunId?: string;
  agentId?: string;
  actorType: AuditActorType;
  actorId?: string;
  eventType: AuditEventType;
  eventDataJson: Prisma.InputJsonObject;
};

let previousAuditHash: string | undefined;

function encryptDemoSecret(payload: Record<string, string>): Prisma.InputJsonObject {
  return encryptSecret(payload, process.env.VAULT_MASTER_KEY ?? 'local-vault-master-key-change-before-production');
}

function hashAuditEvent(input: AuditInput, prevHash?: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        organizationId: input.organizationId,
        workflowRunId: input.workflowRunId ?? null,
        agentId: input.agentId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        eventType: input.eventType,
        eventDataJson: input.eventDataJson,
        prevHash: prevHash ?? null
      })
    )
    .digest('hex');
}

async function demoAgentIdentifier(preferred: string, organizationId: string): Promise<string> {
  const existing = await prisma.agent.findUnique({
    where: { identifier: preferred },
    select: { id: true }
  });

  if (!existing) {
    return preferred;
  }

  const [localPart, domain] = preferred.split('@');
  return `${localPart}-${organizationId.slice(0, 8)}@${domain}`;
}

async function recordAudit(input: AuditInput) {
  const eventHash = hashAuditEvent(input, previousAuditHash);

  const event = await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      workflowRunId: input.workflowRunId,
      agentId: input.agentId,
      actorType: input.actorType,
      actorId: input.actorId,
      eventType: input.eventType,
      eventDataJson: input.eventDataJson,
      prevHash: previousAuditHash,
      eventHash
    }
  });

  previousAuditHash = eventHash;
  return event;
}

export async function seedDemoData(): Promise<void> {
  await prisma.organization.deleteMany({
    where: {
      domain: DEMO_DOMAIN
    }
  });

  previousAuditHash = undefined;

  const organization = await prisma.organization.create({
    data: {
      name: 'Northstar Labs',
      domain: DEMO_DOMAIN,
      plan: 'business',
      billingEmail: 'billing@northstarlabs.dev'
    }
  });

  await recordAudit({
    organizationId: organization.id,
    actorType: AuditActorType.SYSTEM,
    eventType: AuditEventType.ORGANIZATION_CREATED,
    eventDataJson: { name: organization.name, domain: organization.domain, plan: organization.plan }
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1
  });

  const owner = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'founder@northstarlabs.dev',
      name: 'Maya Chen',
      role: UserRole.OWNER,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });
  const approver = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'finance@northstarlabs.dev',
      name: 'Leo Martinez',
      role: UserRole.APPROVER,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });
  const auditor = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'auditor@northstarlabs.dev',
      name: 'Priya Shah',
      role: UserRole.AUDITOR,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });
  const developer = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'dev@northstarlabs.dev',
      name: 'Samir Haddad',
      role: UserRole.DEVELOPER,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });

  for (const user of [owner, approver, auditor, developer]) {
    await recordAudit({
      organizationId: organization.id,
      actorType: AuditActorType.SYSTEM,
      actorId: user.id,
      eventType: AuditEventType.USER_REGISTERED,
      eventDataJson: { email: user.email, role: user.role }
    });
  }

  const procurementBot = await prisma.agent.create({
    data: {
      organizationId: organization.id,
      name: 'Procurement Bot',
      identifier: await demoAgentIdentifier('procurement-bot@agentpass.local', organization.id),
      purpose: 'Manage SaaS invoices, renewals, and vendor billing workflows.',
      status: AgentStatus.ACTIVE,
      createdByUserId: owner.id
    }
  });
  const invoiceCollector = await prisma.agent.create({
    data: {
      organizationId: organization.id,
      name: 'Invoice Collector',
      identifier: await demoAgentIdentifier('invoice-collector@agentpass.local', organization.id),
      purpose: 'Download invoices from approved SaaS vendor portals.',
      status: AgentStatus.ACTIVE,
      createdByUserId: owner.id
    }
  });
  const riskyAdminBot = await prisma.agent.create({
    data: {
      organizationId: organization.id,
      name: 'Risky Admin Bot',
      identifier: await demoAgentIdentifier('risky-admin-bot@agentpass.local', organization.id),
      purpose: 'Test denied admin/security actions.',
      status: AgentStatus.PAUSED,
      createdByUserId: owner.id
    }
  });
  const legacySpendBot = await prisma.agent.create({
    data: {
      organizationId: organization.id,
      name: 'Legacy Spend Bot',
      identifier: await demoAgentIdentifier('legacy-spend-bot@agentpass.local', organization.id),
      purpose: 'Historical revoked agent for audit examples.',
      status: AgentStatus.REVOKED,
      createdByUserId: owner.id,
      revokedAt: new Date('2026-05-15T12:00:00.000Z')
    }
  });

  for (const agent of [procurementBot, invoiceCollector, riskyAdminBot, legacySpendBot]) {
    await recordAudit({
      organizationId: organization.id,
      agentId: agent.id,
      actorType: AuditActorType.USER,
      actorId: owner.id,
      eventType: AuditEventType.AGENT_CREATED,
      eventDataJson: { name: agent.name, identifier: agent.identifier, status: agent.status }
    });
  }

  const acme = await createVendor('Acme Analytics', VENDOR_SANDBOX_URL, VendorCategory.ANALYTICS, '2026-07-15', 80000, owner.id, {
    renewalMonthlyPriceCents: 110000,
    unusedSeats: 5,
    risk: 'medium'
  }, ConnectorType.SANDBOX);
  const nimbus = await createVendor('Nimbus Docs', `${VENDOR_SANDBOX_URL}/nimbus`, VendorCategory.PRODUCTIVITY, '2026-08-01', 24000, owner.id, {
    renewalMonthlyPriceCents: 24000,
    unusedSeats: 2,
    risk: 'low'
  }, ConnectorType.SANDBOX);
  const atlas = await createVendor('Atlas CRM', `${VENDOR_SANDBOX_URL}/atlas`, VendorCategory.SALES, '2026-06-30', 150000, owner.id, {
    renewalMonthlyPriceCents: 190000,
    unusedSeats: 8,
    risk: 'high'
  }, ConnectorType.SANDBOX);
  const payroll = await createVendor('PayrollPro', `${VENDOR_SANDBOX_URL}/payroll`, VendorCategory.PAYROLL, '2026-09-01', 95000, owner.id, {
    risk: 'blocked'
  }, ConnectorType.SANDBOX);
  const stripeBilling = await createVendor('Stripe Billing', 'https://dashboard.stripe.com', VendorCategory.FINANCE, '2026-12-01', 29900, owner.id, {
    renewalMonthlyPriceCents: 29900,
    connectorNotes: 'Phase 2 Stripe Billing connector. Use real Stripe portal credentials + optional TOTP.',
    risk: 'medium'
  }, ConnectorType.STRIPE_BILLING);
  const githubOrg = await createVendor('GitHub Organization', 'https://github.com', VendorCategory.OTHER, '2026-11-01', 21000, owner.id, {
    renewalMonthlyPriceCents: 21000,
    githubOrg: 'northstarlabs',
    connectorNotes: 'Phase 2 GitHub connector. Use org owner credentials + optional TOTP.',
    risk: 'medium'
  }, ConnectorType.GITHUB);

  async function createVendor(
    name: string,
    website: string,
    category: VendorCategory,
    renewalDate: string,
    monthlyCostCents: number,
    ownerUserId: string,
    metadataJson: Prisma.InputJsonObject,
    connectorType: ConnectorType = ConnectorType.SANDBOX
  ) {
    const vendor = await prisma.vendor.create({
      data: {
        organizationId: organization.id,
        name,
        website,
        category,
        renewalDate: new Date(`${renewalDate}T00:00:00.000Z`),
        monthlyCostCents,
        ownerUserId,
        connectorType,
        metadataJson
      }
    });

    await recordAudit({
      organizationId: organization.id,
      actorType: AuditActorType.USER,
      actorId: owner.id,
      eventType: AuditEventType.VENDOR_CREATED,
      eventDataJson: { name, website, category, connectorType }
    });

    return vendor;
  }

  const procurementPolicy = await prisma.policy.create({
    data: {
      organizationId: organization.id,
      agentId: procurementBot.id,
      name: 'Procurement Bot Standard Policy',
      type: PolicyType.AGENT_POLICY_BUNDLE,
      version: 1,
      status: PolicyStatus.ACTIVE,
      createdByUserId: owner.id,
      rulesJson: {
        allowedDomains: VENDOR_ALLOWED_DOMAINS,
        blockedDomains: ['bank.example', 'payroll.example'],
        allowedActions: ['open_page', 'read_page', 'fill_form', 'download_file', 'credential_injection'],
        approvalRequiredActions: ['submit_form', 'change_plan', 'cancel_subscription', 'make_purchase'],
        deniedActions: ['invite_user', 'change_billing_details'],
        autoApproveBelowCents: 10000,
        approvalRequiredAboveCents: 10000,
        denyAboveCents: 100000,
        dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
        businessHours: { enabled: false }
      }
    }
  });
  const invoicePolicy = await prisma.policy.create({
    data: {
      organizationId: organization.id,
      agentId: invoiceCollector.id,
      name: 'Invoice Collector Read Only',
      type: PolicyType.AGENT_POLICY_BUNDLE,
      version: 1,
      status: PolicyStatus.ACTIVE,
      createdByUserId: owner.id,
      rulesJson: {
        allowedDomains: VENDOR_ALLOWED_DOMAINS,
        blockedDomains: [],
        allowedActions: ['open_page', 'read_page', 'download_file', 'credential_injection'],
        approvalRequiredActions: [],
        deniedActions: ['submit_form', 'change_plan', 'cancel_subscription', 'make_purchase', 'invite_user', 'change_billing_details'],
        autoApproveBelowCents: 0,
        approvalRequiredAboveCents: 0,
        denyAboveCents: 1
      }
    }
  });

  for (const policy of [procurementPolicy, invoicePolicy]) {
    await recordAudit({
      organizationId: organization.id,
      agentId: policy.agentId ?? undefined,
      actorType: AuditActorType.USER,
      actorId: owner.id,
      eventType: AuditEventType.POLICY_CREATED,
      eventDataJson: { name: policy.name, type: policy.type, version: policy.version }
    });
  }

  const acmeCredential = await createCredential(acme.id, 'Acme Analytics Finance Login', 'finance@northstarlabs.dev', 'acme-local-password', [procurementBot.id, invoiceCollector.id]);
  await createCredential(nimbus.id, 'Nimbus Docs Billing Login', 'billing@northstarlabs.dev', 'nimbus-local-password', [invoiceCollector.id]);
  await createCredential(atlas.id, 'Atlas CRM Ops Login', 'ops@northstarlabs.dev', 'atlas-local-password', [procurementBot.id]);
  await createCredential(payroll.id, 'PayrollPro Payroll Login', 'payroll@northstarlabs.dev', 'payroll-local-password', []);
  await createCredential(stripeBilling.id, 'Stripe Dashboard Finance Login', 'finance@northstarlabs.dev', 'replace-with-stripe-password', [procurementBot.id]);
  await createCredential(githubOrg.id, 'GitHub Org Owner Login', 'ops@northstarlabs.dev', 'replace-with-github-password', [procurementBot.id]);

  async function createCredential(vendorId: string, label: string, username: string, password: string, agentIds: string[]) {
    const credential = await prisma.credential.create({
      data: {
        organizationId: organization.id,
        vendorId,
        label,
        credentialType: CredentialType.USERNAME_PASSWORD,
        encryptedPayload: encryptDemoSecret({ username, password }),
        encryptionVersion: 'local-v1',
        status: CredentialStatus.ACTIVE,
        createdByUserId: owner.id
      }
    });

    await recordAudit({
      organizationId: organization.id,
      actorType: AuditActorType.USER,
      actorId: owner.id,
      eventType: AuditEventType.CREDENTIAL_CREATED,
      eventDataJson: { credentialId: credential.id, label, vendorId }
    });

    for (const agentId of agentIds) {
      await prisma.credentialAgentGrant.create({
        data: {
          credentialId: credential.id,
          agentId,
          scope: 'login',
          createdByUserId: owner.id
        }
      });
      await recordAudit({
        organizationId: organization.id,
        agentId,
        actorType: AuditActorType.USER,
        actorId: owner.id,
        eventType: AuditEventType.CREDENTIAL_GRANTED_TO_AGENT,
        eventDataJson: { credentialId: credential.id, scope: 'login' }
      });
    }

    return credential;
  }

  const acmeInvoiceWorkflow = await createWorkflow('Acme Invoice Download', WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD, invoiceCollector.id, acme.id, { credentialId: acmeCredential.id });
  const acmeRenewalWorkflow = await createWorkflow('Acme Renewal Check', WorkflowTemplate.SAAS_RENEWAL_CHECK, procurementBot.id, acme.id, { expectedRenewalDate: '2026-07-15' });
  const acmeDowngradeWorkflow = await createWorkflow('Acme Downgrade Request', WorkflowTemplate.PLAN_DOWNGRADE_REQUEST, procurementBot.id, acme.id, {
    credentialId: acmeCredential.id,
    targetPlan: 'Starter',
    estimatedMonthlySavingsCents: 48000
  });
  const atlasRenewalWorkflow = await createWorkflow('Atlas Renewal Check', WorkflowTemplate.SAAS_RENEWAL_CHECK, procurementBot.id, atlas.id, {});
  await createWorkflow('Payroll Read Attempt', WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD, procurementBot.id, payroll.id, { expectedResult: 'denied' });

  async function createWorkflow(name: string, template: WorkflowTemplate, agentId: string, vendorId: string, configurationJson: Prisma.InputJsonObject) {
    const workflow = await prisma.workflow.create({
      data: {
        organizationId: organization.id,
        agentId,
        vendorId,
        name,
        template,
        status: WorkflowStatus.ACTIVE,
        configurationJson,
        createdByUserId: owner.id
      }
    });

    await recordAudit({
      organizationId: organization.id,
      agentId,
      actorType: AuditActorType.USER,
      actorId: owner.id,
      eventType: AuditEventType.WORKFLOW_CREATED,
      eventDataJson: { name, template, vendorId }
    });

    return workflow;
  }

  await createCompletedInvoiceRun(acmeInvoiceWorkflow.id, invoiceCollector.id, acme.id);
  await createCompletedRenewalRun(acmeRenewalWorkflow.id, procurementBot.id, acme.id);
  await createPendingApprovalRun(acmeDowngradeWorkflow.id, procurementBot.id, acme.id);
  await createApprovedDowngradeRun(acmeDowngradeWorkflow.id, procurementBot.id, acme.id);
  await createRejectedRun(acmeDowngradeWorkflow.id, procurementBot.id, nimbus.id);
  await createExpiredApprovalRun(acmeDowngradeWorkflow.id, procurementBot.id, atlas.id);
  await createFailedRun(atlasRenewalWorkflow.id, procurementBot.id, atlas.id);
  await createDeniedRun(acmeInvoiceWorkflow.id, procurementBot.id, payroll.id);
  await createCanceledRun(acmeRenewalWorkflow.id, procurementBot.id, acme.id);

  async function createFile(workflowRunId: string, kind: FileKind, objectKey: string, mimeType: string, sizeBytes: number) {
    return prisma.file.create({
      data: {
        organizationId: organization.id,
        workflowRunId,
        kind,
        bucket: 'agentpass-local',
        objectKey,
        mimeType,
        sizeBytes,
        sha256: createHash('sha256').update(objectKey).digest('hex')
      }
    });
  }

  async function createCompletedInvoiceRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.COMPLETED, 'Downloaded latest Acme Analytics invoice.', 'download_invoice');
    const invoice = await createFile(run.id, FileKind.INVOICE, `${organization.id}/${run.id}/invoice-acme-2026-06.pdf`, 'application/pdf', 24576);
    const screenshot = await createFile(run.id, FileKind.SCREENSHOT, `${organization.id}/${run.id}/billing-before-download.png`, 'image/png', 98304);

    await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/billing`,
        actionType: ActionType.DOWNLOAD_FILE,
        riskLevel: RiskLevel.LOW,
        policyDecision: PolicyDecision.ALLOW,
        policyReason: 'Invoice downloads are allowed for approved vendors.',
        outputSummary: 'Downloaded invoice PDF.',
        metadataJson: { fileId: invoice.id },
        completedAt: new Date()
      }
    });

    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.WORKER, eventType: AuditEventType.FILE_DOWNLOADED, eventDataJson: { fileId: invoice.id } });
    await createReceipt(run.id, agentId, ReceiptStatus.COMPLETED, 'Invoice downloaded successfully.', [invoice], [screenshot], []);
  }

  async function createCompletedRenewalRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.COMPLETED, 'Acme renewal increases from $800 to $1,100/month.', 'read_renewal');

    await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/billing`,
        actionType: ActionType.READ_PAGE,
        riskLevel: RiskLevel.LOW,
        policyDecision: PolicyDecision.ALLOW,
        outputSummary: 'Renewal date 2026-07-15, renewal price $1,100/month.',
        metadataJson: { currentPlan: 'Growth', unusedSeats: 5 },
        completedAt: new Date()
      }
    });

    await createReceipt(run.id, agentId, ReceiptStatus.COMPLETED, 'Renewal checked successfully.', [], [], []);
  }

  async function createPendingApprovalRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.WAITING_FOR_APPROVAL, 'Waiting for approval to downgrade Acme Analytics.', 'approval_requested');
    const screenshot = await createFile(run.id, FileKind.SCREENSHOT, `${organization.id}/${run.id}/downgrade-review.png`, 'image/png', 120000);
    const action = await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/billing`,
        actionType: ActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Plan changes require human approval.',
        inputSummary: 'Downgrade Growth plan to Starter.',
        amountCents: 48000,
        metadataJson: { targetPlan: 'Starter' }
      }
    });
    await prisma.approvalRequest.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        actionAttemptId: action.id,
        status: ApprovalStatus.PENDING,
        requestedByAgentId: agentId,
        summary: 'Procurement Bot wants to downgrade Acme Analytics from Growth to Starter. Estimated savings: $480/month.',
        riskLevel: RiskLevel.HIGH,
        amountCents: 48000,
        screenshotFileId: screenshot.id,
        policyTriggeredJson: { rule: 'change_plan_requires_approval' },
        expiresAt: daysFromNow(7)
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.WORKER, eventType: AuditEventType.APPROVAL_REQUESTED, eventDataJson: { summary: 'Acme downgrade approval requested.' } });
  }

  async function createApprovedDowngradeRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.COMPLETED, 'Approved downgrade completed for Acme Analytics.', 'completed');
    const screenshot = await createFile(run.id, FileKind.SCREENSHOT, `${organization.id}/${run.id}/downgrade-complete.png`, 'image/png', 118000);
    const action = await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/billing`,
        actionType: ActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Plan changes require approval.',
        outputSummary: 'Downgrade submitted after approval.',
        amountCents: 48000,
        completedAt: new Date()
      }
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        actionAttemptId: action.id,
        status: ApprovalStatus.APPROVED,
        requestedByAgentId: agentId,
        approverUserId: approver.id,
        summary: 'Approved Acme Analytics downgrade.',
        riskLevel: RiskLevel.HIGH,
        amountCents: 48000,
        screenshotFileId: screenshot.id,
        policyTriggeredJson: { rule: 'change_plan_requires_approval' },
        approvedAt: new Date('2026-06-06T10:15:00.000Z'),
        comment: 'Approved. Unused seats confirmed.'
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.USER, actorId: approver.id, eventType: AuditEventType.APPROVAL_APPROVED, eventDataJson: { approvalRequestId: approval.id } });
    await createReceipt(run.id, agentId, ReceiptStatus.COMPLETED, 'Downgrade approved and completed.', [], [screenshot], [approval.id]);
  }

  async function createRejectedRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.DENIED, 'Cancellation request rejected by finance.', 'denied');
    const action = await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/nimbus/billing`,
        actionType: ActionType.CANCEL_SUBSCRIPTION,
        riskLevel: RiskLevel.CRITICAL,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Cancellation requires approval.',
        inputSummary: 'Cancel Nimbus Docs.',
        completedAt: new Date()
      }
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        actionAttemptId: action.id,
        status: ApprovalStatus.REJECTED,
        requestedByAgentId: agentId,
        approverUserId: approver.id,
        summary: 'Procurement Bot requested cancellation of Nimbus Docs.',
        riskLevel: RiskLevel.CRITICAL,
        policyTriggeredJson: { rule: 'cancel_subscription_requires_approval' },
        rejectedAt: new Date('2026-06-04T09:00:00.000Z'),
        comment: 'Keep Nimbus Docs until legal export is complete.'
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.USER, actorId: approver.id, eventType: AuditEventType.APPROVAL_REJECTED, eventDataJson: { approvalRequestId: approval.id } });
    await createReceipt(run.id, agentId, ReceiptStatus.DENIED, 'Cancellation rejected by approver.', [], [], [approval.id]);
  }

  async function createExpiredApprovalRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.FAILED, 'Late Atlas CRM plan change approval expired.', 'approval_expired', 'Approval expired before review.');
    const action = await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/atlas/billing`,
        actionType: ActionType.CHANGE_PLAN,
        riskLevel: RiskLevel.HIGH,
        policyDecision: PolicyDecision.REQUIRE_APPROVAL,
        policyReason: 'Plan changes require approval.',
        inputSummary: 'Reduce Atlas CRM seats before renewal.',
        amountCents: 32000
      }
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        actionAttemptId: action.id,
        status: ApprovalStatus.EXPIRED,
        requestedByAgentId: agentId,
        summary: 'Procurement Bot requested a late Atlas CRM plan change that was not reviewed.',
        riskLevel: RiskLevel.HIGH,
        amountCents: 32000,
        policyTriggeredJson: { rule: 'change_plan_requires_approval' },
        expiresAt: new Date('2026-06-01T12:00:00.000Z')
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.SYSTEM, eventType: AuditEventType.APPROVAL_EXPIRED, eventDataJson: { approvalRequestId: approval.id } });
    await createReceipt(run.id, agentId, ReceiptStatus.FAILED, 'Approval expired before action.', [], [], [approval.id]);
  }

  async function createFailedRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.FAILED, 'Login failed due to bad credential.', 'login', 'Invalid username or password.');
    await createReceipt(run.id, agentId, ReceiptStatus.FAILED, 'Workflow failed during login.', [], [], []);
  }

  async function createDeniedRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.DENIED, 'Policy denied blocked payroll portal.', 'policy_denied');
    await prisma.actionAttempt.create({
      data: {
        organizationId: organization.id,
        workflowRunId: run.id,
        agentId,
        vendorId,
        website: `${VENDOR_SANDBOX_URL}/payroll`,
        actionType: ActionType.OPEN_PAGE,
        riskLevel: RiskLevel.CRITICAL,
        policyDecision: PolicyDecision.DENY,
        policyReason: 'Payroll portals are blocked for procurement workflows.',
        completedAt: new Date()
      }
    });
    await createReceipt(run.id, agentId, ReceiptStatus.DENIED, 'Workflow denied by policy before navigation.', [], [], []);
  }

  async function createCanceledRun(workflowId: string, agentId: string, vendorId: string) {
    const run = await createRun(workflowId, agentId, vendorId, WorkflowRunStatus.CANCELED, 'Run canceled by owner before browser start.', 'canceled');
    await createReceipt(run.id, agentId, ReceiptStatus.CANCELED, 'Workflow canceled before execution.', [], [], []);
  }

  async function createRun(
    workflowId: string,
    agentId: string,
    vendorId: string,
    status: WorkflowRunStatus,
    resultSummary: string,
    currentStep: string,
    errorMessage?: string
  ) {
    const terminalStatuses: WorkflowRunStatus[] = [
      WorkflowRunStatus.COMPLETED,
      WorkflowRunStatus.FAILED,
      WorkflowRunStatus.CANCELED,
      WorkflowRunStatus.DENIED
    ];
    const isTerminal = terminalStatuses.includes(status);
    const run = await prisma.workflowRun.create({
      data: {
        organizationId: organization.id,
        workflowId,
        agentId,
        vendorId,
        status,
        startedAt: status === WorkflowRunStatus.QUEUED ? undefined : new Date('2026-06-06T10:00:00.000Z'),
        completedAt: isTerminal ? new Date('2026-06-06T10:20:00.000Z') : undefined,
        currentStep,
        resultSummary,
        errorMessage,
        stateJson: { seeded: true }
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId: run.id, agentId, actorType: AuditActorType.SYSTEM, eventType: AuditEventType.WORKFLOW_RUN_CREATED, eventDataJson: { status, workflowId } });
    return run;
  }

  async function createReceipt(
    workflowRunId: string,
    agentId: string,
    finalStatus: ReceiptStatus,
    summary: string,
    files: { id: string; kind: FileKind; objectKey: string }[],
    screenshots: { id: string; objectKey: string }[],
    approvalIds: string[]
  ) {
    const receipt = await prisma.receipt.create({
      data: {
        organizationId: organization.id,
        workflowRunId,
        agentId,
        finalStatus,
        summary,
        timelineJson: [
          { label: 'Run created', status: 'ok' },
          { label: summary, status: finalStatus.toLowerCase() }
        ],
        screenshotsJson: screenshots.map((screenshot) => ({ fileId: screenshot.id, objectKey: screenshot.objectKey })),
        filesJson: files.map((file) => ({ fileId: file.id, kind: file.kind, objectKey: file.objectKey })),
        policyDecisionsJson: [{ decision: 'allow_or_recorded', source: 'seed' }],
        approvalDetailsJson: { approvalIds }
      }
    });
    await recordAudit({ organizationId: organization.id, workflowRunId, agentId, actorType: AuditActorType.SYSTEM, eventType: AuditEventType.RECEIPT_CREATED, eventDataJson: { receiptId: receipt.id, finalStatus } });
    return receipt;
  }

  console.log(`Seeded AegisWeb demo data for ${organization.name}`);
  console.log(`Demo password for all users: ${DEMO_PASSWORD}`);
  console.log('Demo users: founder@ / finance@ / auditor@ / dev@ northstarlabs.dev');
  console.log(`Vendors: Acme (sandbox), Nimbus, Atlas, PayrollPro, Stripe Billing (${stripeBilling.connectorType}), GitHub (${githubOrg.connectorType})`);
}

export async function disconnectSeedPrisma(): Promise<void> {
  await prisma.$disconnect();
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  seedDemoData()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectSeedPrisma();
    });
}
