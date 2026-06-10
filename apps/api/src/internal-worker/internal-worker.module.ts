import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FilesModule } from '../files/files.module.js';
import { InternalWorkerController } from './internal-worker.controller.js';
import { InternalWorkerService } from './internal-worker.service.js';

@Module({
  imports: [AuditModule, DatabaseModule, FilesModule],
  controllers: [InternalWorkerController],
  providers: [InternalWorkerService],
  exports: [InternalWorkerService]
})
export class InternalWorkerModule {}
