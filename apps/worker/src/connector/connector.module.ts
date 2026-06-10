import { Module } from '@nestjs/common';
import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { PolicyClientModule } from '../policy-client/policy-client.module.js';
import { ConnectorActionAttemptService } from './connector-action-attempt.service.js';
import { SandboxVendorConnector } from './sandbox-vendor.connector.js';

@Module({
  imports: [PolicyClientModule, WorkerDatabaseModule],
  providers: [SandboxVendorConnector, ConnectorActionAttemptService],
  exports: [SandboxVendorConnector, ConnectorActionAttemptService]
})
export class ConnectorModule {}
