import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContextService } from './request-context.service.js';
import { readHeader, RequestContextCarrier, ResponseHeaderWriter } from './types.js';

type NextFunction = () => void;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(RequestContextService) private readonly requestContext: RequestContextService) {}

  use(request: RequestContextCarrier, response: ResponseHeaderWriter, next: NextFunction): void {
    const requestId = readHeader(request.headers, 'x-request-id') ?? `req_${randomUUID()}`;

    const context = {
      requestId
    };

    request.requestContext = context;
    response.setHeader('x-request-id', requestId);
    this.requestContext.run(context, next);
  }
}
