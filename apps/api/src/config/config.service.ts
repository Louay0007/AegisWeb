import { Injectable } from "@nestjs/common";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

export type AppConfig = {
  nodeEnv: string;
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  vaultMasterKey: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3ForcePathStyle: boolean;
  mailHost: string;
  mailPort: number;
  mailFrom: string;
  dashboardBaseUrl: string;
  workerInternalToken: string;
  vendorSandboxUrl: string;
  allowedOrigins: string[];
  enableOpenApi: boolean;
  allowLocalProductionDependencies: boolean;
};

type LoadConfigOptions = {
  useDefaults?: boolean;
};

const localDefaults = {
  NODE_ENV: "test",
  API_PORT: "3001",
  DATABASE_URL: "postgresql://agentpass:agentpass@localhost:5432/agentpass",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "local-access-secret-change-before-production",
  JWT_REFRESH_SECRET: "local-refresh-secret-change-before-production",
  VAULT_MASTER_KEY: "local-vault-master-key-change-before-production",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "local",
  S3_BUCKET: "agentpass-artifacts",
  S3_ACCESS_KEY: "agentpass",
  S3_SECRET_KEY: "agentpass-secret",
  S3_FORCE_PATH_STYLE: "true",
  MAIL_HOST: "localhost",
  MAIL_PORT: "1025",
  MAIL_FROM: "AgentPass <agentpass@localhost>",
  DASHBOARD_BASE_URL: "http://localhost:4200",
  WORKER_INTERNAL_TOKEN: "local-worker-token-change-before-production",
  VENDOR_SANDBOX_URL: "http://localhost:4202",
  API_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:4200",
  ENABLE_OPENAPI: "true",
  ALLOW_LOCAL_PRODUCTION_DEPENDENCIES: "false",
} as const;

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean" ? value : value.toLowerCase() !== "false",
  );

const intFromEnv = z
  .union([z.number(), z.string()])
  .transform((value, context) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a positive integer",
      });
      return z.NEVER;
    }

    return parsed;
  });

const urlString = z
  .string()
  .min(1)
  .refine(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected a valid URL" },
  );

const envSchema = z.object({
  NODE_ENV: z.string().min(1),
  API_PORT: intFromEnv,
  DATABASE_URL: urlString.refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    {
      message: "Expected a PostgreSQL connection URL",
    },
  ),
  REDIS_URL: urlString.refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
    {
      message: "Expected a Redis connection URL",
    },
  ),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  VAULT_MASTER_KEY: z.string().min(16),
  S3_ENDPOINT: urlString,
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolFromEnv,
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: intFromEnv,
  MAIL_FROM: z.string().min(1),
  DASHBOARD_BASE_URL: urlString,
  WORKER_INTERNAL_TOKEN: z.string().min(16),
  VENDOR_SANDBOX_URL: urlString,
  API_ALLOWED_ORIGINS: z.string().min(1),
  ENABLE_OPENAPI: boolFromEnv,
  ALLOW_LOCAL_PRODUCTION_DEPENDENCIES: boolFromEnv.optional().default(false),
});

function assertProductionSecret(name: string, value: string): void {
  if (
    value.length < 32 ||
    value.startsWith("local-") ||
    value.includes("change-before-production")
  ) {
    throw new Error(
      `${name} must be a production-grade secret of at least 32 characters.`,
    );
  }
}

function assertNotLocalProductionUrl(name: string, value: string): void {
  let hostname: string;

  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)) {
    throw new Error(`${name} must not point to localhost in production.`);
  }
}

export function loadAppConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {},
): AppConfig {
  const useDefaults = options.useDefaults ?? env.NODE_ENV !== "production";
  const mergedEnv = useDefaults ? { ...localDefaults, ...env } : env;
  const parsed = envSchema.parse(mergedEnv);
  const allowedOrigins = parsed.API_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (parsed.NODE_ENV === "production") {
    assertProductionSecret("JWT_ACCESS_SECRET", parsed.JWT_ACCESS_SECRET);
    assertProductionSecret("JWT_REFRESH_SECRET", parsed.JWT_REFRESH_SECRET);
    assertProductionSecret("VAULT_MASTER_KEY", parsed.VAULT_MASTER_KEY);
    assertProductionSecret(
      "WORKER_INTERNAL_TOKEN",
      parsed.WORKER_INTERNAL_TOKEN,
    );
    if (!parsed.DASHBOARD_BASE_URL.startsWith("https://")) {
      throw new Error("DASHBOARD_BASE_URL must use HTTPS in production.");
    }
    if (!allowedOrigins.every((origin) => origin.startsWith("https://"))) {
      throw new Error(
        "API_ALLOWED_ORIGINS must contain HTTPS origins in production.",
      );
    }
    if (parsed.ENABLE_OPENAPI) {
      throw new Error("ENABLE_OPENAPI must be false in production.");
    }
    if (!parsed.ALLOW_LOCAL_PRODUCTION_DEPENDENCIES) {
      assertNotLocalProductionUrl("DATABASE_URL", parsed.DATABASE_URL);
      assertNotLocalProductionUrl("REDIS_URL", parsed.REDIS_URL);
      assertNotLocalProductionUrl("S3_ENDPOINT", parsed.S3_ENDPOINT);
    }
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
    vaultMasterKey: parsed.VAULT_MASTER_KEY,
    s3Endpoint: parsed.S3_ENDPOINT,
    s3Region: parsed.S3_REGION,
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKey: parsed.S3_ACCESS_KEY,
    s3SecretKey: parsed.S3_SECRET_KEY,
    s3ForcePathStyle: parsed.S3_FORCE_PATH_STYLE,
    mailHost: parsed.MAIL_HOST,
    mailPort: parsed.MAIL_PORT,
    mailFrom: parsed.MAIL_FROM,
    dashboardBaseUrl: parsed.DASHBOARD_BASE_URL,
    workerInternalToken: parsed.WORKER_INTERNAL_TOKEN,
    vendorSandboxUrl: parsed.VENDOR_SANDBOX_URL,
    allowedOrigins,
    enableOpenApi: parsed.ENABLE_OPENAPI,
    allowLocalProductionDependencies: parsed.ALLOW_LOCAL_PRODUCTION_DEPENDENCIES,
  };
}

@Injectable()
export class ConfigService {
  private readonly appConfig = loadAppConfig();

  get config(): AppConfig {
    return this.appConfig;
  }

  get databaseUrl(): string {
    return this.appConfig.databaseUrl;
  }

  get redisUrl(): string {
    return this.appConfig.redisUrl;
  }

  get apiPort(): number {
    return this.appConfig.apiPort;
  }

  get s3() {
    return {
      endpoint: this.appConfig.s3Endpoint,
      region: this.appConfig.s3Region,
      bucket: this.appConfig.s3Bucket,
      accessKeyId: this.appConfig.s3AccessKey,
      secretAccessKey: this.appConfig.s3SecretKey,
      forcePathStyle: this.appConfig.s3ForcePathStyle,
    };
  }
}
