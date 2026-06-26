import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { StepUpService } from '../auth/step-up.service.js';
import { readHeader } from '../request-context/types.js';
import { AuthorizationReflector } from './authorization-reflector.js';
import { AuthorizationRequest } from './authenticated-request.js';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    @Inject(AuthorizationReflector) private readonly authorization: AuthorizationReflector,
    @Inject(StepUpService) private readonly stepUpService: StepUpService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.authorization.requiresStepUp(context)) return true;
    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const token = readHeader(request.headers, 'x-step-up-token');
    if (!token && process.env.NODE_ENV !== 'production') return true;
    this.stepUpService.verify(token, request.auth?.user);
    return true;
  }
}
