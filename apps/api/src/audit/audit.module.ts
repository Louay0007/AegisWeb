import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuditController } from './audit.controller.js';
import { AuditHashService } from './audit-hash.service.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditRedactionService } from './audit-redaction.service.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService, AuditHashService, AuditQueryService, AuditRedactionService],
  exports: [AuditService, AuditHashService, AuditQueryService, AuditRedactionService]
})
export class AuditModule {}
