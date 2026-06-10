import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { AuthorizationReflector } from './authorization-reflector.js';
import { AuthorizationRequest } from './authenticated-request.js';
import { normalizeRole } from './role-normalization.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(AuthorizationReflector) private readonly authorization: AuthorizationReflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.authorization.isPublic(context) || this.authorization.isInternal(context)) {
      return true;
    }

    const requiredRoles = this.authorization.requiredRoles(context);

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const role = normalizeRole(request.auth?.user?.role);

    if (!role || !requiredRoles.includes(role)) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Required role is missing.');
    }

    return true;
  }
}
