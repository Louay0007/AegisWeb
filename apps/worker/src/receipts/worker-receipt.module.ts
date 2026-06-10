import { Module } from '@nestjs/common';
import { AuditClientModule } from '../audit/audit-client.module.js';
import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { WorkerReceiptService } from './worker-receipt.service.js';

@Module({
  imports: [AuditClientModule, WorkerDatabaseModule],
  providers: [WorkerReceiptService],
  exports: [WorkerReceiptService]
})
export class WorkerReceiptModule {}
