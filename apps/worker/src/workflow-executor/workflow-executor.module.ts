import { Module } from '@nestjs/common';
import { AuditClientModule } from '../audit/audit-client.module.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { InternalApiModule } from '../internal-api/internal-api.module.js';
import { WorkerLoggingModule } from '../logging/worker-logging.module.js';
import { WorkerReceiptModule } from '../receipts/worker-receipt.module.js';
import { RunCancellationService } from './run-cancellation.service.js';
import { RunHeartbeatService } from './run-heartbeat.service.js';
import { WorkflowExecutorService } from './workflow-executor.service.js';

@Module({
  imports: [AuditClientModule, ConnectorModule, WorkerDatabaseModule, InternalApiModule, WorkerLoggingModule, WorkerReceiptModule],
  providers: [WorkflowExecutorService, RunCancellationService, RunHeartbeatService],
  exports: [WorkflowExecutorService, RunCancellationService, RunHeartbeatService]
})
export class WorkflowExecutorModule {}
