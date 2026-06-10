import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { RequestContextService } from '../request-context/request-context.service.js';
import { readAuthorizationBearer } from '../auth/http-types.js';
import { TokenService } from '../auth/token.service.js';
import { AuthorizationReflector } from './authorization-reflector.js';
import { AuthorizationRequest } from './authenticated-request.js';
import { normalizeRole } from './role-normalization.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthorizationReflector) private readonly authorization: AuthorizationReflector,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.authorization.isPublic(context) || this.authorization.isInternal(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    if (isDocumentationRoute(request.url)) {
      return true;
    }

    const token = readAuthorizationBearer(request.headers);

    if (!token) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const payload = this.tokenService.verifyAccessToken(token);
    const user = await this.database.client.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (!user || user.status !== 'ACTIVE' || user.organizationId !== payload.organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const authenticatedUser = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: normalizeRole(user.role) ?? user.role
    };

    request.auth = {
      accessToken: payload,
      user: authenticatedUser
    };
    request.requestContext = {
      ...(request.requestContext ?? { requestId: this.requestContext.getRequestId() ?? 'req_unknown' }),
      user: authenticatedUser,
      organizationId: authenticatedUser.organizationId
    };
    this.requestContext.setAuthenticatedUser(authenticatedUser);

    return true;
  }
}

function isDocumentationRoute(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0];
  return path === '/docs' || path === '/docs-json' || path.startsWith('/docs/');
}
