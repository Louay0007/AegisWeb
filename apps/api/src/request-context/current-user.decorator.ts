import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ContextUser, RequestContextCarrier } from './types.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): ContextUser | undefined => {
  const request = context.switchToHttp().getRequest<RequestContextCarrier>();
  return request.requestContext?.user;
});
