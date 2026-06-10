import { ActionType, AgentStatus, PolicyDecision, RiskLevel } from './enums.js';
import { AgentId, OrganizationId } from './ids.js';

export const RiskSignal = {
  UnknownDomain: 'unknown_domain',
  DestructiveKeyword: 'destructive_keyword',
  FinancialAmountPresent: 'financial_amount_present',
  CredentialUsed: 'credential_used',
  NewVendor: 'new_vendor',
  FirstRunForAgent: 'first_run_for_agent',
  SubmitButton: 'submit_button',
  DownloadSensitiveFile: 'download_sensitive_file',
  PlanChangeDetected: 'plan_change_detected',
  CancelDetected: 'cancel_detected',
  PaymentDetected: 'payment_detected'
} as const;

export type RiskSignal = (typeof RiskSignal)[keyof typeof RiskSignal];
export const RISK_SIGNALS = Object.values(RiskSignal);

export type BusinessHoursPolicy = {
  enabled: boolean;
  timezone?: string;
  weekdays?: number[];
  startHour?: number;
  endHour?: number;
};

export type AgentPolicySnapshot = {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedActions: ActionType[];
  deniedActions: ActionType[];
  approvalRequiredActions: ActionType[];
  autoApproveBelowCents: number;
  approvalRequiredAboveCents: number;
  denyAboveCents: number;
  dangerKeywords: string[];
  businessHours: BusinessHoursPolicy;
};

export type PolicyEvaluationInput = {
  organizationId: OrganizationId | string;
  agentId: AgentId | string;
  agentStatus: AgentStatus;
  website: string;
  actionType: ActionType;
  amountCents?: number;
  riskSignals: RiskSignal[];
  policySnapshot: AgentPolicySnapshot;
  now: string;
};

export type PolicyEvaluationResult = {
  decision: PolicyDecision;
  riskLevel: RiskLevel;
  reason: string;
  matchedRules: string[];
};

export const ACTION_RISK_DEFAULTS: Record<ActionType, RiskLevel> = {
  [ActionType.OpenPage]: RiskLevel.Low,
  [ActionType.ReadPage]: RiskLevel.Low,
  [ActionType.FillForm]: RiskLevel.Medium,
  [ActionType.ClickButton]: RiskLevel.Medium,
  [ActionType.DownloadFile]: RiskLevel.Low,
  [ActionType.SubmitForm]: RiskLevel.High,
  [ActionType.ChangePlan]: RiskLevel.High,
  [ActionType.CancelSubscription]: RiskLevel.Critical,
  [ActionType.InviteUser]: RiskLevel.Critical,
  [ActionType.ChangeBillingDetails]: RiskLevel.Critical,
  [ActionType.MakePurchase]: RiskLevel.High,
  [ActionType.CredentialInjection]: RiskLevel.Medium
};

export const DEFAULT_AGENT_POLICY: AgentPolicySnapshot = {
  allowedDomains: [],
  blockedDomains: [],
  allowedActions: [ActionType.OpenPage, ActionType.ReadPage],
  deniedActions: [ActionType.InviteUser, ActionType.ChangeBillingDetails],
  approvalRequiredActions: [
    ActionType.SubmitForm,
    ActionType.ChangePlan,
    ActionType.CancelSubscription,
    ActionType.MakePurchase
  ],
  autoApproveBelowCents: 0,
  approvalRequiredAboveCents: 0,
  denyAboveCents: 1,
  dangerKeywords: ['delete', 'cancel', 'confirm', 'wire', 'bank', 'admin', 'owner'],
  businessHours: { enabled: false }
};
