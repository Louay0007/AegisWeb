import { ActionAttempt, Prisma } from '@prisma/client';
import { redactSecretLikeValues } from '@agentpass/vault';
import { enumToDomain } from './action-attempt-mapping.js';

export type ActionAttemptDto = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  agentId: string;
  vendorId: string | null;
  website: string;
  actionType: string;
  riskLevel: string;
  policyDecision: string;
  policyReason: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  amountCents: number | null;
  metadataJson: Prisma.JsonValue;
  createdAt: string;
  completedAt: string | null;
};

export function toActionAttemptDto(attempt: ActionAttempt): ActionAttemptDto {
  return {
    id: attempt.id,
    organizationId: attempt.organizationId,
    workflowRunId: attempt.workflowRunId,
    agentId: attempt.agentId,
    vendorId: attempt.vendorId,
    website: attempt.website,
    actionType: enumToDomain(attempt.actionType),
    riskLevel: enumToDomain(attempt.riskLevel),
    policyDecision: enumToDomain(attempt.policyDecision),
    policyReason: attempt.policyReason,
    inputSummary: attempt.inputSummary,
    outputSummary: attempt.outputSummary,
    amountCents: attempt.amountCents,
    metadataJson: redactSecretLikeValues(attempt.metadataJson) as Prisma.JsonValue,
    createdAt: attempt.createdAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null
  };
}
