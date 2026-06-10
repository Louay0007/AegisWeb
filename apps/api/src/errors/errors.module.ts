import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RequestContextModule } from '../request-context/request-context.module.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter
    }
  ]
})
export class ErrorsModule {}
