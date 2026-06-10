import { Module } from '@nestjs/common';
import { WorkerConfigModule } from '../config/worker-config.module.js';
import { WorkerLoggingModule } from '../logging/worker-logging.module.js';
import { WorkflowExecutorModule } from '../workflow-executor/workflow-executor.module.js';
import { WorkerQueueService } from './worker-queue.service.js';

@Module({
  imports: [WorkerConfigModule, WorkerLoggingModule, WorkflowExecutorModule],
  providers: [WorkerQueueService],
  exports: [WorkerQueueService]
})
export class WorkerQueueModule {}
