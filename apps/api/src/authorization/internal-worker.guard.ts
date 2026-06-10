import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode, verifyWorkerRunToken } from '@agentpass/domain';
import { ConfigService } from '../config/config.service.js';
import { readAuthorizationBearer } from '../auth/http-types.js';
import { readHeader } from '../request-context/types.js';
import { AuthorizationRequest } from './authenticated-request.js';

@Injectable()
export class InternalWorkerGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const providedToken = readHeader(request.headers, 'x-worker-token') ?? readAuthorizationBearer(request.headers);
    const workflowRunId = readRunIdFromRequest(request.url) ?? readRunIdFromBody(request.body);

    if (!providedToken) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Valid worker token is required.');
    }

    const scoped = verifyWorkerRunToken(this.configService.config.workerInternalToken, providedToken, {
      workflowRunId
    });
    if (scoped) {
      request.auth = {
        ...(request.auth ?? {}),
        worker: {
          organizationId: scoped.organizationId,
          workflowRunId: scoped.workflowRunId,
          expiresAt: scoped.expiresAt
        }
      };
      return true;
    }

    if (this.configService.config.nodeEnv !== 'production' && providedToken === this.configService.config.workerInternalToken) {
      return true;
    }

    throw new DomainError(DomainErrorCode.PermissionDenied, 'Valid worker token is required.');

  }
}

function readRunIdFromRequest(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.match(/\/runs\/([^/?]+)/)?.[1];
}

function readRunIdFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const workflowRunId = (body as { workflowRunId?: unknown }).workflowRunId;
  return typeof workflowRunId === 'string' ? workflowRunId : undefined;
}
