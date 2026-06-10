import { Inject, Injectable } from '@nestjs/common';
import { Policy } from '@prisma/client';
import { AgentPolicySnapshot } from '@agentpass/domain';
import { PolicyValidationService } from './policy-validation.service.js';

@Injectable()
export class PolicySnapshotService {
  constructor(@Inject(PolicyValidationService) private readonly validation: PolicyValidationService) {}

  fromPolicy(policy: Policy): AgentPolicySnapshot {
    return this.validation.validateSnapshot(policy.rulesJson);
  }
}
