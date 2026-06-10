import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode, hasPermission } from '@agentpass/domain';
import { AuthorizationReflector } from './authorization-reflector.js';
import { AuthorizationRequest } from './authenticated-request.js';
import { normalizeRole } from './role-normalization.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(AuthorizationReflector) private readonly authorization: AuthorizationReflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.authorization.isPublic(context) || this.authorization.isInternal(context)) {
      return true;
    }

    const requiredPermissions = this.authorization.requiredPermissions(context);

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const role = normalizeRole(request.auth?.user?.role);

    if (!role || !requiredPermissions.every((permission) => hasPermission(role, permission))) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Required permission is missing.');
    }

    return true;
  }
}
