import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';

export type AccessTokenPayload = {
  sub: string;
  iss: string;
  aud: string;
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  jti: string;
  typ: 'access';
  iat: number;
  exp: number;
};

@Injectable()
export class TokenService {
  readonly accessTokenTtlSeconds = 15 * 60;
  private readonly issuer = 'aegisweb-api';
  private readonly audience = 'aegisweb-dashboard';
  private readonly revokedAccessTokenJtis = new Map<string, number>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  signAccessToken(input: Omit<AccessTokenPayload, 'iss' | 'aud' | 'jti' | 'typ' | 'iat' | 'exp'>): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      ...input,
      iss: this.issuer,
      aud: this.audience,
      jti: randomUUID(),
      typ: 'access',
      iat: issuedAt,
      exp: issuedAt + this.accessTokenTtlSeconds
    };

    return this.sign(payload);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const segments = token.split('.');
    const [encodedHeader, encodedPayload, signature] = segments;

    if (segments.length !== 3 || !encodedHeader || !encodedPayload || !signature) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const header = parseJson(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
      kid?: unknown;
    };

    if (header.alg !== 'HS256' || header.typ !== 'JWT' || header.kid !== undefined) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const expectedSignature = this.signature(`${encodedHeader}.${encodedPayload}`);

    if (!safeEqual(signature, expectedSignature)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const payload = parseJson(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AccessTokenPayload;

    if (
      payload.typ !== 'access' ||
      payload.iss !== this.issuer ||
      payload.aud !== this.audience ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    this.deleteExpiredRevocations();
    if (this.revokedAccessTokenJtis.has(payload.jti)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    return payload;
  }

  revokeAccessToken(token: string): void {
    const payload = this.verifyAccessToken(token);
    this.revokedAccessTokenJtis.set(payload.jti, payload.exp);
    this.deleteExpiredRevocations();
  }

  private sign(payload: AccessTokenPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signature(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private signature(value: string): string {
    return createHmac('sha256', this.configService.config.jwtAccessSecret).update(value).digest('base64url');
  }

  private deleteExpiredRevocations(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, expiresAt] of this.revokedAccessTokenJtis) {
      if (expiresAt <= now) {
        this.revokedAccessTokenJtis.delete(jti);
      }
    }
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
