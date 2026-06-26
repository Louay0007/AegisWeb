import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service.js';
import { RequestContextCarrier, readHeader } from '../request-context/types.js';
import { PinoLoggingService } from './pino-logger.js';

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

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    @Inject(PinoLoggingService) private readonly logger: PinoLoggingService,
    @Inject(MetricsService) private readonly metrics: MetricsService
  ) {}

  use(request: LoggableRequest, response: ResponseWithFinishEvent, next: NextFunction): void {
    const startedAt = performance.now();
    const method = request.method ?? 'UNKNOWN';
    const url = request.originalUrl ?? request.url ?? '/';
    const requestId = request.requestContext?.requestId ?? readHeader(request.headers, 'x-request-id') ?? 'unknown';

    response.on('finish', () => {
      const latencyMs = Math.round(performance.now() - startedAt);
      const statusCode = response.statusCode ?? 0;
      const route = normalizeRoute(url);
      const context = request.requestContext;
      this.logger.info('http_request_completed', {
        method,
        url,
        route,
        statusCode,
        duration: latencyMs,
        latencyMs,
        requestId,
        orgId: context?.organizationId ?? context?.user?.organizationId,
        userId: context?.user?.id
      });
      this.metrics.observeHttpRequest({ method, route, statusCode: String(statusCode) }, latencyMs);
    });

    next();
  }
}

function normalizeRoute(url: string): string {
  const [path] = url.split('?');
  return path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
}
