import { Body, Controller, Get, Inject, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { RequirePermission, RequireStepUp } from '../authorization/authorization-metadata.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { ComplianceService } from './compliance.service.js';

const complianceSettingsSchema = z.object({
  auditRetentionDays: z.number().int().min(30).max(3650),
  fileRetentionDays: z.number().int().min(30).max(3650),
  legalHoldEnabled: z.boolean()
});

@Controller()
export class ComplianceController {
  constructor(@Inject(ComplianceService) private readonly compliance: ComplianceService) {}

  @RequirePermission(Permission.OrganizationRead)
  @Get('organization/compliance')
  getSettings(@CurrentUser() currentUser: ContextUser | undefined) {
    return this.compliance.getSettings(currentUser);
  }

  @RequirePermission(Permission.OrganizationUpdate)
  @RequireStepUp()
  @Patch('organization/compliance')
  updateSettings(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = complianceSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid compliance settings.');
    }
    return this.compliance.updateSettings(currentUser, parsed.data);
  }

  @RequirePermission(Permission.OrganizationRead)
  @Post('account/export')
  exportAccount(@CurrentUser() currentUser: ContextUser | undefined) {
    return this.compliance.exportAccount(currentUser);
  }

  @RequireStepUp()
  @Post('account/delete')
  deleteAccount(@CurrentUser() currentUser: ContextUser | undefined) {
    return this.compliance.deleteAccount(currentUser);
  }
}
