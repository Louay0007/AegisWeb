import { ActionType, PolicyDecision, RiskLevel } from '@agentpass/domain';
import { ControlledBrowserContext, DownloadCapture } from '@agentpass/browser-runtime';

export type VendorCredentials = {
  username: string;
  password: string;
};

export type ConnectorExecutionContext = {
  workflowRunId: string;
  organizationId: string;
  agentId: string;
  vendorId: string | null;
  baseUrl: string;
  browser: ControlledBrowserContext;
  credentials: VendorCredentials;
  approvalToken?: string;
};

export type FileResult = DownloadCapture & {
  kind: 'invoice';
};

export type RenewalInfo = {
  vendorName: string;
  currentPlan: string;
  currentMonthlyPriceCents: number;
  renewalMonthlyPriceCents: number;
  renewalDate: string;
  seatCount: number;
  unusedSeats: number;
  estimatedMonthlySavingsCents: number;
  recommendation: string;
};

export type ProposedAction = {
  actionType: ActionType;
  policyDecision: PolicyDecision;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  actionAttemptId: string;
  summary: string;
  amountCents: number;
  metadata: Record<string, unknown>;
};

export type ActionResult = {
  actionType: ActionType;
  actionAttemptId: string;
  status: 'submitted';
  summary: string;
  metadata: Record<string, unknown>;
};

export interface VendorConnector {
  login(context: ConnectorExecutionContext): Promise<void>;
  downloadLatestInvoice(context: ConnectorExecutionContext): Promise<FileResult>;
  readRenewalInfo(context: ConnectorExecutionContext): Promise<RenewalInfo>;
  prepareDowngrade(context: ConnectorExecutionContext): Promise<ProposedAction>;
  submitDowngrade(context: ConnectorExecutionContext): Promise<ActionResult>;
}
