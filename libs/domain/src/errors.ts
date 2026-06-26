export const DomainErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  PermissionDenied: 'PERMISSION_DENIED',
  OrganizationIsolationViolation: 'ORGANIZATION_ISOLATION_VIOLATION',
  AgentNotActive: 'AGENT_NOT_ACTIVE',
  PolicyDenied: 'POLICY_DENIED',
  ApprovalRequired: 'APPROVAL_REQUIRED',
  CredentialUnavailable: 'CREDENTIAL_UNAVAILABLE',
  WorkflowInvalidTransition: 'WORKFLOW_INVALID_TRANSITION',
  SecretLeakDetected: 'SECRET_LEAK_DETECTED',
  RateLimited: 'RATE_LIMITED'
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
