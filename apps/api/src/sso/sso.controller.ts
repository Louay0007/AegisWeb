import { Body, Controller, Get, Inject, Patch, Post } from '@nestjs/common';
import { Permission, UserRole } from '@agentpass/domain';
import { PublicRoute, RequirePermission, RequireRole, RequireStepUp } from '../authorization/authorization-metadata.js';
import { SsoService } from './sso.service.js';

@Controller()
export class SsoController {
  constructor(@Inject(SsoService) private readonly sso: SsoService) {}

  @RequirePermission(Permission.OrganizationRead)
  @Get('sso/config')
  getConfig() {
    return this.sso.getConfig();
  }

  @RequireRole(UserRole.Owner)
  @RequireStepUp()
  @Patch('sso/config')
  updateConfig(@Body() body: unknown) {
    return this.sso.updateConfig(body);
  }

  @PublicRoute()
  @Get('auth/saml/login')
  samlLogin() {
    return this.sso.startLogin();
  }

  @PublicRoute()
  @Post('auth/saml/acs')
  samlAcs() {
    return this.sso.startLogin();
  }

  @PublicRoute()
  @Get('auth/oidc/login')
  oidcLogin() {
    return this.sso.startLogin();
  }

  @PublicRoute()
  @Get('auth/oidc/callback')
  oidcCallback() {
    return this.sso.startLogin();
  }
}
