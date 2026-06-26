import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module.js';
import { DatabaseService } from '../../apps/api/src/database/database.service.js';
import { PasswordService } from '../../apps/api/src/auth/password.service.js';

const PASSWORD = 'Password123!';

describe('security: account enumeration resistance', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let passwordService: PasswordService;
  let email: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = app.get(DatabaseService);
    passwordService = app.get(PasswordService);

    const unique = crypto.randomUUID();
    const organization = await database.client.organization.create({
      data: {
        name: 'Enumeration Test Org',
        domain: `enumeration-${unique}.dev`,
        plan: 'local'
      }
    });
    email = `known-${unique}@example.dev`;
    await database.client.user.create({
      data: {
        organizationId: organization.id,
        email,
        name: 'Known User',
        role: 'OWNER',
        status: 'ACTIVE',
        passwordHash: await passwordService.hashPassword(PASSWORD)
      }
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('returns the same login error for existing and missing users', async () => {
    const existing = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(403);
    const missing = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `missing-${crypto.randomUUID()}@example.dev`, password: 'wrong-password' })
      .expect(403);

    expect(existing.body.error).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Invalid email or password.'
    });
    expect(missing.body.error).toMatchObject({
      code: existing.body.error.code,
      message: existing.body.error.message
    });
  }, 30000);
});
