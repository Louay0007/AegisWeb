import { Global, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RequestContextModule } from '../request-context/request-context.module.js';
import { AuthorizationReflector } from './authorization-reflector.js';
import { InternalWorkerGuard } from './internal-worker.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OptionalAuthGuard } from './optional-auth.guard.js';
import { OrganizationScopeService } from './organization-scope.service.js';
import { PermissionsGuard } from './permissions.guard.js';
import { RolesGuard } from './roles.guard.js';
import { StepUpGuard } from './step-up.guard.js';

@Global()
@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule, RequestContextModule],
  providers: [
    Reflector,
    AuthorizationReflector,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    PermissionsGuard,
    StepUpGuard,
    InternalWorkerGuard,
    OrganizationScopeService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    },
    {
      provide: APP_GUARD,
      useClass: StepUpGuard
    }
  ],
  exports: [
    AuthorizationReflector,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    PermissionsGuard,
    StepUpGuard,
    InternalWorkerGuard,
    OrganizationScopeService
  ]
})
export class AuthorizationModule {}
