import { createHmac, timingSafeEqual } from 'node:crypto';

export type WorkerRunTokenClaims = {
  organizationId: string;
  workflowRunId: string;
  issuedAt: number;
  expiresAt: number;
  scope: 'run';
};

const VERSION = 'wrk1';

export function issueWorkerRunToken(
  secret: string,
  input: {
    organizationId: string;
    workflowRunId: string;
    ttlSeconds?: number;
    now?: Date;
  },
): string {
  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: WorkerRunTokenClaims = {
    organizationId: input.organizationId,
    workflowRunId: input.workflowRunId,
    issuedAt,
    expiresAt: issuedAt + (input.ttlSeconds ?? 60 * 60),
    scope: 'run',
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = sign(secret, payload);

  return `${VERSION}.${payload}.${signature}`;
}

export function verifyWorkerRunToken(
  secret: string,
  token: string,
  input: {
    organizationId?: string;
    workflowRunId?: string;
    now?: Date;
  } = {},
): WorkerRunTokenClaims | null {
  const [version, payload, signature, extra] = token.split('.');
  if (version !== VERSION || !payload || !signature || extra) {
    return null;
  }

  if (!safeEqual(signature, sign(secret, payload))) {
    return null;
  }

  let claims: WorkerRunTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payload)) as WorkerRunTokenClaims;
  } catch {
    return null;
  }

  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (claims.scope !== 'run' || claims.expiresAt <= now) {
    return null;
  }

  if (input.organizationId && claims.organizationId !== input.organizationId) {
    return null;
  }

  if (input.workflowRunId && claims.workflowRunId !== input.workflowRunId) {
    return null;
  }

  return claims;
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
