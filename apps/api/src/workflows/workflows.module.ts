import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { WorkflowTemplateService } from './workflow-template.service.js';
import { WorkflowValidationService } from './workflow-validation.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  imports: [AuditModule, DatabaseModule, QueueModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowTemplateService, WorkflowValidationService],
  exports: [WorkflowsService, WorkflowTemplateService, WorkflowValidationService]
})
export class WorkflowsModule {}
