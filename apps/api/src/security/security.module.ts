import { Global, Module } from '@nestjs/common';
import { SecurityHeadersMiddleware } from './security-headers.middleware.js';

@Global()
@Module({
  providers: [SecurityHeadersMiddleware],
  exports: [SecurityHeadersMiddleware]
})
export class SecurityModule {}
