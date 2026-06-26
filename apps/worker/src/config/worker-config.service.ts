import { Injectable } from '@nestjs/common';
import { z } from 'zod';

export type WorkerConfig = {
  nodeEnv: string;
  apiBaseUrl: string;
  databaseUrl: string;
  redisUrl: string;
  workerInternalToken: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3ForcePathStyle: boolean;
  vendorSandboxUrl: string;
  logLevel: string;
};

type LoadWorkerConfigOptions = {
  useDefaults?: boolean;
};

const localDefaults = {
  NODE_ENV: 'test',
  API_PORT: '3001',
  API_BASE_URL: '',
  DATABASE_URL: 'postgresql://agentpass:agentpass@localhost:5432/agentpass',
  REDIS_URL: 'redis://localhost:6379',
  WORKER_INTERNAL_TOKEN: 'local-worker-token-change-before-production',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'local',
  S3_BUCKET: 'agentpass-artifacts',
  S3_ACCESS_KEY: 'agentpass',
  S3_SECRET_KEY: 'agentpass-secret',
  S3_FORCE_PATH_STYLE: 'true',
  VENDOR_SANDBOX_URL: 'http://localhost:4202',
  LOG_LEVEL: 'debug'
} as const;

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : value.toLowerCase() !== 'false'));

const intFromEnv = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected a positive integer' });
    return z.NEVER;
  }

  return parsed;
});

const urlString = z.string().min(1).refine(
  (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Expected a valid URL' }
);

const workerEnvSchema = z.object({
  NODE_ENV: z.string().min(1),
  API_PORT: intFromEnv,
  API_BASE_URL: z.string().optional(),
  DATABASE_URL: urlString.refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'Expected a PostgreSQL connection URL'
  }),
  REDIS_URL: urlString.refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
    message: 'Expected a Redis connection URL'
  }),
  WORKER_INTERNAL_TOKEN: z.string().min(16),
  S3_ENDPOINT: urlString,
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolFromEnv,
  VENDOR_SANDBOX_URL: urlString,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional().default('info')
});

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env, options: LoadWorkerConfigOptions = {}): WorkerConfig {
  const useDefaults = options.useDefaults ?? env.NODE_ENV !== 'production';
  const mergedEnv = useDefaults ? { ...localDefaults, ...env } : env;
  const parsed = workerEnvSchema.parse(mergedEnv);

  const apiBaseUrl = parsed.API_BASE_URL || `http://localhost:${parsed.API_PORT}`;
  if (parsed.NODE_ENV === 'production' && !apiBaseUrl.startsWith('https://')) {
    throw new Error('API_BASE_URL must use HTTPS in production worker configuration.');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    apiBaseUrl,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    workerInternalToken: parsed.WORKER_INTERNAL_TOKEN,
    s3Endpoint: parsed.S3_ENDPOINT,
    s3Region: parsed.S3_REGION,
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKey: parsed.S3_ACCESS_KEY,
    s3SecretKey: parsed.S3_SECRET_KEY,
    s3ForcePathStyle: parsed.S3_FORCE_PATH_STYLE,
    vendorSandboxUrl: parsed.VENDOR_SANDBOX_URL,
    logLevel: parsed.LOG_LEVEL
  };
}

@Injectable()
export class WorkerConfigService {
  private readonly loadedConfig = loadWorkerConfig();

  get config(): WorkerConfig {
    return this.loadedConfig;
  }
}
