import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ContextUser, RequestContextCarrier, readHeader } from './types.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): ContextUser | undefined => {
  const request = context.switchToHttp().getRequest<RequestContextCarrier>();

  if (request.requestContext?.user) {
    return request.requestContext.user;
  }

  const userId = readHeader(request.headers, 'x-user-id');
  const organizationId = readHeader(request.headers, 'x-organization-id');
  const role = readHeader(request.headers, 'x-user-role');

  return userId && organizationId ? { id: userId, organizationId, role } : undefined;
});
