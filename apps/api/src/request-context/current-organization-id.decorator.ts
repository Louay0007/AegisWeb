import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContextCarrier, readHeader } from './types.js';

export const CurrentOrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<RequestContextCarrier>();
    return (
      request.requestContext?.organizationId ??
      request.requestContext?.user?.organizationId ??
      readHeader(request.headers, 'x-organization-id')
    );
  }
);
