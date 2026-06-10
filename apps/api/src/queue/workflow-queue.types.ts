import { WorkflowQueueName } from '@agentpass/domain';

export {
  WORKFLOW_QUEUE_JOB_NAMES,
  WORKFLOW_QUEUE_NAMES,
  workflowCancelJobId,
  workflowResumeJobId,
  workflowStartJobId
} from '@agentpass/domain';
export type { WorkflowQueueJobData, WorkflowQueueJobMode, WorkflowQueueName } from '@agentpass/domain';

export type EnqueueWorkflowStartInput = {
  workflowRunId: string;
  workflowId: string;
  organizationId: string;
  agentId: string;
  vendorId: string | null;
  template: string;
};

export type EnqueueWorkflowResumeInput = {
  workflowRunId: string;
  organizationId: string;
  approvalRequestId: string;
};

export type EnqueueWorkflowCancelInput = {
  workflowRunId: string;
  organizationId: string;
  reason: string;
};

export type WorkflowQueueEnqueueResult = {
  jobId: string;
  queueName: WorkflowQueueName;
  created: boolean;
};

export type WorkflowQueueJobDiagnostics = {
  queueName: WorkflowQueueName;
  jobId: string;
  name: string | null;
  state: string | null;
  attemptsMade: number | null;
  failedReason: string | null;
  timestamp: number | null;
  processedOn: number | null;
  finishedOn: number | null;
};

export type WorkflowRunQueueDiagnostics = {
  workflowRunId: string;
  organizationId: string;
  jobs: {
    start: WorkflowQueueJobDiagnostics;
    cancel: WorkflowQueueJobDiagnostics;
    resume: WorkflowQueueJobDiagnostics[];
  };
};
