import { Module } from '@nestjs/common';
import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { PolicyClientModule } from '../policy-client/policy-client.module.js';
import { ConnectorActionAttemptService } from './connector-action-attempt.service.js';
import { ConnectorRegistry } from './connector-registry.service.js';
import { GitHubConnector } from './github.connector.js';
import { SandboxVendorConnector } from './sandbox-vendor.connector.js';
import { StripeBillingConnector } from './stripe-billing.connector.js';

@Module({
  imports: [PolicyClientModule, WorkerDatabaseModule],
  providers: [
    SandboxVendorConnector,
    StripeBillingConnector,
    GitHubConnector,
    ConnectorActionAttemptService,
    ConnectorRegistry
  ],
  exports: [
    SandboxVendorConnector,
    StripeBillingConnector,
    GitHubConnector,
    ConnectorActionAttemptService,
    ConnectorRegistry
  ]
})
export class ConnectorModule {}
