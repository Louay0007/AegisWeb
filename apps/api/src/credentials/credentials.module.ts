import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CredentialsController, InternalCredentialsController } from './credentials.controller.js';
import { CredentialsService } from './credentials.service.js';

@Module({
  imports: [AuditModule, ConfigModule, DatabaseModule],
  controllers: [CredentialsController, InternalCredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService]
})
export class CredentialsModule {}
