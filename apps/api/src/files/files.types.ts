import { File, FileKind } from '@prisma/client';

export type UploadBufferInput = {
  organizationId: string;
  workflowRunId?: string;
  kind: FileKind;
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type CreateFileRecordInput = {
  organizationId: string;
  workflowRunId?: string;
  kind: FileKind;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export type FileDto = {
  id: string;
  organizationId: string;
  workflowRunId: string | null;
  kind: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

export type DownloadedFile = {
  file: FileDto;
  bytes: Buffer;
};

export function toFileDto(file: File): FileDto {
  return {
    id: file.id,
    organizationId: file.organizationId,
    workflowRunId: file.workflowRunId,
    kind: file.kind,
    bucket: file.bucket,
    objectKey: file.objectKey,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    createdAt: file.createdAt.toISOString()
  };
}
