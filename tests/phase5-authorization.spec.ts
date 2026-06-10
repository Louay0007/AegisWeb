import { Body, Controller, Get, INestApplication, Inject, MiddlewareConsumer, Module, NestModule, Param, Post, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole as PrismaUserRole, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Permission, UserRole } from '@agentpass/domain';
import { AuthModule } from '../apps/api/src/auth/auth.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { AuthorizationModule } from '../apps/api/src/authorization/authorization.module.js';
import { InternalRoute, PublicRoute, RequirePermission, RequireRole } from '../apps/api/src/authorization/authorization-metadata.js';
import { InternalWorkerGuard } from '../apps/api/src/authorization/internal-worker.guard.js';
import { OrganizationScopeService } from '../apps/api/src/authorization/organization-scope.service.js';
import { ConfigModule } from '../apps/api/src/config/config.module.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseModule } from '../apps/api/src/database/database.module.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { ErrorsModule } from '../apps/api/src/errors/errors.module.js';
import { CurrentOrganizationId } from '../apps/api/src/request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../apps/api/src/request-context/current-user.decorator.js';
import { RequestContextMiddleware } from '../apps/api/src/request-context/request-context.middleware.js';
import { RequestContextModule } from '../apps/api/src/request-context/request-context.module.js';
import { ContextUser } from '../apps/api/src/request-context/types.js';

@Controller('phase5')
class Phase5ProbeController {
  constructor(@Inject(OrganizationScopeService) private readonly organizationScope: OrganizationScopeService) {}

  @PublicRoute()
  @Get('public')
  getPublic() {
    return { data: { ok: true } };
  }

  @Get('protected')
  getProtected(@CurrentUser() user: ContextUser | undefined) {
    return { data: { user } };
  }

  @RequirePermission(Permission.CredentialCreate)
  @Post('credentials')
  createCredential() {
    return { data: { created: true } };
  }

  @RequirePermission(Permission.ApprovalApprove)
  @Post('approvals')
  approve() {
    return { data: { approved: true } };
  }

  @RequireRole(UserRole.Auditor)
  @Get('auditor-only')
  auditorOnly() {
    return { data: { ok: true } };
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post('internal')
  internalWorker() {
    return { data: { accepted: true } };
  }

  @Post('orgs/:organizationId/resource')
  readScopedResource(
    @Param('organizationId') organizationId: string,
    @CurrentOrganizationId() currentOrganizationId: string | undefined,
    @Body() body: { value?: string }
  ) {
    this.organizationScope.assertSameOrganization(currentOrganizationId, organizationId);
    return {
      data: {
        organizationId,
        value: body.value ?? null
      }
    };
  }
}

@Module({
  imports: [ConfigModule, DatabaseModule, RequestContextModule, ErrorsModule, AuthModule, AuthorizationModule],
  controllers: [Phase5ProbeController]
})
class Phase5ProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

describe('phase 5 authorization and organization isolation', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let ownerToken: string;
  let approverToken: string;
  let auditorToken: string;
  let spoofedContextToken: string;
  let organizationAId: string;
  let organizationBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [Phase5ProbeModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);

    const unique = crypto.randomUUID();
    const organizationA = await database.client.organization.create({
      data: {
        name: 'Phase Five Org A',
        domain: `phase5-a-${unique}.dev`,
        plan: 'local'
      }
    });
    const organizationB = await database.client.organization.create({
      data: {
        name: 'Phase Five Org B',
        domain: `phase5-b-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [owner, approver, auditor] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-${unique}@phase5.dev`,
          name: 'Phase Five Owner',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-${unique}@phase5.dev`,
          name: 'Phase Five Approver',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `auditor-${unique}@phase5.dev`,
          name: 'Phase Five Auditor',
          role: PrismaUserRole.AUDITOR,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerToken = signFor(owner.id, owner.organizationId, owner.role, owner.email);
    approverToken = signFor(approver.id, approver.organizationId, approver.role, approver.email);
    auditorToken = signFor(auditor.id, auditor.organizationId, auditor.role, auditor.email);
    spoofedContextToken = ownerToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('protects routes by default while allowing explicit public routes', async () => {
    await request(app.getHttpServer()).get('/phase5/public').expect(200);

    const blocked = await request(app.getHttpServer()).get('/phase5/protected').expect(403);
    expect(blocked.body.error).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Authentication required.'
    });

    const allowed = await request(app.getHttpServer())
      .get('/phase5/protected')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(allowed.body.data.user).toMatchObject({
      organizationId: organizationAId,
      role: UserRole.Owner
    });
  });

  it('allows owners to perform all MVP permission checks', async () => {
    await request(app.getHttpServer())
      .post('/phase5/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/phase5/approvals')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
  });

  it('blocks approvers from creating credentials but allows approval decisions', async () => {
    await request(app.getHttpServer())
      .post('/phase5/credentials')
      .set('authorization', `Bearer ${approverToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/phase5/approvals')
      .set('authorization', `Bearer ${approverToken}`)
      .expect(201);
  });

  it('blocks auditors from approval actions while allowing auditor-only role checks', async () => {
    await request(app.getHttpServer())
      .post('/phase5/approvals')
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/phase5/auditor-only')
      .set('authorization', `Bearer ${auditorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/phase5/auditor-only')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });

  it('rejects cross-organization resource access through organization scope helpers', async () => {
    await request(app.getHttpServer())
      .post(`/phase5/orgs/${organizationAId}/resource`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ value: 'same-org' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/phase5/orgs/${organizationBId}/resource`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ value: 'cross-org' })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'ORGANIZATION_ISOLATION_VIOLATION'
    });
  });

  it('ignores spoofed forwarded user and organization headers on protected routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/phase5/protected')
      .set('authorization', `Bearer ${spoofedContextToken}`)
      .set('x-user-id', 'spoofed-user')
      .set('x-organization-id', organizationBId)
      .set('x-user-role', UserRole.Admin)
      .expect(200);

    expect(response.body.data.user).toMatchObject({
      organizationId: organizationAId,
      role: UserRole.Owner
    });
  });

  it('accepts only the configured internal worker token for internal routes', async () => {
    await request(app.getHttpServer()).post('/phase5/internal').expect(403);

    await request(app.getHttpServer())
      .post('/phase5/internal')
      .set('x-worker-token', 'wrong-token')
      .expect(403);

    await request(app.getHttpServer())
      .post('/phase5/internal')
      .set('x-worker-token', config.config.workerInternalToken)
      .expect(201);
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
