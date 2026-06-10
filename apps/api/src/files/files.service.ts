import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { FileStorageService } from './file-storage.service.js';
import { CreateFileRecordInput, DownloadedFile, toFileDto, UploadBufferInput } from './files.types.js';

@Injectable()
export class FilesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(FileStorageService) private readonly storage: FileStorageService
  ) {}

  calculateSha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  async uploadBuffer(input: UploadBufferInput) {
    this.assertKnownKind(input.kind);

    if (input.workflowRunId) {
      await this.assertWorkflowRunBelongsToOrganization(input.organizationId, input.workflowRunId);
    }

    const fileId = randomUUID();
    const objectKey = this.buildObjectKey(input.organizationId, input.workflowRunId, fileId, input.filename);
    const sha256 = this.calculateSha256(input.buffer);

    await this.storage.putObject(objectKey, input.buffer, input.mimeType);

    return this.createFileRecord({
      organizationId: input.organizationId,
      workflowRunId: input.workflowRunId,
      kind: input.kind,
      bucket: this.storage.bucket,
      objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      sha256
    }, fileId);
  }

  async uploadStream(input: Omit<UploadBufferInput, 'buffer'> & { stream: Readable }) {
    const chunks: Buffer[] = [];

    for await (const chunk of input.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return this.uploadBuffer({
      organizationId: input.organizationId,
      workflowRunId: input.workflowRunId,
      kind: input.kind,
      filename: input.filename,
      mimeType: input.mimeType,
      buffer: Buffer.concat(chunks)
    });
  }

  async createFileRecord(input: CreateFileRecordInput, id = randomUUID()) {
    this.assertKnownKind(input.kind);

    const objectExists = await this.storage.objectExists(input.bucket, input.objectKey);
    if (!objectExists) {
      throw new DomainError(DomainErrorCode.NotFound, 'Cannot create file record for a missing storage object.');
    }

    if (input.workflowRunId) {
      await this.assertWorkflowRunBelongsToOrganization(input.organizationId, input.workflowRunId);
    }

    const file = await this.database.client.file.create({
      data: {
        id,
        organizationId: input.organizationId,
        workflowRunId: input.workflowRunId,
        kind: input.kind,
        bucket: input.bucket,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256
      }
    });

    return toFileDto(file);
  }

  async getFileForOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const file = await this.database.client.file.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!file) {
      throw new DomainError(DomainErrorCode.NotFound, 'File was not found.');
    }

    return toFileDto(file);
  }

  async downloadForOrganization(organizationId: string | undefined, id: string): Promise<DownloadedFile> {
    const file = await this.getFileForOrganization(organizationId, id);
    const bytes = await this.storage.getObject(file.bucket, file.objectKey);

    if (this.calculateSha256(bytes) !== file.sha256) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Downloaded file failed integrity verification.');
    }

    return { file, bytes };
  }

  async getSignedReadUrl(organizationId: string | undefined, id: string, expiresInSeconds = 300): Promise<string> {
    const file = await this.getFileForOrganization(organizationId, id);
    return this.storage.signedReadUrl(file.bucket, file.objectKey, expiresInSeconds);
  }

  private buildObjectKey(organizationId: string, workflowRunId: string | undefined, fileId: string, filename: string): string {
    const sanitizedName = sanitizeFilename(filename);
    const runPrefix = workflowRunId ? `workflow-runs/${workflowRunId}` : 'unscoped';
    return `organizations/${organizationId}/${runPrefix}/${fileId}/${sanitizedName}`;
  }

  private async assertWorkflowRunBelongsToOrganization(organizationId: string, workflowRunId: string): Promise<void> {
    const workflowRun = await this.database.client.workflowRun.findFirst({
      where: {
        id: workflowRunId,
        organizationId
      },
      select: { id: true }
    });

    if (!workflowRun) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Workflow run belongs to another organization.');
    }
  }

  private assertKnownKind(kind: FileKind): void {
    if (!Object.values(FileKind).includes(kind)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'File kind must be known.');
    }
  }
}

function sanitizeFilename(filename: string): string {
  const sanitized = filename.replaceAll('\\', '/').split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized && sanitized.length > 0 ? sanitized : 'artifact.bin';
}
