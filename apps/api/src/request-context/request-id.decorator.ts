import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContextCarrier, readHeader } from './types.js';

export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext): string | undefined => {
  const request = context.switchToHttp().getRequest<RequestContextCarrier>();
  return request.requestContext?.requestId ?? readHeader(request.headers, 'x-request-id');
});
