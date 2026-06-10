import { ActionType, WorkflowRunStatus, WorkflowTemplate } from './enums.js';

export type WorkflowInputDefinition = {
  name: string;
  required: boolean;
  description: string;
};

export type WorkflowTemplateDefinition = {
  template: WorkflowTemplate;
  displayName: string;
  requiredInputs: readonly WorkflowInputDefinition[];
  expectedActions: readonly ActionType[];
  producesReceipt: boolean;
};

export const WORKFLOW_TEMPLATE_DEFINITIONS: Record<WorkflowTemplate, WorkflowTemplateDefinition> = {
  [WorkflowTemplate.VendorInvoiceDownload]: {
    template: WorkflowTemplate.VendorInvoiceDownload,
    displayName: 'Vendor invoice download',
    requiredInputs: [
      { name: 'vendorId', required: true, description: 'Vendor portal to use.' },
      { name: 'credentialId', required: true, description: 'Credential granted to the selected agent.' }
    ],
    expectedActions: [
      ActionType.OpenPage,
      ActionType.CredentialInjection,
      ActionType.ReadPage,
      ActionType.DownloadFile
    ],
    producesReceipt: true
  },
  [WorkflowTemplate.SaasRenewalCheck]: {
    template: WorkflowTemplate.SaasRenewalCheck,
    displayName: 'SaaS renewal check',
    requiredInputs: [
      { name: 'vendorId', required: true, description: 'Vendor whose renewal should be checked.' }
    ],
    expectedActions: [
      ActionType.OpenPage,
      ActionType.CredentialInjection,
      ActionType.ReadPage
    ],
    producesReceipt: true
  },
  [WorkflowTemplate.PlanDowngradeRequest]: {
    template: WorkflowTemplate.PlanDowngradeRequest,
    displayName: 'Plan downgrade request',
    requiredInputs: [
      { name: 'vendorId', required: true, description: 'Vendor whose plan should be changed.' },
      { name: 'targetPlan', required: true, description: 'Plan the agent will propose.' }
    ],
    expectedActions: [
      ActionType.OpenPage,
      ActionType.CredentialInjection,
      ActionType.ReadPage,
      ActionType.ChangePlan,
      ActionType.SubmitForm
    ],
    producesReceipt: true
  }
};

export const WORKFLOW_RUN_TRANSITIONS: Record<WorkflowRunStatus, readonly WorkflowRunStatus[]> = {
  [WorkflowRunStatus.Queued]: [WorkflowRunStatus.Running, WorkflowRunStatus.Canceled],
  [WorkflowRunStatus.Running]: [
    WorkflowRunStatus.WaitingForApproval,
    WorkflowRunStatus.Completed,
    WorkflowRunStatus.Failed,
    WorkflowRunStatus.Canceled
  ],
  [WorkflowRunStatus.WaitingForApproval]: [
    WorkflowRunStatus.Running,
    WorkflowRunStatus.Denied,
    WorkflowRunStatus.Failed,
    WorkflowRunStatus.Canceled
  ],
  [WorkflowRunStatus.Completed]: [],
  [WorkflowRunStatus.Failed]: [],
  [WorkflowRunStatus.Canceled]: [],
  [WorkflowRunStatus.Denied]: []
};

export function canTransitionWorkflowRun(from: WorkflowRunStatus, to: WorkflowRunStatus): boolean {
  return WORKFLOW_RUN_TRANSITIONS[from].includes(to);
}
