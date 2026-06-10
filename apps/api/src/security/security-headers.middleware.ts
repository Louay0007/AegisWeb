import { Injectable, NestMiddleware } from '@nestjs/common';
import { ResponseHeaderWriter } from '../request-context/types.js';

type NextFunction = () => void;

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_request: unknown, response: ResponseHeaderWriter, next: NextFunction): void {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    response.setHeader('x-agentpass-service', 'api');
    next();
  }
}
