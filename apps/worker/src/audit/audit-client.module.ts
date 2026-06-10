import { Module } from '@nestjs/common';
import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { WorkerAuditService } from './worker-audit.service.js';

@Module({
  imports: [WorkerDatabaseModule],
  providers: [WorkerAuditService],
  exports: [WorkerAuditService]
})
export class AuditClientModule {}
