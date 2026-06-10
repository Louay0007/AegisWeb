import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditEventType, UserRole as PrismaUserRole, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 8 organizations and users modules', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let organizationAId: string;
  let organizationBId: string;
  let soloOrganizationId: string;
  let ownerAId: string;
  let adminAId: string;
  let ownerBId: string;
  let soloOwnerId: string;
  let ownerToken: string;
  let adminToken: string;
  let approverToken: string;
  let ownerBToken: string;
  let soloOwnerToken: string;
  let invitedUserId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);

    const unique = crypto.randomUUID();
    const organizationA = await database.client.organization.create({
      data: {
        name: 'Phase Eight Org A',
        domain: `phase8-a-${unique}.dev`,
        plan: 'local'
      }
    });
    const organizationB = await database.client.organization.create({
      data: {
        name: 'Phase Eight Org B',
        domain: `phase8-b-${unique}.dev`,
        plan: 'local'
      }
    });
    const soloOrganization = await database.client.organization.create({
      data: {
        name: 'Phase Eight Solo Org',
        domain: `phase8-solo-${unique}.dev`,
        plan: 'local'
      }
    });

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    soloOrganizationId = soloOrganization.id;

    const [ownerA, adminA, approverA, ownerB, soloOwner] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase8.dev`,
          name: 'Phase Eight Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `admin-a-${unique}@phase8.dev`,
          name: 'Phase Eight Admin A',
          role: PrismaUserRole.ADMIN,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase8.dev`,
          name: 'Phase Eight Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase8.dev`,
          name: 'Phase Eight Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: soloOrganizationId,
          email: `solo-owner-${unique}@phase8.dev`,
          name: 'Phase Eight Solo Owner',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerAId = ownerA.id;
    adminAId = adminA.id;
    ownerBId = ownerB.id;
    soloOwnerId = soloOwner.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    adminToken = signFor(adminA.id, adminA.organizationId, adminA.role, adminA.email);
    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);
    soloOwnerToken = signFor(soloOwner.id, soloOwner.organizationId, soloOwner.role, soloOwner.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('reads only the current organization from authenticated context', async () => {
    const response = await request(app.getHttpServer())
      .get('/organization')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: organizationAId,
      name: 'Phase Eight Org A'
    });

    const otherResponse = await request(app.getHttpServer())
      .get('/organization')
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(200);

    expect(otherResponse.body.data).toMatchObject({
      id: organizationBId,
      name: 'Phase Eight Org B'
    });
  });

  it('allows only owners to update the organization and records audit', async () => {
    await request(app.getHttpServer())
      .patch('/organization')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Should Fail' })
      .expect(403);

    const response = await request(app.getHttpServer())
      .patch('/organization')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Phase Eight Org A Updated' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: organizationAId,
      name: 'Phase Eight Org A Updated'
    });

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.ORGANIZATION_UPDATED
      }
    });
    expect(audit?.eventDataJson).toMatchObject({
      name: 'Phase Eight Org A Updated'
    });
  });

  it('allows owner and admin invites, creates users in the same org, and blocks approvers', async () => {
    const adminInvite = await request(app.getHttpServer())
      .post('/users/invite')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        email: `invited-admin-${crypto.randomUUID()}@phase8.dev`,
        name: 'Admin Invited User',
        role: UserRole.Developer
      })
      .expect(201);

    expect(adminInvite.body.data).toMatchObject({
      organizationId: organizationAId,
      role: PrismaUserRole.DEVELOPER,
      status: UserStatus.INVITED
    });

    const ownerInvite = await request(app.getHttpServer())
      .post('/users/invite')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        email: `invited-owner-${crypto.randomUUID()}@phase8.dev`,
        name: 'Owner Invited User',
        role: UserRole.Approver
      })
      .expect(201);
    invitedUserId = ownerInvite.body.data.id;

    expect(ownerInvite.body.data).toMatchObject({
      organizationId: organizationAId,
      role: PrismaUserRole.APPROVER,
      status: UserStatus.INVITED
    });
    expect(JSON.stringify(ownerInvite.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .post('/users/invite')
      .set('authorization', `Bearer ${approverToken}`)
      .send({
        email: `blocked-${crypto.randomUUID()}@phase8.dev`,
        name: 'Blocked User',
        role: UserRole.Auditor
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/users/invite')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        email: `blocked-owner-${crypto.randomUUID()}@phase8.dev`,
        name: 'Blocked Owner',
        role: UserRole.Owner
      })
      .expect(403);

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.USER_INVITED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      invitedUserId,
      role: UserRole.Approver
    });
  });

  it('lists and reads users only inside the current organization', async () => {
    const list = await request(app.getHttpServer())
      .get('/users')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(4);
    expect(list.body.data.every((user: { organizationId: string }) => user.organizationId === organizationAId)).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .get(`/users/${ownerBId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    const ownUser = await request(app.getHttpServer())
      .get(`/users/${adminAId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(ownUser.body.data).toMatchObject({
      id: adminAId,
      organizationId: organizationAId,
      role: PrismaUserRole.ADMIN
    });
  });

  it('changes user roles with validation and audit while blocking invalid self-owner changes', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${invitedUserId}/role`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ role: 'not-a-role' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/users/${ownerAId}/role`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ role: UserRole.Owner })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/users/${invitedUserId}/role`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ role: UserRole.Owner })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/users/${ownerAId}/role`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ role: UserRole.Auditor })
      .expect(403);

    const response = await request(app.getHttpServer())
      .patch(`/users/${invitedUserId}/role`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ role: UserRole.Auditor })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: invitedUserId,
      role: PrismaUserRole.AUDITOR
    });

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.USER_ROLE_CHANGED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      userId: invitedUserId,
      nextRole: UserRole.Auditor
    });
  });

  it('disables users with audit and refuses to disable the last owner', async () => {
    const response = await request(app.getHttpServer())
      .post(`/users/${invitedUserId}/disable`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(response.body.data).toMatchObject({
      id: invitedUserId,
      status: UserStatus.DISABLED
    });
    expect(response.body.data.disabledAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/users/${soloOwnerId}/disable`)
      .set('authorization', `Bearer ${soloOwnerToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/users/${ownerAId}/disable`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(403);

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.USER_DISABLED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(audit?.eventDataJson).toMatchObject({
      userId: invitedUserId
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
