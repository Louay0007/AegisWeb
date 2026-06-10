import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditEventType,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { VendorCategory } from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { VendorRiskProfileService } from '../apps/api/src/vendors/vendor-risk-profile.service.js';
import { VendorUrlService } from '../apps/api/src/vendors/vendor-url.service.js';

describe('phase 10 vendors module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let urlService: VendorUrlService;
  let riskProfileService: VendorRiskProfileService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerBId: string;
  let ownerToken: string;
  let approverToken: string;
  let ownerBToken: string;
  let vendorId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    urlService = app.get(VendorUrlService);
    riskProfileService = app.get(VendorRiskProfileService);

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Ten Org A',
          domain: `phase10-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Ten Org B',
          domain: `phase10-b-${unique}.dev`,
          plan: 'local'
        }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, approverA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase10.dev`,
          name: 'Phase Ten Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase10.dev`,
          name: 'Phase Ten Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase10.dev`,
          name: 'Phase Ten Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('normalizes vendor URLs while preserving local sandbox paths', () => {
    expect(urlService.normalize(' HTTPS://Example.COM/path/?utm=1#top ')).toBe('https://example.com/path');
    expect(urlService.normalize('http://LOCALHOST:4202/nimbus/?x=1')).toBe('http://localhost:4202/nimbus');
    expect(urlService.normalize('http://localhost:4202/')).toBe('http://localhost:4202');
  });

  it('creates, lists, gets, and updates vendors with risk profiles and audit events', async () => {
    const create = await request(app.getHttpServer())
      .post('/vendors')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Acme Analytics',
        website: 'HTTP://LOCALHOST:4202/acme/?utm=phase10',
        category: VendorCategory.Analytics,
        renewalDate: '2026-07-15',
        monthlyCostCents: 80000,
        ownerUserId: ownerAId,
        metadataJson: {
          risk: 'medium',
          unusedSeats: 5
        }
      })
      .expect(201);

    vendorId = create.body.data.id;
    expect(create.body.data).toMatchObject({
      organizationId: organizationAId,
      name: 'Acme Analytics',
      website: 'http://localhost:4202/acme',
      category: VendorCategory.Analytics,
      renewalDate: '2026-07-15',
      monthlyCostCents: 80000,
      ownerUserId: ownerAId,
      riskProfile: {
        level: 'medium'
      }
    });

    const list = await request(app.getHttpServer())
      .get('/vendors')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.some((vendor: { id: string }) => vendor.id === vendorId)).toBe(true);
    expect(list.body.data.every((vendor: { organizationId: string }) => vendor.organizationId === organizationAId)).toBe(true);

    const get = await request(app.getHttpServer())
      .get(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(get.body.data.id).toBe(vendorId);

    const update = await request(app.getHttpServer())
      .patch(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Acme Analytics Updated',
        website: 'http://localhost:4202/acme-renewals/',
        monthlyCostCents: 110000,
        metadataJson: { risk: 'high' }
      })
      .expect(200);
    expect(update.body.data).toMatchObject({
      id: vendorId,
      name: 'Acme Analytics Updated',
      website: 'http://localhost:4202/acme-renewals',
      monthlyCostCents: 110000,
      riskProfile: { level: 'high' }
    });

    const auditTypes = await database.client.auditEvent.findMany({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: { in: [AuditEventType.VENDOR_CREATED, AuditEventType.VENDOR_UPDATED] }
      },
      select: { eventType: true }
    });
    expect(auditTypes.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([AuditEventType.VENDOR_CREATED, AuditEventType.VENDOR_UPDATED])
    );
  });

  it('blocks duplicate active vendor websites in the same organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/vendors')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Duplicate Acme',
        website: 'http://localhost:4202/acme-renewals/?duplicate=true',
        category: VendorCategory.Analytics
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Active vendor website already exists.'
    });
  });

  it('allows approvers to read vendors but blocks create/update/delete', async () => {
    await request(app.getHttpServer())
      .get(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${approverToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/vendors')
      .set('authorization', `Bearer ${approverToken}`)
      .send({
        name: 'Blocked Vendor',
        website: 'https://blocked.example.dev',
        category: VendorCategory.Other
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${approverToken}`)
      .send({ name: 'Blocked Update' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${approverToken}`)
      .expect(403);
  });

  it('rejects cross-organization vendor reads and owner assignments', async () => {
    await request(app.getHttpServer())
      .get(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    const response = await request(app.getHttpServer())
      .patch(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ ownerUserId: ownerBId })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'ORGANIZATION_ISOLATION_VIOLATION'
    });
  });

  it('hard deletes vendors without workflows and soft deletes vendors with workflows', async () => {
    const hardDeleteVendor = await request(app.getHttpServer())
      .post('/vendors')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Temporary Vendor',
        website: `https://temporary-${crypto.randomUUID()}.example.dev`,
        category: VendorCategory.Other
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/vendors/${hardDeleteVendor.body.data.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await expect(database.client.vendor.findUnique({ where: { id: hardDeleteVendor.body.data.id } })).resolves.toBeNull();

    const agent = await database.client.agent.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Ten Agent',
        identifier: `phase-ten-agent-${crypto.randomUUID()}@agentpass.local`,
        purpose: 'Vendor delete test.',
        status: AgentStatus.ACTIVE,
        createdByUserId: ownerAId
      }
    });
    await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agent.id,
        vendorId,
        name: 'Phase Ten Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        createdByUserId: ownerAId
      }
    });

    const softDelete = await request(app.getHttpServer())
      .delete(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(softDelete.body.data).toMatchObject({
      id: vendorId,
      deletedAt: expect.any(String)
    });

    await request(app.getHttpServer())
      .get(`/vendors/${vendorId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    const deletedAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.VENDOR_DELETED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(deletedAudit?.eventDataJson).toMatchObject({
      vendorId,
      softDeleted: true
    });
  });

  it('builds default risk profiles from category and spend', async () => {
    const payrollVendor = await database.client.vendor.create({
      data: {
        organizationId: organizationAId,
        name: 'PayrollPro',
        website: `https://payroll-${crypto.randomUUID()}.example.dev`,
        category: PrismaVendorCategory.PAYROLL
      }
    });
    const highSpendVendor = await database.client.vendor.create({
      data: {
        organizationId: organizationAId,
        name: 'Atlas CRM',
        website: `https://atlas-${crypto.randomUUID()}.example.dev`,
        category: PrismaVendorCategory.SALES,
        monthlyCostCents: 150000
      }
    });

    expect(riskProfileService.build(payrollVendor)).toMatchObject({ level: 'blocked' });
    expect(riskProfileService.build(highSpendVendor)).toMatchObject({ level: 'high' });
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
