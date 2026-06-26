import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { StepUpDto } from './dto.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';

const STEP_UP_TTL_SECONDS = 5 * 60;

type StepUpPayload = { userId: string; organizationId: string; purpose: 'step-up'; exp: number; };

@Injectable()
export class StepUpService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(MfaService) private readonly mfaService: MfaService
  ) {}

  async issue(currentUser: ContextUser | undefined, dto: StepUpDto): Promise<{ data: { stepUpToken: string; expiresInSeconds: number } }> {
    if (!currentUser) throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    const user = await this.database.client.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, organizationId: true, passwordHash: true, mfaSecret: true, mfaEnabled: true, status: true }
    });
    if (!user || user.status !== 'ACTIVE') throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');

    const passwordOk = dto.password ? await this.passwordService.verifyPassword(user.passwordHash, dto.password) : false;
    const totpOk = dto.totpCode && user.mfaEnabled && user.mfaSecret ? this.mfaService.verifyTotp(user.mfaSecret, dto.totpCode) : false;
    if (!passwordOk && !totpOk) throw new DomainError(DomainErrorCode.PermissionDenied, 'Step-up authentication failed.');

    return { data: { stepUpToken: this.sign({ userId: user.id, organizationId: user.organizationId, purpose: 'step-up', exp: Math.floor(Date.now() / 1000) + STEP_UP_TTL_SECONDS }), expiresInSeconds: STEP_UP_TTL_SECONDS } };
  }

  verify(token: string | undefined, currentUser: ContextUser | undefined): void {
    if (!token || !currentUser) throw new DomainError(DomainErrorCode.PermissionDenied, 'Step-up authentication is required.');
    const [encoded, mac] = token.split('.');
    if (!encoded || !mac || !safeEqual(mac, this.signature(encoded))) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Step-up authentication is required.');
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StepUpPayload;
    if (payload.purpose !== 'step-up' || payload.exp <= Math.floor(Date.now() / 1000) || payload.userId !== currentUser.id || payload.organizationId !== currentUser.organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Step-up authentication is required.');
    }
  }

  private sign(payload: StepUpPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.signature(encoded)}`;
  }

  private signature(value: string): string {
    return createHmac('sha256', this.config.config.jwtAccessSecret).update(value).digest('base64url');
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
