import { Module } from '@nestjs/common';
import { WorkerPolicyClient } from './worker-policy-client.service.js';

@Module({
  providers: [WorkerPolicyClient],
  exports: [WorkerPolicyClient]
})
export class PolicyClientModule {}
