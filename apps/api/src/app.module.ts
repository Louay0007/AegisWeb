import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AgentsModule } from "./agents/agents.module.js";
import { ActionAttemptsModule } from "./action-attempts/action-attempts.module.js";
import { ApprovalsModule } from "./approvals/approvals.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthorizationModule } from "./authorization/authorization.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { ConfigModule } from "./config/config.module.js";
import { CredentialsModule } from "./credentials/credentials.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { ErrorsModule } from "./errors/errors.module.js";
import { FilesModule } from "./files/files.module.js";
import { HealthModule } from "./health/health.module.js";
import { InternalWorkerModule } from "./internal-worker/internal-worker.module.js";
import { LoggingModule } from "./logging/logging.module.js";
import { MetricsModule } from "./metrics/metrics.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { OrganizationModule } from "./organization/organization.module.js";
import { PoliciesModule } from "./policies/policies.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { ReceiptsModule } from "./receipts/receipts.module.js";
import { RequestLoggingMiddleware } from "./logging/request-logging.middleware.js";
import { RateLimitMiddleware } from "./rate-limit/rate-limit.middleware.js";
import { RequestContextMiddleware } from "./request-context/request-context.middleware.js";
import { RequestContextModule } from "./request-context/request-context.module.js";
import { SecurityHeadersMiddleware } from "./security/security-headers.middleware.js";
import { SecurityModule } from "./security/security.module.js";
import { SsoModule } from "./sso/sso.module.js";
import { UsersModule } from "./users/users.module.js";
import { UserPreferencesModule } from "./user-preferences/user-preferences.module.js";
import { VendorsModule } from "./vendors/vendors.module.js";
import { WorkflowsModule } from "./workflows/workflows.module.js";
import { WorkflowRunsModule } from "./workflow-runs/workflow-runs.module.js";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RequestContextModule,
    SecurityModule,
    MetricsModule,
    LoggingModule,
    ErrorsModule,
    HealthModule,
    AuthModule,
    BillingModule,
    ComplianceModule,
    SsoModule,
    AuthorizationModule,
    AuditModule,
    FilesModule,
    OrganizationModule,
    UsersModule,
    UserPreferencesModule,
    AgentsModule,
    ActionAttemptsModule,
    ApprovalsModule,
    VendorsModule,
    PoliciesModule,
    CredentialsModule,
    QueueModule,
    InternalWorkerModule,
    ReceiptsModule,
    NotificationsModule,
    WorkflowsModule,
    WorkflowRunsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestContextMiddleware,
        SecurityHeadersMiddleware,
        RateLimitMiddleware,
        RequestLoggingMiddleware,
      )
      .forRoutes("*");
  }
}
