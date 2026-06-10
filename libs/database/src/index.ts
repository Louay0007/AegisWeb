import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import pg from 'pg';
import { DependencyHealth, SERVICE_NAMES } from '@agentpass/domain';
export { createPrismaClient, defaultDatabaseUrl } from './prisma.js';

const { Pool } = pg;

async function measure(name: DependencyHealth['name'], check: () => Promise<void>): Promise<DependencyHealth> {
  const startedAt = performance.now();

  try {
    await check();
    return {
      name,
      state: 'ok',
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      name,
      state: 'down',
      latencyMs: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : 'Unknown dependency error'
    };
  }
}

export async function checkPostgres(databaseUrl: string): Promise<DependencyHealth> {
  return measure(SERVICE_NAMES.postgres, async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });

    try {
      await pool.query('select 1');
    } finally {
      await pool.end();
    }
  });
}

export async function checkRedis(redisUrl: string): Promise<DependencyHealth> {
  return measure(SERVICE_NAMES.redis, async () => {
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000
    });

    try {
      await redis.connect();
      await redis.ping();
    } finally {
      redis.disconnect();
    }
  });
}

export type S3HealthConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export async function checkS3(config: S3HealthConfig): Promise<DependencyHealth> {
  return measure(SERVICE_NAMES.minio, async () => {
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

    await client.send(new ListBucketsCommand({}));
    client.destroy();
  });
}
