import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  get ttlSeconds(): number {
    return REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  }

  async issue(userId: string, organizationId: string): Promise<string> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hash(token);

    await this.database.client.refreshToken.create({
      data: {
        userId,
        organizationId,
        tokenHash,
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000)
      }
    });

    return token;
  }

  async consume(token: string): Promise<RefreshToken> {
    const tokenHash = this.hash(token);
    const now = new Date();
    return this.database.transaction(async (tx) => {
      const stored = await tx.refreshToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now }
        }
      });

      if (!stored) {
        throw new DomainError(DomainErrorCode.PermissionDenied, 'Refresh token is invalid or expired.');
      }

      const updated = await tx.refreshToken.updateMany({
        where: {
          id: stored.id,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      if (updated.count !== 1) {
        throw new DomainError(DomainErrorCode.PermissionDenied, 'Refresh token is invalid or expired.');
      }

      return { ...stored, revokedAt: now };
    });
  }

  async revoke(token: string): Promise<void> {
    await this.database.client.refreshToken.updateMany({
      where: {
        tokenHash: this.hash(token),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.database.client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async listActiveForUser(userId: string): Promise<RefreshToken[]> {
    return this.database.client.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async revokeForUser(userId: string, id: string): Promise<void> {
    await this.database.client.refreshToken.updateMany({
      where: {
        id,
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  hash(token: string): string {
    return createHmac('sha256', this.config.config.jwtRefreshSecret).update(token).digest('hex');
  }
}
