import { Module } from '@nestjs/common';
import { InternalApiModule } from '../internal-api/internal-api.module.js';
import { WorkerAuditService } from './worker-audit.service.js';

@Module({
  imports: [InternalApiModule],
  providers: [WorkerAuditService],
  exports: [WorkerAuditService]
})
export class AuditClientModule {}
