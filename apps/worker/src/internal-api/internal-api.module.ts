import { Module } from '@nestjs/common';
import { WorkerConfigModule } from '../config/worker-config.module.js';
import { InternalApiClient } from './internal-api-client.service.js';

@Module({
  imports: [WorkerConfigModule],
  providers: [InternalApiClient],
  exports: [InternalApiClient]
})
export class InternalApiModule {}
