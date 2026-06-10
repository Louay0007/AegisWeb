import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ApprovalEmailBuilder } from './approval-email.builder.js';
import { EmailNotificationAdapter } from './email-notification.adapter.js';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [NotificationService, ApprovalEmailBuilder, EmailNotificationAdapter],
  exports: [NotificationService, EmailNotificationAdapter]
})
export class NotificationsModule {}
