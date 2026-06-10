import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { WorkflowRunsModule } from '../workflow-runs/workflow-runs.module.js';
import { ApprovalExpirationService } from './approval-expiration.service.js';
import { ApprovalResumeService } from './approval-resume.service.js';
import { ApprovalsController, InternalApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';

@Module({
  imports: [AuditModule, DatabaseModule, NotificationsModule, QueueModule, WorkflowRunsModule],
  controllers: [ApprovalsController, InternalApprovalsController],
  providers: [ApprovalsService, ApprovalExpirationService, ApprovalResumeService],
  exports: [ApprovalsService, ApprovalExpirationService, ApprovalResumeService]
})
export class ApprovalsModule {}
