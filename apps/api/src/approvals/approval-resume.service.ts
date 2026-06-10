import { Inject, Injectable } from '@nestjs/common';
import { ApprovalRequest } from '@prisma/client';
import { WorkflowQueueService } from '../queue/workflow-queue.service.js';

@Injectable()
export class ApprovalResumeService {
  constructor(@Inject(WorkflowQueueService) private readonly queue: WorkflowQueueService) {}

  async enqueueResume(approval: ApprovalRequest): Promise<{ jobId: string }> {
    return this.queue.enqueueResume({
      workflowRunId: approval.workflowRunId,
      organizationId: approval.organizationId,
      approvalRequestId: approval.id
    });
  }
}
