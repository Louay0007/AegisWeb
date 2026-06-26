import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  AuditEventType,
  CredentialStatus as PrismaCredentialStatus,
  CredentialType as PrismaCredentialType,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory as PrismaVendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CredentialType } from '@agentpass/domain';
import {
  assertValidMasterKey,
  decryptSecret,
  encryptSecret,
  getVaultStatus,
  redactSecretLikeValues
} from '@agentpass/vault';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { ConfigService } from '../apps/api/src/config/config.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';

describe('phase 13 vault library and credentials module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tokenService: TokenService;
  let config: ConfigService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerToken: string;
  let approverToken: string;
  let ownerBToken: string;
  let vendorAId: string;
  let vendorBId: string;
  let agentAId: string;
  let agentBId: string;
  let workflowRunAId: string;
  let credentialId: string;
  let grantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    tokenService = app.get(TokenService);
    config = app.get(ConfigService);

    const unique = crypto.randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      database.client.organization.create({
        data: {
          name: 'Phase Thirteen Org A',
          domain: `phase13-a-${unique}.dev`,
          plan: 'local'
        }
      }),
      database.client.organization.create({
        data: {
          name: 'Phase Thirteen Org B',
          domain: `phase13-b-${unique}.dev`,
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
          email: `owner-a-${unique}@phase13.dev`,
          name: 'Phase Thirteen Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `approver-a-${unique}@phase13.dev`,
          name: 'Phase Thirteen Approver A',
          role: PrismaUserRole.APPROVER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase13.dev`,
          name: 'Phase Thirteen Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerAId = ownerA.id;
    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    approverToken = signFor(approverA.id, approverA.organizationId, approverA.role, approverA.email);
    ownerBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const [vendorA, vendorB] = await Promise.all([
      database.client.vendor.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Thirteen Acme',
          website: `https://phase13-acme-${unique}.example.dev`,
          category: PrismaVendorCategory.ANALYTICS
        }
      }),
      database.client.vendor.create({
        data: {
          organizationId: organizationBId,
          name: 'Phase Thirteen Other Vendor',
          website: `https://phase13-other-${unique}.example.dev`,
          category: PrismaVendorCategory.OTHER
        }
      })
    ]);
    vendorAId = vendorA.id;
    vendorBId = vendorB.id;

    const [agentA, agentB] = await Promise.all([
      database.client.agent.create({
        data: {
          organizationId: organizationAId,
          name: 'Phase Thirteen Bot',
          identifier: `phase13-bot-${unique}@agentpass.local`,
          purpose: 'Credential decrypt test.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerA.id
        }
      }),
      database.client.agent.create({
        data: {
          organizationId: organizationBId,
          name: 'Phase Thirteen Other Bot',
          identifier: `phase13-other-bot-${unique}@agentpass.local`,
          purpose: 'Cross org credential test.',
          status: AgentStatus.ACTIVE,
          createdByUserId: ownerB.id
        }
      })
    ]);
    agentAId = agentA.id;
    agentBId = agentB.id;

    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agentAId,
        vendorId: vendorAId,
        name: 'Phase Thirteen Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        configurationJson: {},
        createdByUserId: ownerA.id
      }
    });
    const workflowRun = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: agentAId,
        vendorId: vendorAId,
        status: WorkflowRunStatus.RUNNING,
        stateJson: {}
      }
    });
    workflowRunAId = workflowRun.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('encrypts and decrypts with AES-256-GCM and rejects bad keys or tampering', () => {
    const key = 'phase-13-local-master-key-with-32-plus-chars';
    const encrypted = encryptSecret({ username: 'finance@example.dev', password: 'super-secret' }, key);

    expect(getVaultStatus()).toEqual({ ready: true, encryption: 'aes-256-gcm' });
    expect(encrypted).toMatchObject({
      alg: 'aes-256-gcm',
      key_version: 'local-v1',
      ciphertext: expect.any(String),
      auth_tag: expect.any(String)
    });
    expect(JSON.stringify(encrypted)).not.toContain('super-secret');
    expect(decryptSecret(encrypted, key)).toEqual({
      username: 'finance@example.dev',
      password: 'super-secret'
    });
    expect(() => decryptSecret(encrypted, 'wrong-phase-13-local-master-key-with-32-plus-chars')).toThrow();
    expect(() => decryptSecret({ ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}aa` }, key)).toThrow();
    expect(() => assertValidMasterKey('short')).toThrow(/Vault master key/);
  });

  it('binds ciphertext to organization and credential context when AAD is present', () => {
    const key = 'phase-13-local-master-key-with-32-plus-chars';
    const encrypted = encryptSecret(
      { token: 'context-bound-token' },
      key,
      { organizationId: organizationAId, credentialId: '11111111-1111-4111-8111-111111111111' }
    );

    expect(encrypted.aad).toEqual(expect.any(String));
    expect(decryptSecret(encrypted, key, {
      organizationId: organizationAId,
      credentialId: '11111111-1111-4111-8111-111111111111'
    })).toEqual({ token: 'context-bound-token' });
    expect(() => decryptSecret(encrypted, key, {
      organizationId: organizationBId,
      credentialId: '11111111-1111-4111-8111-111111111111'
    })).toThrow(/context/);
  });

  it('redacts secret-like values recursively', () => {
    expect(
      redactSecretLikeValues({
        username: 'finance@example.dev',
        password: 'super-secret',
        nested: {
          apiToken: 'token-value',
          value: 'visible'
        }
      })
    ).toEqual({
      username: '[REDACTED]',
      password: '[REDACTED]',
      nested: {
        apiToken: '[REDACTED]',
        value: 'visible'
      }
    });
  });

  it('creates credentials with encrypted storage and never returns plaintext to users', async () => {
    const create = await request(app.getHttpServer())
      .post('/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        vendorId: vendorAId,
        label: 'Acme Finance Login',
        credentialType: CredentialType.UsernamePassword,
        secretJson: {
          username: 'finance@phase13.dev',
          password: 'phase13-local-password'
        }
      })
      .expect(201);

    credentialId = create.body.data.id;
    expect(create.body.data).toMatchObject({
      organizationId: organizationAId,
      vendorId: vendorAId,
      label: 'Acme Finance Login',
      credentialType: CredentialType.UsernamePassword,
      encryptionVersion: 'local-v1',
      status: 'active'
    });
    expect(JSON.stringify(create.body)).not.toContain('phase13-local-password');
    expect(JSON.stringify(create.body)).not.toContain('encryptedPayload');

    const stored = await database.client.credential.findUniqueOrThrow({ where: { id: credentialId } });
    expect(stored.credentialType).toBe(PrismaCredentialType.USERNAME_PASSWORD);
    expect(stored.status).toBe(PrismaCredentialStatus.ACTIVE);
    expect(JSON.stringify(stored.encryptedPayload)).toContain('ciphertext');
    expect(JSON.stringify(stored.encryptedPayload)).toContain('aad');
    expect(JSON.stringify(stored.encryptedPayload)).not.toContain('phase13-local-password');

    const list = await request(app.getHttpServer())
      .get('/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const get = await request(app.getHttpServer())
      .get(`/credentials/${credentialId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(JSON.stringify(list.body)).not.toContain('phase13-local-password');
    expect(JSON.stringify(get.body)).not.toContain('encryptedPayload');

    const createdAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        actorId: ownerAId,
        eventType: AuditEventType.CREDENTIAL_CREATED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(createdAudit?.eventDataJson).toMatchObject({
      credentialId: '[REDACTED]',
      vendorId: vendorAId
    });
  });

  it('grants credentials to agents and allows only internal decrypt for authorized runs', async () => {
    const grant = await request(app.getHttpServer())
      .post(`/credentials/${credentialId}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        scope: 'login'
      })
      .expect(201);

    grantId = grant.body.data.id;
    expect(grant.body.data).toMatchObject({
      credentialId,
      agentId: agentAId,
      scope: 'login',
      revokedAt: null
    });

    await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialId}/decrypt-for-run`)
      .send({ workflowRunId: workflowRunAId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialId}/decrypt-for-run`)
      .set('x-worker-token', 'wrong-token')
      .send({ workflowRunId: workflowRunAId })
      .expect(403);

    const decrypt = await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialId}/decrypt-for-run`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({ workflowRunId: workflowRunAId })
      .expect(201);

    expect(decrypt.body.data).toMatchObject({
      credentialId,
      workflowRunId: workflowRunAId,
      agentId: agentAId,
      secretJson: {
        username: 'finance@phase13.dev',
        password: 'phase13-local-password'
      }
    });

    const usedAudit = await database.client.auditEvent.findFirst({
      where: {
        organizationId: organizationAId,
        workflowRunId: workflowRunAId,
        agentId: agentAId,
        eventType: AuditEventType.CREDENTIAL_USED
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(usedAudit?.eventDataJson).toMatchObject({
      credentialId: '[REDACTED]',
      vendorId: vendorAId,
      grantId
    });
    expect(JSON.stringify(usedAudit?.eventDataJson)).not.toContain('phase13-local-password');
  });

  it('blocks decrypt after grant revocation and after credential revocation', async () => {
    const revokedGrant = await request(app.getHttpServer())
      .delete(`/credentials/${credentialId}/grants/${grantId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(revokedGrant.body.data.revokedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialId}/decrypt-for-run`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({ workflowRunId: workflowRunAId })
      .expect(403);

    const regrant = await request(app.getHttpServer())
      .post(`/credentials/${credentialId}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentAId,
        scope: 'login'
      })
      .expect(201);
    expect(regrant.body.data.revokedAt).toBeNull();

    const revokedCredential = await request(app.getHttpServer())
      .post(`/credentials/${credentialId}/revoke`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(revokedCredential.body.data.status).toBe('revoked');

    await request(app.getHttpServer())
      .post(`/internal/vault/credentials/${credentialId}/decrypt-for-run`)
      .set('x-worker-token', config.config.workerInternalToken)
      .send({ workflowRunId: workflowRunAId })
      .expect(403);
  });

  it('supports secret rotation without leaking plaintext', async () => {
    const create = await request(app.getHttpServer())
      .post('/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        vendorId: vendorAId,
        label: 'Rotating API Token',
        credentialType: CredentialType.ApiToken,
        secretJson: {
          token: 'initial-phase13-token'
        }
      })
      .expect(201);

    const update = await request(app.getHttpServer())
      .patch(`/credentials/${create.body.data.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        label: 'Rotated API Token',
        secretJson: {
          token: 'rotated-phase13-token'
        }
      })
      .expect(200);

    expect(update.body.data).toMatchObject({
      id: create.body.data.id,
      label: 'Rotated API Token',
      status: 'rotated',
      encryptionVersion: 'local-v2'
    });
    expect(JSON.stringify(update.body)).not.toContain('rotated-phase13-token');
  });

  it('enforces RBAC and organization isolation for credentials', async () => {
    await request(app.getHttpServer())
      .post('/credentials')
      .set('authorization', `Bearer ${approverToken}`)
      .send({
        vendorId: vendorAId,
        label: 'Blocked',
        credentialType: CredentialType.UsernamePassword,
        secretJson: { username: 'blocked', password: 'blocked' }
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/credentials/${credentialId}`)
      .set('authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post('/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        vendorId: vendorBId,
        label: 'Cross Org Vendor Credential',
        credentialType: CredentialType.UsernamePassword,
        secretJson: { username: 'blocked', password: 'blocked' }
      })
      .expect(403);

    const activeCredential = await request(app.getHttpServer())
      .post('/credentials')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        vendorId: vendorAId,
        label: 'Cross Org Agent Grant Check',
        credentialType: CredentialType.UsernamePassword,
        secretJson: { username: 'grant-check', password: 'grant-check' }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/credentials/${activeCredential.body.data.id}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        agentId: agentBId,
        scope: 'login'
      })
      .expect(403);
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
