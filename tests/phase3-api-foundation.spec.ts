import { Controller, Get, INestApplication, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { DomainError, DomainErrorCode, SERVICE_NAMES } from '@agentpass/domain';
import { AppModule } from '../apps/api/src/app.module.js';
import { ConfigModule } from '../apps/api/src/config/config.module.js';
import { ConfigService, loadAppConfig } from '../apps/api/src/config/config.service.js';
import { DatabaseModule } from '../apps/api/src/database/database.module.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { ErrorsModule } from '../apps/api/src/errors/errors.module.js';
import { HealthService, summarizeDependencyHealth } from '../apps/api/src/health/health.service.js';
import { CurrentOrganizationId } from '../apps/api/src/request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../apps/api/src/request-context/current-user.decorator.js';
import { RequestId } from '../apps/api/src/request-context/request-id.decorator.js';
import { RequestContextMiddleware } from '../apps/api/src/request-context/request-context.middleware.js';
import { RequestContextModule } from '../apps/api/src/request-context/request-context.module.js';
import { ContextUser } from '../apps/api/src/request-context/types.js';

@Controller('phase3/context')
class ContextProbeController {
  @Get()
  getContext(
    @RequestId() requestId: string | undefined,
    @CurrentUser() user: ContextUser | undefined,
    @CurrentOrganizationId() organizationId: string | undefined
  ) {
    return {
      data: {
        requestId,
        user,
        organizationId
      }
    };
  }
}

@Controller('phase3/errors')
class ErrorProbeController {
  @Get('domain')
  throwDomainError(): void {
    throw new DomainError(DomainErrorCode.PermissionDenied, 'Synthetic permission failure.', {
      reason: 'phase3-test'
    });
  }
}

@Module({
  imports: [RequestContextModule, ErrorsModule],
  controllers: [ContextProbeController, ErrorProbeController]
})
class Phase3ProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

describe('phase 3 API cross-cutting infrastructure', () => {
  let databaseModule: TestingModule;
  let database: DatabaseService;

  beforeAll(async () => {
    databaseModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule]
    }).compile();
    await databaseModule.init();
    database = databaseModule.get(DatabaseService);
  }, 30000);

  afterAll(async () => {
    await databaseModule.close();
  });

  it('loads local typed config defaults for test and development mode', () => {
    const config = loadAppConfig({ NODE_ENV: 'test' }, { useDefaults: true });

    expect(config.databaseUrl).toBe('postgresql://agentpass:agentpass@localhost:5432/agentpass');
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.s3Bucket).toBe('agentpass-artifacts');
    expect(config.mailPort).toBe(1025);
    expect(config.dashboardBaseUrl).toBe('http://localhost:4200');
    expect(config.s3ForcePathStyle).toBe(true);
  });

  it('fails fast when required production config is missing', () => {
    expect(() => loadAppConfig({ NODE_ENV: 'production' }, { useDefaults: false })).toThrow();
  });

  it('rejects unsafe production config defaults and local dependencies', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      API_PORT: '3001',
      DATABASE_URL: 'postgresql://agentpass:agentpass@localhost:5432/agentpass',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'production-access-secret-that-is-long-enough',
      JWT_REFRESH_SECRET: 'production-refresh-secret-that-is-long-enough',
      VAULT_MASTER_KEY: 'production-vault-secret-that-is-long-enough',
      S3_ENDPOINT: 'https://s3.example.com',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'aegisweb-prod',
      S3_ACCESS_KEY: 'prod-access-key',
      S3_SECRET_KEY: 'prod-secret-key',
      S3_FORCE_PATH_STYLE: 'false',
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: '587',
      MAIL_FROM: 'AegisWeb <security@example.com>',
      DASHBOARD_BASE_URL: 'https://app.example.com',
      WORKER_INTERNAL_TOKEN: 'production-worker-token-that-is-long-enough',
      VENDOR_SANDBOX_URL: 'https://vendor.example.com',
      API_ALLOWED_ORIGINS: 'https://app.example.com',
      ENABLE_OPENAPI: 'false'
    };

    expect(() => loadAppConfig(productionEnv, { useDefaults: false })).toThrow(/DATABASE_URL/);
    expect(() => loadAppConfig({ ...productionEnv, DATABASE_URL: 'postgresql://db.example.com/aegisweb', ENABLE_OPENAPI: 'true' }, { useDefaults: false })).toThrow(/ENABLE_OPENAPI/);
  });

  it('rejects invalid dependency URLs', () => {
    expect(() =>
      loadAppConfig(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'not-a-database-url'
        },
        { useDefaults: true }
      )
    ).toThrow(/valid URL/);
  });

  it('connects Prisma through the DatabaseModule and rolls transactions back on thrown errors', async () => {
    const domain = `rollback-${crypto.randomUUID()}.dev`;

    await expect(
      database.transaction(async (tx) => {
        await tx.organization.create({
          data: {
            name: 'Rollback Test Org',
            domain,
            plan: 'test'
          }
        });

        throw new Error('rollback on purpose');
      })
    ).rejects.toThrow(/rollback on purpose/);

    await expect(database.ping()).resolves.toBe(true);
    await expect(database.client.organization.findUnique({ where: { domain } })).resolves.toBeNull();
  });

  it('returns liveness, readiness, request ID, and security headers from the real API module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    const liveness = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'req_phase3_real_api')
      .expect(200);
    expect(liveness.headers['x-request-id']).toBe('req_phase3_real_api');
    expect(liveness.headers['x-content-type-options']).toBe('nosniff');
    expect(liveness.headers['x-frame-options']).toBe('DENY');
    expect(liveness.body).toMatchObject({
      service: SERVICE_NAMES.api,
      state: 'ok'
    });

    const readiness = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(readiness.body.state).toBe('ok');
    expect(summarizeDependencyHealth(readiness.body.dependencies)).toContain(`${SERVICE_NAMES.postgres}:ok`);
    expect(summarizeDependencyHealth(readiness.body.dependencies)).toContain(`${SERVICE_NAMES.redis}:ok`);
    expect(summarizeDependencyHealth(readiness.body.dependencies)).toContain(`${SERVICE_NAMES.minio}:ok`);

    await app.close();
  }, 30000);

  it('marks readiness as degraded if a dependency probe fails', async () => {
    const config = new ConfigService();
    const failingDatabase = {
      ping: async () => {
        throw new Error('database unavailable');
      }
    } as unknown as DatabaseService;
    const health = new HealthService(config, failingDatabase);

    const readiness = await health.getReadiness();
    const summary = summarizeDependencyHealth(readiness.dependencies ?? []);

    expect(readiness.state).toBe('degraded');
    expect(summary).toContain(`${SERVICE_NAMES.postgres}:down`);
  }, 30000);

  it('makes request context available through decorators without requiring auth on public routes', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [Phase3ProbeModule]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    const publicResponse = await request(app.getHttpServer()).get('/phase3/context').expect(200);
    expect(publicResponse.body.data.requestId).toMatch(/^req_/);
    expect(publicResponse.body.data.user).toBeUndefined();
    expect(publicResponse.body.data.organizationId).toBeUndefined();

    const authenticatedResponse = await request(app.getHttpServer())
      .get('/phase3/context')
      .set('x-request-id', 'req_phase3_context')
      .set('x-user-id', 'user_phase3')
      .set('x-organization-id', 'org_phase3')
      .set('x-user-role', 'OWNER')
      .expect(200);

    expect(authenticatedResponse.body.data).toEqual({
      requestId: 'req_phase3_context',
      organizationId: 'org_phase3',
      user: {
        id: 'user_phase3',
        organizationId: 'org_phase3',
        role: 'OWNER'
      }
    });

    await app.close();
  });

  it('formats domain errors with the standard API error envelope and request ID', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [Phase3ProbeModule]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    const response = await request(app.getHttpServer())
      .get('/phase3/errors/domain')
      .set('x-request-id', 'req_phase3_error')
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: DomainErrorCode.PermissionDenied,
        message: 'Synthetic permission failure.',
        requestId: 'req_phase3_error',
        details: {
          reason: 'phase3-test'
        }
      }
    });

    await app.close();
  });
});
