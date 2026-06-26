import { SetMetadata } from '@nestjs/common';
import { Permission, UserRole } from '@agentpass/domain';

export const AUTHORIZATION_METADATA = {
  public: 'agentpass:public-route',
  internal: 'agentpass:internal-route',
  roles: 'agentpass:required-roles',
  permissions: 'agentpass:required-permissions',
  stepUp: 'agentpass:requires-step-up'
} as const;

export const PublicRoute = () => SetMetadata(AUTHORIZATION_METADATA.public, true);
export const InternalRoute = () => SetMetadata(AUTHORIZATION_METADATA.internal, true);
export const RequireRole = (...roles: UserRole[]) => SetMetadata(AUTHORIZATION_METADATA.roles, roles);
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(AUTHORIZATION_METADATA.permissions, permissions);
export const RequireStepUp = () => SetMetadata(AUTHORIZATION_METADATA.stepUp, true);
