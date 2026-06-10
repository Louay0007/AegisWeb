import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { WorkflowQueueService } from './workflow-queue.service.js';

@Module({
  imports: [AuditModule, ConfigModule, DatabaseModule],
  providers: [WorkflowQueueService],
  exports: [WorkflowQueueService]
})
export class QueueModule {}
