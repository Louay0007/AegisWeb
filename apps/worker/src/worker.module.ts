import { Module } from '@nestjs/common';
import { AuditClientModule } from './audit/audit-client.module.js';
import { WorkerConfigModule } from './config/worker-config.module.js';
import { ConnectorModule } from './connector/connector.module.js';
import { FileStorageModule } from './file-storage/file-storage.module.js';
import { InternalApiModule } from './internal-api/internal-api.module.js';
import { WorkerLoggingModule } from './logging/worker-logging.module.js';
import { PolicyClientModule } from './policy-client/policy-client.module.js';
import { WorkerQueueModule } from './queue/worker-queue.module.js';
import { WorkerReceiptModule } from './receipts/worker-receipt.module.js';
import { RuntimeModule } from './runtime/runtime.module.js';
import { VaultClientModule } from './vault-client/vault-client.module.js';
import { WorkerService } from './worker.service.js';
import { WorkflowExecutorModule } from './workflow-executor/workflow-executor.module.js';

@Module({
  imports: [
    WorkerConfigModule,
    WorkerLoggingModule,
    InternalApiModule,
    RuntimeModule,
    WorkerQueueModule,
    WorkflowExecutorModule,
    PolicyClientModule,
    VaultClientModule,
    AuditClientModule,
    FileStorageModule,
    ConnectorModule,
    WorkerReceiptModule
  ],
  providers: [WorkerService],
  exports: [WorkerService]
})
export class WorkerModule {}
