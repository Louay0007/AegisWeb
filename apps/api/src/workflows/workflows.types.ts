import { Prisma, Workflow, WorkflowRun } from '@prisma/client';
import {
  fromPrismaWorkflowRunStatus,
  fromPrismaWorkflowStatus,
  fromPrismaWorkflowTemplate
} from './workflow-type-mapping.js';

export type WorkflowDto = {
  id: string;
  organizationId: string;
  agentId: string;
  vendorId: string;
  name: string;
  template: string;
  status: string;
  configurationJson: Prisma.JsonValue;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunDto = {
  id: string;
  organizationId: string;
  workflowId: string;
  agentId: string;
  vendorId: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  currentStep: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  stateJson: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

export function toWorkflowDto(workflow: Workflow): WorkflowDto {
  return {
    id: workflow.id,
    organizationId: workflow.organizationId,
    agentId: workflow.agentId,
    vendorId: workflow.vendorId,
    name: workflow.name,
    template: fromPrismaWorkflowTemplate(workflow.template),
    status: fromPrismaWorkflowStatus(workflow.status),
    configurationJson: workflow.configurationJson,
    createdByUserId: workflow.createdByUserId,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString()
  };
}

export function toWorkflowRunDto(run: WorkflowRun): WorkflowRunDto {
  return {
    id: run.id,
    organizationId: run.organizationId,
    workflowId: run.workflowId,
    agentId: run.agentId,
    vendorId: run.vendorId,
    status: fromPrismaWorkflowRunStatus(run.status),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    currentStep: run.currentStep,
    resultSummary: run.resultSummary,
    errorMessage: run.errorMessage,
    stateJson: run.stateJson,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}
