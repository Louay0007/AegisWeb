import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { readAuthorizationBearer } from '../auth/http-types.js';
import { TokenService } from '../auth/token.service.js';
import { RequestContextService } from '../request-context/request-context.service.js';
import { AuthorizationRequest } from './authenticated-request.js';
import { normalizeRole } from './role-normalization.js';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const token = readAuthorizationBearer(request.headers);

    if (!token) {
      return true;
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

    if (!user || user.status !== 'ACTIVE') {
      return true;
    }

    const authenticatedUser = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: normalizeRole(user.role) ?? user.role
    };

    request.auth = { accessToken: payload, user: authenticatedUser };
    request.requestContext = {
      ...(request.requestContext ?? { requestId: this.requestContext.getRequestId() ?? 'req_unknown' }),
      user: authenticatedUser,
      organizationId: authenticatedUser.organizationId
    };
    this.requestContext.setAuthenticatedUser(authenticatedUser);

    return true;
  }
}
