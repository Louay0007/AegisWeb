import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, UserRole, UserStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { AuthResponseDto, AuthUserDto, LoginDto, RegisterDto } from './dto.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SessionAuditService } from './session-audit.service.js';
import { AccessTokenPayload, TokenService } from './token.service.js';

type AuthResult = AuthResponseDto & {
  refreshToken: string;
  refreshTokenMaxAgeSeconds: number;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(RefreshTokenService) private readonly refreshTokenService: RefreshTokenService,
    @Inject(SessionAuditService) private readonly audit: SessionAuditService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.database.transaction(async (tx) => {
      const organizationExists = await tx.organization.findUnique({
        where: { domain: dto.organizationDomain }
      });

      if (organizationExists) {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Organization domain already exists.');
      }

      const emailExists = await tx.user.findUnique({
        where: { email: dto.email }
      });

      if (emailExists) {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Email is already registered.');
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
          status: UserStatus.ACTIVE
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

    return this.createAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.database.client.user.findUnique({
      where: { email: dto.email },
      include: { organization: true }
    });
    const validPassword = user ? await this.passwordService.verifyPassword(user.passwordHash, dto.password) : false;

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

    return { data: { user: toAuthUser(user) } };
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
        user: toAuthUser(user)
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
}

function toAuthUser(user: {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  organization: {
    name: string;
    domain: string;
  };
}): AuthUserDto {
  return {
    id: user.id,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationDomain: user.organization.domain,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status
  };
}
