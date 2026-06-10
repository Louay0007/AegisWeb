import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PoliciesController } from './policies.controller.js';
import { PolicyEvaluationService } from './policy-evaluation.service.js';
import { PolicySnapshotService } from './policy-snapshot.service.js';
import { PolicyValidationService } from './policy-validation.service.js';
import { PoliciesService } from './policies.service.js';

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyValidationService, PolicySnapshotService, PolicyEvaluationService],
  exports: [PoliciesService, PolicyValidationService, PolicySnapshotService, PolicyEvaluationService]
})
export class PoliciesModule {}
