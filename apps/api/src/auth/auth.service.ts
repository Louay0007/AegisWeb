import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, UserRole, UserStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { EmailNotificationAdapter } from '../notifications/email-notification.adapter.js';
import { AuthResponseDto, AuthUserDto, ForgotPasswordDto, LoginDto, MfaChallengeDto, MfaRecoveryDto, MfaRequiredResponseDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SessionAuditService } from './session-audit.service.js';
import { AccessTokenPayload, TokenService } from './token.service.js';

type AuthResult = AuthResponseDto & {
  refreshToken: string;
  refreshTokenMaxAgeSeconds: number;
};
type LoginResult = AuthResult | MfaRequiredResponseDto;
const RESET_TOKEN_TTL_MINUTES = 30;
const VERIFICATION_RESEND_WINDOW_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(RefreshTokenService) private readonly refreshTokenService: RefreshTokenService,
    @Inject(MfaService) private readonly mfaService: MfaService,
    @Inject(SessionAuditService) private readonly audit: SessionAuditService,
    @Inject(EmailNotificationAdapter) private readonly emailAdapter: EmailNotificationAdapter
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const verificationToken = randomToken();
    const user = await this.database.transaction(async (tx) => {
      const organizationExists = await tx.organization.findUnique({
        where: { domain: dto.organizationDomain }
      });

      if (organizationExists) {
        throw new DomainError(DomainErrorCode.ValidationFailed, registrationFailureMessage());
      }

      const emailExists = await tx.user.findUnique({
        where: { email: dto.email }
      });

      if (emailExists) {
        throw new DomainError(DomainErrorCode.ValidationFailed, registrationFailureMessage());
      }

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          domain: dto.organizationDomain,
          plan: 'local'
        }
      });

      return tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email,
          name: dto.name,
          role: UserRole.OWNER,
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerificationToken: this.hashActionToken(verificationToken),
          emailVerificationSentAt: new Date()
        },
        include: { organization: true }
      });
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      eventType: AuditEventType.USER_REGISTERED,
      eventDataJson: { email: user.email, role: user.role }
    });

    await this.sendVerificationEmail(user.email, user.name, verificationToken);

    return this.createAuthResult(user);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ data: { ok: true } }> {
    const user = await this.database.client.user.findUnique({ where: { email: dto.email } });

    if (!user || user.status === UserStatus.DISABLED) {
      await this.passwordService.verifyPasswordForMissingUser('forgot-password-normalizer');
      return { data: { ok: true } };
    }

    const token = randomToken();
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashActionToken(token),
        passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)
      }
    });
    await this.sendPasswordResetEmail(user.email, user.name, token);

    return { data: { ok: true } };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ data: { ok: true } }> {
    const now = new Date();
    const tokenHash = this.hashActionToken(dto.token);
    const user = await this.database.client.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { gt: now },
        status: { not: UserStatus.DISABLED }
      }
    });

    if (!user) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Password reset link is invalid or expired.');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: user.emailVerifiedAt ?? now,
        passwordResetToken: null,
        passwordResetExpiresAt: null
      }
    });
    await this.refreshTokenService.revokeAllForUser(user.id);

    return { data: { ok: true } };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ data: { ok: true } }> {
    const user = await this.database.client.user.findFirst({
      where: {
        emailVerificationToken: this.hashActionToken(dto.token),
        status: { not: UserStatus.DISABLED }
      }
    });

    if (!user) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Email verification link is invalid or expired.');
    }

    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        emailVerificationToken: null,
        emailVerificationSentAt: null
      }
    });

    return { data: { ok: true } };
  }

  async resendVerification(accessToken: string | undefined): Promise<{ data: { ok: true } }> {
    if (!accessToken) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const payload = this.tokenService.verifyAccessToken(accessToken);
    const user = await this.database.client.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }
    if (user.emailVerifiedAt) {
      return { data: { ok: true } };
    }
    if (user.emailVerificationSentAt && Date.now() - user.emailVerificationSentAt.getTime() < VERIFICATION_RESEND_WINDOW_SECONDS * 1000) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Verification email was sent recently. Try again shortly.');
    }

    const token = randomToken();
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: this.hashActionToken(token),
        emailVerificationSentAt: new Date()
      }
    });
    await this.sendVerificationEmail(user.email, user.name, token);
    return { data: { ok: true } };
  }

  async listSessions(accessToken: string | undefined) {
    const payload = this.requirePayload(accessToken);
    const tokens = await this.refreshTokenService.listActiveForUser(payload.userId);
    return {
      data: tokens.map((token) => ({
        id: token.id,
        createdAt: token.createdAt.toISOString(),
        expiresAt: token.expiresAt.toISOString()
      }))
    };
  }

  async revokeSession(accessToken: string | undefined, id: string): Promise<{ data: { ok: true } }> {
    const payload = this.requirePayload(accessToken);
    await this.refreshTokenService.revokeForUser(payload.userId, id);
    return { data: { ok: true } };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.database.client.user.findUnique({
      where: { email: dto.email },
      include: { organization: true }
    });
    const validPassword = user
      ? await this.passwordService.verifyPassword(user.passwordHash, dto.password)
      : await this.passwordService.verifyPasswordForMissingUser(dto.password);

    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
      if (user) {
        await this.audit.record({
          organizationId: user.organizationId,
          actorType: AuditActorType.USER,
          actorId: user.id,
          eventType: AuditEventType.USER_LOGIN_FAILED,
          eventDataJson: { email: dto.email, reason: user.status !== UserStatus.ACTIVE ? 'user_disabled' : 'invalid_credentials' }
        });
      }

      throw new DomainError(DomainErrorCode.PermissionDenied, 'Invalid email or password.');
    }

    if (user.mfaEnabled) {
      return {
        data: {
          mfaRequired: true,
          tempToken: this.mfaService.signLoginChallenge(user.id),
          user: { email: user.email, name: user.name }
        }
      };
    }

    await this.recordLoginSuccess(user);
    return this.createAuthResult(user);
  }

  async completeMfaChallenge(dto: MfaChallengeDto): Promise<AuthResult> {
    const challenge = this.mfaService.verifyLoginChallenge(dto.tempToken);
    const user = await this.database.client.user.findUnique({ where: { id: challenge.userId }, include: { organization: true } });
    if (!user || user.status !== UserStatus.ACTIVE || !user.mfaSecret || !user.mfaEnabled || !this.mfaService.verifyTotp(user.mfaSecret, dto.code)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Invalid multi-factor code.');
    }
    await this.recordLoginSuccess(user);
    return this.createAuthResult(user);
  }

  async completeMfaRecovery(dto: MfaRecoveryDto): Promise<AuthResult> {
    const challenge = this.mfaService.verifyLoginChallenge(dto.tempToken);
    const user = await this.database.client.user.findUnique({ where: { id: challenge.userId }, include: { organization: true } });
    if (!user || user.status !== UserStatus.ACTIVE || !user.mfaEnabled || !(await this.mfaService.consumeBackupCode(user.id, dto.backupCode))) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Invalid backup code.');
    }
    await this.recordLoginSuccess(user);
    return this.createAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const consumed = await this.refreshTokenService.consume(refreshToken);
    const user = await this.database.client.user.findUnique({
      where: { id: consumed.userId },
      include: { organization: true }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Refresh token is invalid or expired.');
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      eventType: AuditEventType.TOKEN_REFRESHED,
      eventDataJson: { email: user.email }
    });

    return this.createAuthResult(user);
  }

  async logout(refreshToken: string | undefined, accessToken: string | undefined): Promise<{ data: { ok: true } }> {
    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }

    const payload = accessToken ? this.tryVerify(accessToken) : undefined;

    if (payload) {
      this.tokenService.revokeAccessToken(accessToken as string);
      await this.audit.record({
        organizationId: payload.organizationId,
        actorType: AuditActorType.USER,
        actorId: payload.userId,
        eventType: AuditEventType.USER_LOGOUT,
        eventDataJson: { email: payload.email }
      });
    }

    return { data: { ok: true } };
  }

  async me(accessToken: string | undefined): Promise<{ data: { user: AuthUserDto } }> {
    if (!accessToken) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const payload = this.tokenService.verifyAccessToken(accessToken);
    const user = await this.database.client.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    return { data: { user: toAuthUser(user, this.config.config.mfaRequiredRoles) } };
  }

  private async createAuthResult(user: Parameters<typeof toAuthUser>[0]): Promise<AuthResult> {
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email
    });
    const refreshToken = await this.refreshTokenService.issue(user.id, user.organizationId);

    return {
      data: {
        accessToken,
        tokenType: 'Bearer',
        expiresInSeconds: this.tokenService.accessTokenTtlSeconds,
        user: toAuthUser(user, this.config.config.mfaRequiredRoles)
      },
      refreshToken,
      refreshTokenMaxAgeSeconds: this.refreshTokenService.ttlSeconds
    };
  }

  private tryVerify(accessToken: string): AccessTokenPayload | undefined {
    try {
      return this.tokenService.verifyAccessToken(accessToken);
    } catch {
      return undefined;
    }
  }

  private requirePayload(accessToken: string | undefined): AccessTokenPayload {
    if (!accessToken) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }
    return this.tokenService.verifyAccessToken(accessToken);
  }

  private async recordLoginSuccess(user: { id: string; organizationId: string; email: string }): Promise<void> {
    await this.database.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      eventType: AuditEventType.USER_LOGIN_SUCCEEDED,
      eventDataJson: { email: user.email }
    });
  }

  private hashActionToken(token: string): string {
    return createHmac('sha256', this.config.config.jwtRefreshSecret).update(token).digest('hex');
  }

  private async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const url = `${this.config.config.dashboardBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.sendBestEffortEmail({
      to: [{ email, name }],
      subject: 'Verify your AegisWeb email',
      text: `Verify your AegisWeb email by opening this link: ${url}`,
      html: `<p>Verify your AegisWeb email by opening this link:</p><p><a href="${escapeHtml(url)}">Verify email</a></p>`
    });
  }

  private async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const url = `${this.config.config.dashboardBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.sendBestEffortEmail({
      to: [{ email, name }],
      subject: 'Reset your AegisWeb password',
      text: `Reset your AegisWeb password within ${RESET_TOKEN_TTL_MINUTES} minutes: ${url}`,
      html: `<p>Reset your AegisWeb password within ${RESET_TOKEN_TTL_MINUTES} minutes:</p><p><a href="${escapeHtml(url)}">Reset password</a></p>`
    });
  }

  private async sendBestEffortEmail(message: { to: { email: string; name?: string | null }[]; subject: string; text: string; html: string }): Promise<void> {
    try {
      await this.emailAdapter.send({
        from: this.config.config.mailFrom,
        ...message
      });
    } catch {
      // Auth flows should not leak SMTP availability or leave users blocked in local/test setups.
    }
  }
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}

function registrationFailureMessage(): string {
  return 'Registration failed.';
}

function toAuthUser(user: {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  organization: {
    name: string;
    domain: string;
  };
}, mfaRequiredRoles: readonly string[]): AuthUserDto {
  return {
    id: user.id,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationDomain: user.organization.domain,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    mfaEnabled: user.mfaEnabled,
    mfaRequired: mfaRequiredRoles.includes(user.role) && !user.mfaEnabled
  };
}
