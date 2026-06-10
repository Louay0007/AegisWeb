import { Agent, AuditEvent, WorkflowRun } from '@prisma/client';
import { toAuditEventDto } from '../audit/audit.types.js';

export type AgentDto = {
  id: string;
  organizationId: string;
  name: string;
  identifier: string;
  purpose: string;
  status: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type AgentActivityDto = {
  agent: AgentDto;
  auditEvents: ReturnType<typeof toAuditEventDto>[];
  workflowRuns: Array<{
    id: string;
    workflowId: string;
    vendorId: string | null;
    status: string;
    currentStep: string | null;
    resultSummary: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export function toAgentDto(agent: Agent): AgentDto {
  return {
    id: agent.id,
    organizationId: agent.organizationId,
    name: agent.name,
    identifier: agent.identifier,
    purpose: agent.purpose,
    status: agent.status,
    createdByUserId: agent.createdByUserId,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    revokedAt: agent.revokedAt?.toISOString() ?? null
  };
}

export function toAgentActivityDto(
  agent: Agent,
  auditEvents: AuditEvent[],
  workflowRuns: WorkflowRun[]
): AgentActivityDto {
  return {
    agent: toAgentDto(agent),
    auditEvents: auditEvents.map(toAuditEventDto),
    workflowRuns: workflowRuns.map((run) => ({
      id: run.id,
      workflowId: run.workflowId,
      vendorId: run.vendorId,
      status: run.status,
      currentStep: run.currentStep,
      resultSummary: run.resultSummary,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString()
    }))
  };
}
