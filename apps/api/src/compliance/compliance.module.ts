import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ComplianceController } from './compliance.controller.js';
import { ComplianceService } from './compliance.service.js';

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [ComplianceController],
  providers: [ComplianceService]
})
export class ComplianceModule {}
