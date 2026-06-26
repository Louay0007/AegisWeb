import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma, UserRole as PrismaUserRole, UserStatus } from '@prisma/client';
import { DomainError, DomainErrorCode, UserRole } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';

type ComplianceSettings = {
  auditRetentionDays: number;
  fileRetentionDays: number;
  legalHoldEnabled: boolean;
};

const DEFAULT_SETTINGS: ComplianceSettings = {
  auditRetentionDays: 365,
  fileRetentionDays: 365,
  legalHoldEnabled: false
};

@Injectable()
export class ComplianceService {
  private readonly settings = new Map<string, ComplianceSettings>();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async getSettings(currentUser: ContextUser | undefined) {
    this.assertAuthenticated(currentUser);
    return { data: this.settings.get(currentUser.organizationId) ?? DEFAULT_SETTINGS };
  }

  async updateSettings(currentUser: ContextUser | undefined, input: ComplianceSettings) {
    this.assertOwnerOrAdmin(currentUser);
    this.settings.set(currentUser.organizationId, input);
    await this.audit.record({
      organizationId: currentUser.organizationId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.ORGANIZATION_UPDATED,
      eventDataJson: { complianceSettings: input }
    });
    return { data: input };
  }

  async exportAccount(currentUser: ContextUser | undefined) {
    this.assertAuthenticated(currentUser);
    const [user, preferences, sessions, auditEvents] = await Promise.all([
      this.database.client.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          organizationId: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          emailVerifiedAt: true,
          mfaEnabled: true
        }
      }),
      this.database.client.userNotificationPreference.findUnique({ where: { userId: currentUser.id } }),
      this.database.client.refreshToken.findMany({
        where: { userId: currentUser.id },
        select: { id: true, expiresAt: true, revokedAt: true, createdAt: true }
      }),
      this.database.client.auditEvent.findMany({
        where: { organizationId: currentUser.organizationId, actorId: currentUser.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      })
    ]);

    return {
      data: {
        exportedAt: new Date().toISOString(),
        user,
        preferences,
        sessions,
        auditEvents
      }
    };
  }

  async deleteAccount(currentUser: ContextUser | undefined) {
    this.assertAuthenticated(currentUser);
    const user = await this.database.client.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      throw new DomainError(DomainErrorCode.NotFound, 'User was not found.');
    }

    if (user.role === PrismaUserRole.OWNER) {
      const otherOwnerCount = await this.database.client.user.count({
        where: {
          organizationId: user.organizationId,
          id: { not: user.id },
          role: PrismaUserRole.OWNER,
          status: { not: UserStatus.DISABLED }
        }
      });
      if (otherOwnerCount === 0) {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Last owner cannot delete their account. Transfer ownership first.');
      }
    }

    const deletedEmail = `deleted-${user.id}@deleted.aegisweb.local`;
    await this.database.transaction(async (tx) => {
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: deletedEmail,
          name: 'Deleted user',
          status: UserStatus.DISABLED,
          disabledAt: new Date(),
          emailVerificationToken: null,
          passwordResetToken: null,
          mfaSecret: null,
          mfaEnabled: false,
          mfaBackupCodes: Prisma.JsonNull
        }
      });
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      eventType: AuditEventType.USER_DISABLED,
      eventDataJson: { accountDeletion: true, userId: user.id }
    });

    return { data: { deleted: true, userId: user.id } };
  }

  private assertAuthenticated(currentUser: ContextUser | undefined): asserts currentUser is ContextUser {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }
  }

  private assertOwnerOrAdmin(currentUser: ContextUser | undefined): asserts currentUser is ContextUser {
    this.assertAuthenticated(currentUser);
    if (currentUser.role !== UserRole.Owner && currentUser.role !== UserRole.Admin) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Only owners and admins can update compliance settings.');
    }
  }
}
