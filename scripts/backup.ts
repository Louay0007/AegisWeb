import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';

const databaseUrl = requiredEnv('DATABASE_URL');
const bucket = requiredEnv('BACKUP_S3_BUCKET', process.env.S3_BUCKET);
const backupPrefix = process.env.BACKUP_S3_PREFIX ?? 'backups/postgres';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupKey = `${backupPrefix}/${timestamp}.dump.gz`;
const workspace = join(tmpdir(), 'aegisweb-backups');
const outputPath = join(workspace, `${timestamp}.dump.gz`);

await mkdir(workspace, { recursive: true });
const startedAt = Date.now();

try {
  await runPgDump(outputPath);
  const size = await stat(outputPath);
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: requiredEnv('S3_ACCESS_KEY'),
      secretAccessKey: requiredEnv('S3_SECRET_KEY')
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: backupKey,
      Body: createReadStream(outputPath),
      ContentType: 'application/gzip',
      Metadata: {
        database: databaseUrl.replace(/:[^:@/]+@/, ':****@'),
        createdAt: new Date().toISOString()
      }
    })
  );
  console.log(
    JSON.stringify({
      event: 'postgres_backup_completed',
      bucket,
      key: backupKey,
      bytes: size.size,
      durationMs: Date.now() - startedAt
    })
  );
} finally {
  await rm(outputPath, { force: true });
}

async function runPgDump(destination: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl', databaseUrl], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const gzip = createGzip();
    const output = createWriteStream(destination);
    let stderr = '';

    pgDump.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    pgDump.on('error', reject);
    gzip.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
    pgDump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump failed with exit code ${code}: ${stderr}`));
      }
    });
    pgDump.stdout.pipe(gzip).pipe(output);
  });
}

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
