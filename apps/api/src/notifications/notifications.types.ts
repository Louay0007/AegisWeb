import { Prisma } from '@prisma/client';

export type EmailAddress = {
  name?: string | null;
  email: string;
};

export type EmailMessage = {
  from: string;
  to: EmailAddress[];
  subject: string;
  text: string;
  html: string;
};

export type EmailSendResult = {
  messageId: string;
  recipientCount: number;
};

export type ApprovalNotificationContext = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  summary: string;
  riskLevel: string;
  amountCents: number | null;
  expiresAt: Date | null;
  policyTriggeredJson: Prisma.JsonValue;
  requestedByAgent: {
    id: string;
    name: string;
    identifier: string;
  };
  workflowRun: {
    workflow: {
      id: string;
      name: string;
      template: string;
    };
    vendor: {
      id: string;
      name: string;
      website: string;
    } | null;
  };
  actionAttempt: {
    id: string;
    actionType: string;
    policyReason: string | null;
    inputSummary: string | null;
    amountCents: number | null;
  };
};

export type ApprovalNotificationResult = {
  channel: 'email';
  delivered: boolean;
  approvalRequestId: string;
  recipients: string[];
  subject?: string;
  messageId?: string;
  dashboardUrl?: string;
  warning?: string;
};
