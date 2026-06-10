import { Module } from '@nestjs/common';
import { WorkerLogger } from './worker-logger.service.js';

@Module({
  providers: [WorkerLogger],
  exports: [WorkerLogger]
})
export class WorkerLoggingModule {}
