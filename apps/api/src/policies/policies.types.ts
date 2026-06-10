import { Policy, Prisma } from '@prisma/client';
import { fromPrismaPolicyStatus, fromPrismaPolicyType } from './policy-type-mapping.js';

export type PolicyDto = {
  id: string;
  organizationId: string;
  agentId: string | null;
  name: string;
  type: string;
  version: number;
  status: string;
  rulesJson: Prisma.JsonValue;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export function toPolicyDto(policy: Policy): PolicyDto {
  return {
    id: policy.id,
    organizationId: policy.organizationId,
    agentId: policy.agentId,
    name: policy.name,
    type: fromPrismaPolicyType(policy.type),
    version: policy.version,
    status: fromPrismaPolicyStatus(policy.status),
    rulesJson: policy.rulesJson,
    createdByUserId: policy.createdByUserId,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString()
  };
}
