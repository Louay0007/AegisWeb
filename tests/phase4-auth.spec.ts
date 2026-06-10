import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditEventType, UserRole, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { PasswordService } from '../apps/api/src/auth/password.service.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';

const PASSWORD = 'Password123!';

function cookieValue(response: request.Response, name: string): string {
  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Missing cookie ${name}`);
  }

  return decodeURIComponent(cookie.split(';')[0]?.split('=')[1] ?? '');
}

describe('phase 4 auth module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let email: string;
  let domain: string;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    passwordService = app.get(PasswordService);
    tokenService = app.get(TokenService);

    const unique = crypto.randomUUID();
    email = `phase4-${unique}@example.dev`;
    domain = `phase4-${unique}.dev`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('hashes and verifies passwords with Argon2id', async () => {
    const hash = await passwordService.hashPassword(PASSWORD);

    expect(hash).toContain('$argon2id$');
    await expect(passwordService.verifyPassword(hash, PASSWORD)).resolves.toBe(true);
    await expect(passwordService.verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('signs access tokens with user, organization, and role claims', async () => {
    const token = tokenService.signAccessToken({
      sub: 'user_test',
      userId: 'user_test',
      organizationId: 'org_test',
      role: 'OWNER',
      email: 'owner@example.dev'
    });
    const payload = tokenService.verifyAccessToken(token);

    expect(payload).toMatchObject({
      sub: 'user_test',
      userId: 'user_test',
      organizationId: 'org_test',
      role: 'OWNER',
      email: 'owner@example.dev',
      typ: 'access'
    });
  });

  it('registers a local organization owner and stores only hashed refresh tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        name: 'Phase Four Owner',
        password: PASSWORD,
        organizationName: 'Phase Four Labs',
        organizationDomain: domain
      })
      .expect(201);

    refreshToken = cookieValue(response, 'agentpass_refresh_token');
    accessToken = response.body.data.accessToken;
    userId = response.body.data.user.id;
    organizationId = response.body.data.user.organizationId;

    expect(response.body.data).toMatchObject({
      tokenType: 'Bearer',
      user: {
        email,
        name: 'Phase Four Owner',
        role: 'OWNER',
        status: 'ACTIVE',
        organizationName: 'Phase Four Labs',
        organizationDomain: domain
      }
    });
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie']?.[0]).toContain('Path=/auth');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('refreshToken');

    const user = await database.client.user.findUniqueOrThrow({
      where: { email },
      include: { organization: true, refreshTokens: true }
    });

    expect(user.role).toBe(UserRole.OWNER);
    expect(user.organization.domain).toBe(domain);
    expect(user.passwordHash).toContain('$argon2id$');
    expect(user.refreshTokens).toHaveLength(1);
    expect(user.refreshTokens[0]?.tokenHash).not.toBe(refreshToken);
    expect(user.refreshTokens[0]?.tokenHash).toHaveLength(64);

    const audit = await database.client.auditEvent.findFirst({
      where: {
        organizationId,
        eventType: AuditEventType.USER_REGISTERED
      }
    });
    expect(audit?.actorId).toBe(userId);
  }, 30000);

  it('returns the current user for a valid access token and hides secrets', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.user).toMatchObject({
      id: userId,
      organizationId,
      email,
      role: 'OWNER'
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('tokenHash');
  });

  it('rejects protected current-user reads without an access token', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me').expect(403);

    expect(response.body.error).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Authentication required.'
    });
  });

  it('logs in with correct credentials and fails generically with wrong credentials', async () => {
    const success = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);

    expect(success.body.data.user.email).toBe(email);
    expect(cookieValue(success, 'agentpass_refresh_token')).toHaveLength(64);

    const failure = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(403);

    expect(failure.body.error).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Invalid email or password.'
    });

    const failedAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId,
        eventType: AuditEventType.USER_LOGIN_FAILED
      }
    });
    expect(failedAudit?.actorId).toBe(userId);
  }, 30000);

  it('rotates refresh tokens and rejects the consumed token', async () => {
    const refresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`agentpass_refresh_token=${encodeURIComponent(refreshToken)}`])
      .send({})
      .expect(201);

    const rotatedToken = cookieValue(refresh, 'agentpass_refresh_token');

    expect(refresh.body.data.accessToken).not.toBe(accessToken);
    expect(rotatedToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`agentpass_refresh_token=${encodeURIComponent(refreshToken)}`])
      .send({})
      .expect(403);

    refreshToken = rotatedToken;
    accessToken = refresh.body.data.accessToken;

    const revokedCount = await database.client.refreshToken.count({
      where: {
        userId,
        revokedAt: { not: null }
      }
    });
    expect(revokedCount).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('rejects cross-site refresh attempts', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', [`agentpass_refresh_token=${encodeURIComponent(refreshToken)}`])
      .send({})
      .expect(403);
  }, 30000);

  it('logs out by revoking the refresh token and clearing the cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`agentpass_refresh_token=${encodeURIComponent(refreshToken)}`])
      .send({})
      .expect(201);

    expect(response.body).toEqual({ data: { ok: true } });
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`agentpass_refresh_token=${encodeURIComponent(refreshToken)}`])
      .send({})
      .expect(403);

    const logoutAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId,
        eventType: AuditEventType.USER_LOGOUT
      }
    });
    expect(logoutAudit?.actorId).toBe(userId);
  }, 30000);

  it('does not allow disabled users to log in', async () => {
    const disabledDomain = `disabled-${crypto.randomUUID()}.dev`;
    const disabledEmail = `disabled-${crypto.randomUUID()}@example.dev`;
    const passwordHash = await passwordService.hashPassword(PASSWORD);

    await database.client.organization.create({
      data: {
        name: 'Disabled User Org',
        domain: disabledDomain,
        plan: 'local',
        users: {
          create: {
            email: disabledEmail,
            name: 'Disabled User',
            role: UserRole.OWNER,
            passwordHash,
            status: UserStatus.DISABLED,
            disabledAt: new Date()
          }
        }
      }
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: disabledEmail, password: PASSWORD })
      .expect(403);

    expect(response.body.error.message).toBe('Invalid email or password.');
  }, 30000);
});
