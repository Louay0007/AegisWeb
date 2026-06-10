import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgentStatus,
  FileKind,
  UserRole as PrismaUserRole,
  UserStatus,
  VendorCategory,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTemplate
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module.js';
import { TokenService } from '../apps/api/src/auth/token.service.js';
import { DatabaseService } from '../apps/api/src/database/database.service.js';
import { FileStorageService } from '../apps/api/src/files/file-storage.service.js';
import { FilesService } from '../apps/api/src/files/files.service.js';

describe('phase 7 files module', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let filesService: FilesService;
  let storage: FileStorageService;
  let tokenService: TokenService;
  let organizationAId: string;
  let organizationBId: string;
  let workflowRunId: string;
  let ownerToken: string;
  let orgBToken: string;
  let uploadedFileId: string;
  const invoiceBytes = Buffer.from('invoice_id,total\nINV-1001,420.00\n', 'utf8');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);
    filesService = app.get(FilesService);
    storage = app.get(FileStorageService);
    tokenService = app.get(TokenService);

    const unique = crypto.randomUUID();
    const organizationA = await database.client.organization.create({
      data: {
        name: 'Phase Seven Org A',
        domain: `phase7-a-${unique}.dev`,
        plan: 'local'
      }
    });
    const organizationB = await database.client.organization.create({
      data: {
        name: 'Phase Seven Org B',
        domain: `phase7-b-${unique}.dev`,
        plan: 'local'
      }
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [ownerA, ownerB] = await Promise.all([
      database.client.user.create({
        data: {
          organizationId: organizationAId,
          email: `owner-a-${unique}@phase7.dev`,
          name: 'Phase Seven Owner A',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      }),
      database.client.user.create({
        data: {
          organizationId: organizationBId,
          email: `owner-b-${unique}@phase7.dev`,
          name: 'Phase Seven Owner B',
          role: PrismaUserRole.OWNER,
          status: UserStatus.ACTIVE,
          passwordHash: 'unused'
        }
      })
    ]);

    ownerToken = signFor(ownerA.id, ownerA.organizationId, ownerA.role, ownerA.email);
    orgBToken = signFor(ownerB.id, ownerB.organizationId, ownerB.role, ownerB.email);

    const agent = await database.client.agent.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Seven Agent',
        identifier: `phase-seven-agent-${unique}@agentpass.local`,
        purpose: 'Support file tests.',
        status: AgentStatus.ACTIVE,
        createdByUserId: ownerA.id
      }
    });
    const vendor = await database.client.vendor.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase Seven Vendor',
        website: `https://phase7-${unique}.example.dev`,
        category: VendorCategory.OTHER,
        ownerUserId: ownerA.id
      }
    });
    const workflow = await database.client.workflow.create({
      data: {
        organizationId: organizationAId,
        agentId: agent.id,
        vendorId: vendor.id,
        name: 'Phase Seven Workflow',
        template: WorkflowTemplate.VENDOR_INVOICE_DOWNLOAD,
        status: WorkflowStatus.ACTIVE,
        createdByUserId: ownerA.id
      }
    });
    const run = await database.client.workflowRun.create({
      data: {
        organizationId: organizationAId,
        workflowId: workflow.id,
        agentId: agent.id,
        vendorId: vendor.id,
        status: WorkflowRunStatus.RUNNING,
        currentStep: 'file-test'
      }
    });
    workflowRunId = run.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('uploads a buffer to MinIO and creates a complete organization-scoped file record', async () => {
    const file = await filesService.uploadBuffer({
      organizationId: organizationAId,
      workflowRunId,
      kind: FileKind.INVOICE,
      filename: 'invoice 1001.csv',
      mimeType: 'application/octet-stream',
      buffer: invoiceBytes
    });
    uploadedFileId = file.id;

    expect(file).toMatchObject({
      organizationId: organizationAId,
      workflowRunId,
      kind: FileKind.INVOICE,
      bucket: storage.bucket,
      mimeType: 'application/octet-stream',
      sizeBytes: invoiceBytes.length,
      sha256: filesService.calculateSha256(invoiceBytes)
    });
    expect(file.objectKey).toContain(`organizations/${organizationAId}/workflow-runs/${workflowRunId}/`);
    expect(file.objectKey).toContain(file.id);
    await expect(storage.objectExists(file.bucket, file.objectKey)).resolves.toBe(true);
  }, 30000);

  it('returns file metadata and a short-lived signed read URL', async () => {
    const response = await request(app.getHttpServer())
      .get(`/files/${uploadedFileId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: uploadedFileId,
      organizationId: organizationAId,
      workflowRunId,
      kind: FileKind.INVOICE,
      sizeBytes: invoiceBytes.length,
      sha256: filesService.calculateSha256(invoiceBytes)
    });
    expect(response.body.data.signedReadUrl).toContain('X-Amz-Expires=300');
  });

  it('downloads original bytes through the protected API endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`/files/${uploadedFileId}/download`)
      .set('authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/octet-stream');
    expect(Buffer.compare(response.body as Buffer, invoiceBytes)).toBe(0);
  });

  it('rejects cross-organization file reads', async () => {
    await request(app.getHttpServer())
      .get(`/files/${uploadedFileId}`)
      .set('authorization', `Bearer ${orgBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/files/${uploadedFileId}/download`)
      .set('authorization', `Bearer ${orgBToken}`)
      .expect(404);
  });

  it('refuses to create a file record for a missing object', async () => {
    await expect(
      filesService.createFileRecord({
        organizationId: organizationAId,
        workflowRunId,
        kind: FileKind.DOWNLOAD,
        bucket: storage.bucket,
        objectKey: `organizations/${organizationAId}/workflow-runs/${workflowRunId}/missing.bin`,
        mimeType: 'application/octet-stream',
        sizeBytes: 1,
        sha256: filesService.calculateSha256(Buffer.from('x'))
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('returns a controlled error if a stored file points to a missing object', async () => {
    const missing = await database.client.file.create({
      data: {
        organizationId: organizationAId,
        workflowRunId,
        kind: FileKind.DOWNLOAD,
        bucket: storage.bucket,
        objectKey: `organizations/${organizationAId}/workflow-runs/${workflowRunId}/missing-${crypto.randomUUID()}.bin`,
        mimeType: 'application/octet-stream',
        sizeBytes: 1,
        sha256: filesService.calculateSha256(Buffer.from('x'))
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/files/${missing.id}/download`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'File object was not found in storage.'
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
