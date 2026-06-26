import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { PasswordService } from './password.service.js';

const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const BACKUP_CODE_COUNT = 8;

type MfaChallengePayload = { userId: string; purpose: 'mfa-login'; exp: number; };

@Injectable()
export class MfaService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PasswordService) private readonly passwordService: PasswordService
  ) {}

  async enroll(currentUser: ContextUser | undefined): Promise<{ data: { secret: string; otpauthUrl: string; qrCodeDataUrl: string } }> {
    const user = await this.requireUser(currentUser);
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'AegisWeb', label: user.email, secret });
    await this.database.client.user.update({ where: { id: user.id }, data: { mfaSecret: secret, mfaEnabled: false, mfaBackupCodes: Prisma.DbNull } });
    return { data: { secret, otpauthUrl, qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl) } };
  }

  async verifyEnrollment(currentUser: ContextUser | undefined, code: string): Promise<{ data: { mfaEnabled: true; backupCodes: string[] } }> {
    const user = await this.requireUser(currentUser);
    if (!user.mfaSecret || !this.verifyTotp(user.mfaSecret, code)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Invalid multi-factor code.');
    }
    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map((backupCode) => this.passwordService.hashPassword(backupCode)));
    await this.database.client.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaBackupCodes: hashed }
    });
    return { data: { mfaEnabled: true, backupCodes } };
  }

  async disable(currentUser: ContextUser | undefined, code: string): Promise<{ data: { mfaEnabled: false } }> {
    const user = await this.requireUser(currentUser);
    if (!user.mfaSecret || !user.mfaEnabled || !this.verifyTotp(user.mfaSecret, code)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Invalid multi-factor code.');
    }
    await this.database.client.user.update({ where: { id: user.id }, data: { mfaSecret: null, mfaEnabled: false, mfaBackupCodes: Prisma.DbNull } });
    return { data: { mfaEnabled: false } };
  }

  signLoginChallenge(userId: string): string {
    const payload: MfaChallengePayload = { userId, purpose: 'mfa-login', exp: Math.floor(Date.now() / 1000) + MFA_CHALLENGE_TTL_SECONDS };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.signature(encoded)}`;
  }

  verifyLoginChallenge(token: string): MfaChallengePayload {
    const [encoded, mac] = token.split('.');
    if (!encoded || !mac || !safeEqual(mac, this.signature(encoded))) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'MFA challenge is invalid or expired.');
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as MfaChallengePayload;
    if (payload.purpose !== 'mfa-login' || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'MFA challenge is invalid or expired.');
    }
    return payload;
  }

  verifyTotp(secret: string, code: string): boolean {
    return verifySync({ secret, token: code.replaceAll(' ', '') }).valid;
  }

  async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.database.client.user.findUnique({ where: { id: userId }, select: { mfaBackupCodes: true } });
    const hashes = Array.isArray(user?.mfaBackupCodes) ? user.mfaBackupCodes.filter((value): value is string => typeof value === 'string') : [];
    for (const hash of hashes) {
      if (await this.passwordService.verifyPassword(hash, code)) {
        await this.database.client.user.update({ where: { id: userId }, data: { mfaBackupCodes: hashes.filter((storedHash) => storedHash !== hash) } });
        return true;
      }
    }
    return false;
  }

  private async requireUser(currentUser: ContextUser | undefined) {
    if (!currentUser) throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    const user = await this.database.client.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, email: true, mfaSecret: true, mfaEnabled: true }
    });
    if (!user) throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    return user;
  }

  private signature(value: string): string {
    return createHmac('sha256', this.config.config.jwtAccessSecret).update(value).digest('base64url');
  }
}

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => randomBytes(5).toString('hex').toUpperCase());
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
