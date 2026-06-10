export const WORKFLOW_QUEUE_NAMES = {
  runs: 'workflow-runs',
  resume: 'workflow-resume',
  maintenance: 'workflow-maintenance'
} as const;

export type WorkflowQueueName = (typeof WORKFLOW_QUEUE_NAMES)[keyof typeof WORKFLOW_QUEUE_NAMES];

export const WORKFLOW_QUEUE_JOB_NAMES = {
  start: 'workflow.run.start',
  resume: 'workflow.run.resume',
  cancel: 'workflow.run.cancel'
} as const;

export type WorkflowQueueJobMode = 'start' | 'resume' | 'cancel';

export type WorkflowQueueJobData = {
  workflowRunId: string;
  organizationId: string;
  mode: WorkflowQueueJobMode;
  approvalRequestId: string | null;
  attempt: number;
  requestedAt: string;
  workflowId?: string;
  agentId?: string;
  vendorId?: string | null;
  template?: string;
  reason?: string;
  workerRunToken?: string;
};

export function workflowStartJobId(workflowRunId: string): string {
  return `start-${workflowRunId}`;
}

export function workflowResumeJobId(workflowRunId: string, approvalRequestId: string): string {
  return `resume-${workflowRunId}-${approvalRequestId}`;
}

export function workflowCancelJobId(workflowRunId: string): string {
  return `cancel-${workflowRunId}`;
}
