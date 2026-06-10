import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchBucket,
  NotFound,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';

@Injectable()
export class FileStorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private bucketReady = false;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const s3 = this.configService.s3;
    this.client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      forcePathStyle: s3.forcePathStyle,
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey
      }
    });
  }

  get bucket(): string {
    return this.configService.s3.bucket;
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketReady) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isMissingBucket(error)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }

    this.bucketReady = true;
  }

  async putObject(objectKey: string, bytes: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: mimeType,
        ContentLength: bytes.length
      })
    );
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return true;
    } catch (error) {
      if (isMissingObject(error)) {
        return false;
      }
      throw error;
    }
  }

  async getObject(bucket: string, objectKey: string): Promise<Buffer> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));

      if (!response.Body) {
        throw new DomainError(DomainErrorCode.NotFound, 'File object was not found in storage.');
      }

      return streamToBuffer(response.Body as Readable);
    } catch (error) {
      if (isMissingObject(error)) {
        throw new DomainError(DomainErrorCode.NotFound, 'File object was not found in storage.');
      }
      throw error;
    }
  }

  async signedReadUrl(bucket: string, objectKey: string, expiresInSeconds: number): Promise<string> {
    const exists = await this.objectExists(bucket, objectKey);

    if (!exists) {
      throw new DomainError(DomainErrorCode.NotFound, 'File object was not found in storage.');
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      }),
      { expiresIn: expiresInSeconds }
    );
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function isMissingBucket(error: unknown): boolean {
  return error instanceof NoSuchBucket || errorName(error) === 'NotFound' || errorName(error) === 'NoSuchBucket';
}

function isMissingObject(error: unknown): boolean {
  return error instanceof NotFound || errorName(error) === 'NoSuchKey' || errorName(error) === 'NotFound';
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}
