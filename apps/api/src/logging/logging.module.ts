import { Global, Module } from '@nestjs/common';
import { PinoLoggingService } from './pino-logger.js';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';

@Global()
@Module({
  providers: [PinoLoggingService, RequestLoggingMiddleware],
  exports: [PinoLoggingService, RequestLoggingMiddleware]
})
export class LoggingModule {}
