import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { WorkflowRunQueryService } from './workflow-run-query.service.js';
import { WorkflowRunStateMachine } from './workflow-run-state-machine.js';
import { WorkflowRunsController } from './workflow-runs.controller.js';
import { WorkflowRunsService } from './workflow-runs.service.js';

@Module({
  imports: [AuditModule, DatabaseModule, QueueModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService, WorkflowRunStateMachine, WorkflowRunQueryService],
  exports: [WorkflowRunsService, WorkflowRunStateMachine, WorkflowRunQueryService]
})
export class WorkflowRunsModule {}
