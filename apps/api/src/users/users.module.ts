import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PasswordService } from '../auth/password.service.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule, ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService]
})
export class UsersModule {}
