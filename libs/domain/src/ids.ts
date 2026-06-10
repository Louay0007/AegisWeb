export const AGENTPASS_PRODUCT_NAME = 'AgentPass';

export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type VendorId = Brand<string, 'VendorId'>;
export type PolicyId = Brand<string, 'PolicyId'>;
export type CredentialId = Brand<string, 'CredentialId'>;
export type CredentialGrantId = Brand<string, 'CredentialGrantId'>;
export type WorkflowId = Brand<string, 'WorkflowId'>;
export type WorkflowRunId = Brand<string, 'WorkflowRunId'>;
export type ActionAttemptId = Brand<string, 'ActionAttemptId'>;
export type ApprovalRequestId = Brand<string, 'ApprovalRequestId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type FileId = Brand<string, 'FileId'>;
export type ReceiptId = Brand<string, 'ReceiptId'>;
export type RefreshTokenId = Brand<string, 'RefreshTokenId'>;

export const SERVICE_NAMES = {
  api: 'api',
  worker: 'worker',
  vendorSandbox: 'vendor-sandbox',
  postgres: 'postgres',
  redis: 'redis',
  minio: 'minio',
  mailpit: 'mailpit'
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export type HealthState = 'ok' | 'degraded' | 'down';

export type DependencyHealth = {
  name: ServiceName;
  state: HealthState;
  latencyMs?: number;
  message?: string;
};

export type ServiceHealth = {
  service: ServiceName;
  state: HealthState;
  version: string;
  uptimeSeconds: number;
  checkedAt: string;
  dependencies?: DependencyHealth[];
};

export function getPackageVersion(): string {
  return process.env.npm_package_version ?? '0.0.0';
}

export function nowIso(): string {
  return new Date().toISOString();
}
