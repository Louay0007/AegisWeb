import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  ApprovalStatus,
  Prisma,
  WorkflowRunStatus
} from '@prisma/client';
import { createPrismaClient } from '@agentpass/database';
import { disconnectSeedPrisma, seedDemoData } from '../libs/database/src/seed.js';

const prisma = createPrismaClient();
const DEMO_DOMAIN = 'northstarlabs.dev';

const scopedTables = [
  'users',
  'agents',
  'vendors',
  'policies',
  'credentials',
  'workflows',
  'workflow_runs',
  'action_attempts',
  'approval_requests',
  'audit_events',
  'files',
  'receipts',
  'refresh_tokens'
] as const;

describe('phase 1 database and seed data', () => {
  beforeAll(async () => {
    await seedDemoData();
    await prisma.$connect();
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectSeedPrisma();
  });

  it('creates one rich demo organization with expected core records', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN },
      include: {
        users: true,
        agents: true,
        vendors: true,
        policies: true,
        credentials: true,
        workflows: true,
        workflowRuns: true,
        approvalRequests: true,
        receipts: true,
        auditEvents: true
      }
    });

    expect(organization.name).toBe('Northstar Labs');
    expect(organization.users).toHaveLength(4);
    expect(organization.agents).toHaveLength(4);
    expect(organization.vendors).toHaveLength(6);
    expect(organization.vendors.map((vendor) => vendor.connectorType)).toEqual(
      expect.arrayContaining(['SANDBOX', 'STRIPE_BILLING', 'GITHUB'])
    );
    expect(organization.policies).toHaveLength(2);
    expect(organization.credentials).toHaveLength(6);
    expect(organization.workflows).toHaveLength(5);
    expect(organization.workflowRuns.length).toBeGreaterThanOrEqual(9);
    expect(organization.approvalRequests).toHaveLength(4);
    expect(organization.receipts.length).toBeGreaterThanOrEqual(8);
    expect(organization.auditEvents.length).toBeGreaterThan(20);
  });

  it('can run seed repeatedly without duplicate demo organizations or users', async () => {
    await seedDemoData();

    const organizationCount = await prisma.organization.count({
      where: { domain: DEMO_DOMAIN }
    });
    const demoUserCount = await prisma.user.count({
      where: { email: { endsWith: `@${DEMO_DOMAIN}` } }
    });

    expect(organizationCount).toBe(1);
    expect(demoUserCount).toBe(4);
  }, 30000);

  it('stores all required approval states in the demo data', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN },
      select: { id: true }
    });
    const approvals = await prisma.approvalRequest.groupBy({
      by: ['status'],
      where: { organizationId: organization.id },
      _count: true
    });
    const states = Object.fromEntries(approvals.map((approval) => [approval.status, approval._count]));

    expect(states[ApprovalStatus.PENDING]).toBe(1);
    expect(states[ApprovalStatus.APPROVED]).toBe(1);
    expect(states[ApprovalStatus.REJECTED]).toBe(1);
    expect(states[ApprovalStatus.EXPIRED]).toBe(1);
  });

  it('stores varied historical workflow run outcomes', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN },
      select: { id: true }
    });
    const runs = await prisma.workflowRun.groupBy({
      by: ['status'],
      where: { organizationId: organization.id },
      _count: true
    });
    const states = Object.fromEntries(runs.map((run) => [run.status, run._count]));

    expect(states[WorkflowRunStatus.COMPLETED]).toBeGreaterThanOrEqual(3);
    expect(states[WorkflowRunStatus.WAITING_FOR_APPROVAL]).toBe(1);
    expect(states[WorkflowRunStatus.DENIED]).toBeGreaterThanOrEqual(2);
    expect(states[WorkflowRunStatus.FAILED]).toBeGreaterThanOrEqual(2);
    expect(states[WorkflowRunStatus.CANCELED]).toBe(1);
  });

  it('keeps organization_id on every organization-scoped table', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      select table_name
      from information_schema.columns
      where table_schema = 'public'
        and column_name = 'organization_id'
        and table_name in (${Prisma.join(scopedTables)})
      order by table_name
    `;

    expect(rows.map((row) => row.table_name).sort()).toEqual([...scopedTables].sort());
  });

  it('enforces unique user email constraints', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN }
    });

    await expect(
      prisma.user.create({
        data: {
          organizationId: organization.id,
          email: 'founder@northstarlabs.dev',
          name: 'Duplicate Founder',
          role: 'OWNER',
          passwordHash: 'duplicate',
          status: 'ACTIVE'
        }
      })
    ).rejects.toMatchObject({
      code: 'P2002'
    });
  });

  it('enforces foreign keys for organization-owned records', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'founder@northstarlabs.dev' }
    });

    await expect(
      prisma.agent.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000000',
          name: 'Invalid Agent',
          identifier: 'invalid-agent@agentpass.local',
          purpose: 'Should fail foreign key checks.',
          status: 'ACTIVE',
          createdByUserId: owner.id
        }
      })
    ).rejects.toMatchObject({
      code: 'P2003'
    });
  });

  it('stores credentials as encrypted payloads without plaintext secrets', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN },
      select: { id: true }
    });
    const credentials = await prisma.credential.findMany({
      where: { organizationId: organization.id }
    });
    const serialized = JSON.stringify(credentials);

    expect(credentials).toHaveLength(4);
    expect(serialized).not.toContain('acme-local-password');
    expect(serialized).not.toContain('nimbus-local-password');
    expect(serialized).not.toContain('atlas-local-password');
    expect(serialized).not.toContain('payroll-local-password');
    expect(serialized).toContain('ciphertext');
    expect(serialized).toContain('auth_tag');
  });

  it('creates exactly one receipt per receipted workflow run', async () => {
    const receipts = await prisma.receipt.findMany({
      select: { workflowRunId: true }
    });
    const uniqueRunIds = new Set(receipts.map((receipt) => receipt.workflowRunId));

    expect(uniqueRunIds.size).toBe(receipts.length);
  });

  it('creates a continuous audit hash chain', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { domain: DEMO_DOMAIN }
    });
    const events = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'asc' }
    });

    expect(events.length).toBeGreaterThan(20);
    expect(events[0]?.prevHash).toBeNull();

    for (let index = 1; index < events.length; index += 1) {
      expect(events[index]?.prevHash).toBe(events[index - 1]?.eventHash);
    }
  });
});
