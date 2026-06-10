import { Logger, NestMiddleware } from '@nestjs/common';
import { RequestContextCarrier, readHeader } from '../request-context/types.js';

type NextFunction = () => void;
type ResponseWithFinishEvent = {
  statusCode?: number;
  on(event: 'finish', handler: () => void): void;
};
type LoggableRequest = RequestContextCarrier & {
  method?: string;
  originalUrl?: string;
  url?: string;
};

export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: LoggableRequest, response: ResponseWithFinishEvent, next: NextFunction): void {
    const startedAt = performance.now();
    const method = request.method ?? 'UNKNOWN';
    const url = request.originalUrl ?? request.url ?? '/';
    const requestId = request.requestContext?.requestId ?? readHeader(request.headers, 'x-request-id') ?? 'unknown';

    response.on('finish', () => {
      const latencyMs = Math.round(performance.now() - startedAt);
      this.logger.log(`${method} ${url} ${response.statusCode ?? 0} ${latencyMs}ms requestId=${requestId}`);
    });

    next();
  }
}
