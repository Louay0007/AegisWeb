import { Module } from '@nestjs/common';
import { WorkerConfigModule } from '../config/worker-config.module.js';
import { InternalApiModule } from '../internal-api/internal-api.module.js';
import { WorkerRuntimeService } from './worker-runtime.service.js';

@Module({
  imports: [WorkerConfigModule, InternalApiModule],
  providers: [WorkerRuntimeService],
  exports: [WorkerRuntimeService]
})
export class RuntimeModule {}
