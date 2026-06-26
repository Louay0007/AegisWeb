import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission, UserRole } from '@agentpass/domain';
import { RequirePermission, RequireRole, RequireStepUp } from '../authorization/authorization-metadata.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { OrganizationService } from './organization.service.js';

const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    domain: z.string().min(1).max(160).toLowerCase().optional(),
    billingEmail: z.string().email().toLowerCase().nullable().optional()
  })
  .refine((value) => value.name !== undefined || value.domain !== undefined || value.billingEmail !== undefined, {
    message: 'At least one organization field is required.'
  });

@Controller('organization')
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly organizationService: OrganizationService) {}

  @RequirePermission(Permission.OrganizationRead)
  @Get()
  getCurrentOrganization(@CurrentOrganizationId() organizationId: string | undefined) {
    return this.organizationService.getCurrentOrganization(organizationId);
  }

  @RequireRole(UserRole.Owner)
  @RequirePermission(Permission.OrganizationUpdate)
  @RequireStepUp()
  @Patch()
  updateCurrentOrganization(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = updateOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid organization update request.');
    }

    return this.organizationService.updateCurrentOrganization(currentUser, parsed.data);
  }
}
