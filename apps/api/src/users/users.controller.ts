import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission, UserRole, USER_ROLES } from '@agentpass/domain';
import { RequirePermission, RequireRole } from '../authorization/authorization-metadata.js';
import { parsePageQuery, QueryRecord } from '../common/pagination.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { UsersService } from './users.service.js';

const roleSchema = z.custom<UserRole>((value) => typeof value === 'string' && USER_ROLES.includes(value as UserRole));

const inviteUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120),
  role: roleSchema
});

const changeRoleSchema = z.object({
  role: roleSchema
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256)
});

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @RequirePermission(Permission.UserRead)
  @Get()
  listUsers(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.usersService.listUsers(organizationId, parsePageQuery(query));
  }

  @RequirePermission(Permission.UserRead)
  @Get(':id')
  getUser(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.usersService.getUser(organizationId, id);
  }

  @Patch('me')
  updateOwnProfile(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid profile update request.');
    }
    return this.usersService.updateOwnProfile(currentUser, parsed.data);
  }

  @Patch('me/password')
  changeOwnPassword(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid password change request.');
    }
    return this.usersService.changeOwnPassword(currentUser, parsed.data);
  }

  @RequireRole(UserRole.Owner, UserRole.Admin)
  @RequirePermission(Permission.UserInvite)
  @Post('invite')
  inviteUser(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = inviteUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid user invite request.');
    }

    return this.usersService.inviteUser(currentUser, parsed.data);
  }

  @RequireRole(UserRole.Owner, UserRole.Admin)
  @Patch(':id/role')
  changeUserRole(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = changeRoleSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid role change request.');
    }

    return this.usersService.changeUserRole(currentUser, id, parsed.data);
  }

  @RequireRole(UserRole.Owner, UserRole.Admin)
  @Post(':id/disable')
  disableUser(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.usersService.disableUser(currentUser, id);
  }

  @RequireRole(UserRole.Owner, UserRole.Admin)
  @Post(':id/enable')
  enableUser(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.usersService.enableUser(currentUser, id);
  }
}
