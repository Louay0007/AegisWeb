import { Global, Module } from '@nestjs/common';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';

@Global()
@Module({
  providers: [RequestLoggingMiddleware],
  exports: [RequestLoggingMiddleware]
})
export class LoggingModule {}
