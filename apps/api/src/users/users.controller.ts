import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission, UserRole, USER_ROLES } from '@agentpass/domain';
import { RequirePermission, RequireRole } from '../authorization/authorization-metadata.js';
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

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @RequirePermission(Permission.UserRead)
  @Get()
  listUsers(@CurrentOrganizationId() organizationId: string | undefined) {
    return this.usersService.listUsers(organizationId);
  }

  @RequirePermission(Permission.UserRead)
  @Get(':id')
  getUser(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.usersService.getUser(organizationId, id);
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
}
