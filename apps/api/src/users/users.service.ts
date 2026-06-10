import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, UserRole as PrismaUserRole, UserStatus } from '@prisma/client';
import { DomainError, DomainErrorCode, UserRole, USER_ROLES } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { fromPrismaUserRole, toPrismaUserRole } from './user-role-mapping.js';
import { toUserDto } from './users.types.js';

export type InviteUserInput = {
  email: string;
  name: string;
  role: UserRole;
};

export type ChangeUserRoleInput = {
  role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async listUsers(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const users = await this.database.client.user.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'asc' }, { email: 'asc' }]
    });

    return { data: users.map(toUserDto) };
  }

  async getUser(organizationId: string | undefined, id: string) {
    const user = await this.findUserInOrganization(organizationId, id);
    return { data: toUserDto(user) };
  }

  async inviteUser(currentUser: ContextUser | undefined, input: InviteUserInput) {
    this.assertOwnerOrAdmin(currentUser, 'Only owners and admins can invite users.');
    this.assertKnownRole(input.role);
    this.assertOwnerRoleBoundary(currentUser, input.role, 'Only owners can invite owner users.');

    const created = await this.database.client.user.create({
      data: {
        organizationId: currentUser.organizationId,
        email: input.email,
        name: input.name,
        role: toPrismaUserRole(input.role),
        status: UserStatus.INVITED,
        passwordHash: 'local-invited-user-no-password'
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.USER_INVITED,
      eventDataJson: {
        invitedUserId: created.id,
        email: created.email,
        role: fromPrismaUserRole(created.role)
      }
    });

    return { data: toUserDto(created) };
  }

  async changeUserRole(currentUser: ContextUser | undefined, id: string, input: ChangeUserRoleInput) {
    this.assertOwnerOrAdmin(currentUser, 'Only owners and admins can change user roles.');
    this.assertKnownRole(input.role);

    const target = await this.findUserInOrganization(currentUser.organizationId, id);
    const nextRole = toPrismaUserRole(input.role);
    const targetRole = fromPrismaUserRole(target.role);

    this.assertOwnerRoleBoundary(currentUser, targetRole, 'Only owners can change owner users.');
    this.assertOwnerRoleBoundary(currentUser, input.role, 'Only owners can assign owner role.');

    if (target.id === currentUser.id && nextRole === PrismaUserRole.OWNER) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Users cannot change their own role to owner.');
    }

    if (target.role === PrismaUserRole.OWNER && nextRole !== PrismaUserRole.OWNER) {
      await this.assertNotLastOwner(target.organizationId, target.id, 'Last owner cannot be demoted.');
    }

    const updated = await this.database.client.user.update({
      where: { id: target.id },
      data: { role: nextRole }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.USER_ROLE_CHANGED,
      eventDataJson: {
        userId: updated.id,
        previousRole: fromPrismaUserRole(target.role),
        nextRole: fromPrismaUserRole(updated.role)
      }
    });

    return { data: toUserDto(updated) };
  }

  async disableUser(currentUser: ContextUser | undefined, id: string) {
    this.assertOwnerOrAdmin(currentUser, 'Only owners and admins can disable users.');

    const target = await this.findUserInOrganization(currentUser.organizationId, id);
    this.assertOwnerRoleBoundary(currentUser, fromPrismaUserRole(target.role), 'Only owners can disable owner users.');

    if (target.role === PrismaUserRole.OWNER) {
      await this.assertNotLastOwner(target.organizationId, target.id, 'Last owner cannot be disabled.');
    }

    const disabled = await this.database.client.user.update({
      where: { id: target.id },
      data: {
        status: UserStatus.DISABLED,
        disabledAt: target.disabledAt ?? new Date()
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.USER_DISABLED,
      eventDataJson: {
        userId: disabled.id,
        email: disabled.email,
        role: fromPrismaUserRole(disabled.role)
      }
    });

    return { data: toUserDto(disabled) };
  }

  private async findUserInOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const user = await this.database.client.user.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!user) {
      throw new DomainError(DomainErrorCode.NotFound, 'User was not found.');
    }

    return user;
  }

  private assertOwnerOrAdmin(currentUser: ContextUser | undefined, message: string): asserts currentUser is ContextUser {
    if (!currentUser || (currentUser.role !== UserRole.Owner && currentUser.role !== UserRole.Admin)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, message);
    }
  }

  private assertKnownRole(role: UserRole): void {
    if (!USER_ROLES.includes(role)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'User role must be known.');
    }
  }

  private assertOwnerRoleBoundary(currentUser: ContextUser | undefined, role: UserRole, message: string): void {
    if (role === UserRole.Owner && currentUser?.role !== UserRole.Owner) {
      throw new DomainError(DomainErrorCode.PermissionDenied, message);
    }
  }

  private async assertNotLastOwner(organizationId: string, userId: string, message: string): Promise<void> {
    const otherOwnerCount = await this.database.client.user.count({
      where: {
        organizationId,
        role: PrismaUserRole.OWNER,
        status: { not: UserStatus.DISABLED },
        id: { not: userId }
      }
    });

    if (otherOwnerCount === 0) {
      throw new DomainError(DomainErrorCode.ValidationFailed, message);
    }
  }
}
