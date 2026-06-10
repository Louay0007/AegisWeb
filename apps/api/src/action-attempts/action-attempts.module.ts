import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ActionAttemptsReadController, InternalActionAttemptsController } from './action-attempts.controller.js';
import { ActionAttemptsService } from './action-attempts.service.js';
import { ActionClassificationService } from './action-classification.service.js';
import { RiskSignalService } from './risk-signal.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ActionAttemptsReadController, InternalActionAttemptsController],
  providers: [ActionAttemptsService, ActionClassificationService, RiskSignalService],
  exports: [ActionAttemptsService, ActionClassificationService, RiskSignalService]
})
export class ActionAttemptsModule {}
