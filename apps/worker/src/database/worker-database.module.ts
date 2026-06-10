import { Global, Module } from '@nestjs/common';
import { WorkerConfigModule } from '../config/worker-config.module.js';
import { WorkerDatabaseService } from './worker-database.service.js';

@Global()
@Module({
  imports: [WorkerConfigModule],
  providers: [WorkerDatabaseService],
  exports: [WorkerDatabaseService]
})
export class WorkerDatabaseModule {}
