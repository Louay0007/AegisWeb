import 'dotenv/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const databaseUrl = requiredEnv('RESTORE_DATABASE_URL', process.env.DATABASE_URL);
const bucket = requiredEnv('BACKUP_S3_BUCKET', process.env.S3_BUCKET);
const backupKey = requiredArg('--backup-key');
const confirmed = process.argv.includes('--confirm');

if (!confirmed) {
  throw new Error('Refusing to restore without --confirm. Restores overwrite target database objects.');
}

const workspace = join(tmpdir(), 'aegisweb-restore');
const gzPath = join(workspace, 'restore.dump.gz');
const dumpPath = join(workspace, 'restore.dump');
await mkdir(workspace, { recursive: true });

try {
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: requiredEnv('S3_ACCESS_KEY'),
      secretAccessKey: requiredEnv('S3_SECRET_KEY')
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
  });
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: backupKey }));
  if (!object.Body || !(object.Body instanceof Readable)) {
    throw new Error('Backup object body was not readable.');
  }
  await pipeline(object.Body, createWriteStream(gzPath));
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(dumpPath));
  await runPgRestore(dumpPath);
  console.log(JSON.stringify({ event: 'postgres_restore_completed', bucket, key: backupKey }));
} finally {
  await rm(gzPath, { force: true });
  await rm(dumpPath, { force: true });
}

async function runPgRestore(dumpPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const pgRestore = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', databaseUrl, dumpPath], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    pgRestore.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    pgRestore.on('error', reject);
    pgRestore.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pg_restore failed with exit code ${code}: ${stderr}`));
    });
  });
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
