import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { Permission } from '@agentpass/domain';
import { PublicRoute, RequirePermission, RequireRole } from '../authorization/authorization-metadata.js';
import { BillingService } from './billing.service.js';
import { UserRole } from '@agentpass/domain';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';

type RawBodyRequest = {
  rawBody?: Buffer;
  headers: Record<string, string | string[] | undefined>;
};

@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @RequirePermission(Permission.OrganizationRead)
  @Get()
  getStatus(@CurrentOrganizationId() organizationId: string) {
    return this.billing.getStatus(organizationId);
  }

  @RequireRole(UserRole.Owner)
  @Post('create-checkout')
  createCheckout(
    @CurrentOrganizationId() organizationId: string,
    @CurrentUser() user: ContextUser,
    @Body() body: unknown
  ) {
    return this.billing.createCheckout(organizationId, user.id, body);
  }

  @RequireRole(UserRole.Owner)
  @Post('portal')
  createPortal(@CurrentOrganizationId() organizationId: string) {
    return this.billing.createPortal(organizationId);
  }

  @PublicRoute()
  @Post('webhook')
  handleWebhook(@Req() request: RawBodyRequest, @Body() body: unknown) {
    return this.billing.handleWebhook(request.rawBody, request.headers, body);
  }
}
