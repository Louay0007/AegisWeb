import {
  WorkflowRunStatus as PrismaWorkflowRunStatus,
  WorkflowStatus as PrismaWorkflowStatus,
  WorkflowTemplate as PrismaWorkflowTemplate
} from '@prisma/client';
import { WorkflowRunStatus, WorkflowStatus, WorkflowTemplate } from '@agentpass/domain';

export function toPrismaWorkflowTemplate(template: WorkflowTemplate): PrismaWorkflowTemplate {
  switch (template) {
    case WorkflowTemplate.VendorInvoiceDownload:
      return PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD;
    case WorkflowTemplate.SaasRenewalCheck:
      return PrismaWorkflowTemplate.SAAS_RENEWAL_CHECK;
    case WorkflowTemplate.PlanDowngradeRequest:
      return PrismaWorkflowTemplate.PLAN_DOWNGRADE_REQUEST;
  }
}

export function toPrismaWorkflowStatus(status: WorkflowStatus): PrismaWorkflowStatus {
  switch (status) {
    case WorkflowStatus.Active:
      return PrismaWorkflowStatus.ACTIVE;
    case WorkflowStatus.Paused:
      return PrismaWorkflowStatus.PAUSED;
    case WorkflowStatus.Archived:
      return PrismaWorkflowStatus.ARCHIVED;
  }
}

export function fromPrismaWorkflowTemplate(template: PrismaWorkflowTemplate): WorkflowTemplate {
  switch (template) {
    case PrismaWorkflowTemplate.VENDOR_INVOICE_DOWNLOAD:
      return WorkflowTemplate.VendorInvoiceDownload;
    case PrismaWorkflowTemplate.SAAS_RENEWAL_CHECK:
      return WorkflowTemplate.SaasRenewalCheck;
    case PrismaWorkflowTemplate.PLAN_DOWNGRADE_REQUEST:
      return WorkflowTemplate.PlanDowngradeRequest;
  }
}

export function fromPrismaWorkflowStatus(status: PrismaWorkflowStatus): WorkflowStatus {
  switch (status) {
    case PrismaWorkflowStatus.ACTIVE:
      return WorkflowStatus.Active;
    case PrismaWorkflowStatus.PAUSED:
      return WorkflowStatus.Paused;
    case PrismaWorkflowStatus.ARCHIVED:
      return WorkflowStatus.Archived;
  }
}

export function fromPrismaWorkflowRunStatus(status: PrismaWorkflowRunStatus): WorkflowRunStatus {
  switch (status) {
    case PrismaWorkflowRunStatus.QUEUED:
      return WorkflowRunStatus.Queued;
    case PrismaWorkflowRunStatus.RUNNING:
      return WorkflowRunStatus.Running;
    case PrismaWorkflowRunStatus.WAITING_FOR_APPROVAL:
      return WorkflowRunStatus.WaitingForApproval;
    case PrismaWorkflowRunStatus.COMPLETED:
      return WorkflowRunStatus.Completed;
    case PrismaWorkflowRunStatus.FAILED:
      return WorkflowRunStatus.Failed;
    case PrismaWorkflowRunStatus.CANCELED:
      return WorkflowRunStatus.Canceled;
    case PrismaWorkflowRunStatus.DENIED:
      return WorkflowRunStatus.Denied;
  }
}
