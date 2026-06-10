import {
  ACTION_RISK_DEFAULTS,
  ActionType,
  AgentPolicySnapshot,
  AgentStatus,
  PolicyDecision,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
  RiskLevel,
  RiskSignal
} from '@agentpass/domain';

export type PolicyEngineStatus = {
  ready: true;
  mode: 'phase-11-policy-engine';
};

export type PolicyActionContext = {
  website: string;
  actionType: ActionType;
  amountCents?: number;
  text?: string;
  credentialUsed?: boolean;
  knownVendor?: boolean;
  firstRunForAgent?: boolean;
  submitButton?: boolean;
  downloadSensitiveFile?: boolean;
  policySnapshot: Pick<AgentPolicySnapshot, 'dangerKeywords' | 'allowedDomains'>;
};

export function getPolicyEngineStatus(): PolicyEngineStatus {
  return {
    ready: true,
    mode: 'phase-11-policy-engine'
  };
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const matchedRules: string[] = [];
  const riskLevel = scoreRisk(input);
  const host = hostname(input.website);

  if (input.agentStatus !== AgentStatus.Active) {
    matchedRules.push('agent.inactive');
    return deny(riskLevel, 'Agent is not active.', matchedRules);
  }

  if (matchesAnyDomain(host, input.policySnapshot.blockedDomains)) {
    matchedRules.push('domain.blocked');
    return deny(riskLevel, 'Website domain is blocked by policy.', matchedRules);
  }

  if (!matchesAnyDomain(host, input.policySnapshot.allowedDomains)) {
    matchedRules.push('domain.not_allowed');
    return deny(riskLevel, 'Website domain is not allowed by policy.', matchedRules);
  }

  if (input.policySnapshot.deniedActions.includes(input.actionType)) {
    matchedRules.push(`action.denied.${input.actionType}`);
    return deny(riskLevel, 'Action is explicitly denied by policy.', matchedRules);
  }

  if (input.amountCents !== undefined && input.amountCents >= input.policySnapshot.denyAboveCents) {
    matchedRules.push('amount.hard_limit');
    return deny(riskLevel, 'Amount is above the hard policy limit.', matchedRules);
  }

  if (input.policySnapshot.approvalRequiredActions.includes(input.actionType)) {
    matchedRules.push(`action.requires_approval.${input.actionType}`);
    return requireApproval(riskLevel, 'Action requires human approval by policy.', matchedRules);
  }

  if (
    input.amountCents !== undefined &&
    input.amountCents >= input.policySnapshot.approvalRequiredAboveCents
  ) {
    matchedRules.push('amount.requires_approval');
    return requireApproval(riskLevel, 'Amount is above the approval threshold.', matchedRules);
  }

  if (
    input.amountCents !== undefined &&
    input.policySnapshot.autoApproveBelowCents > 0 &&
    input.amountCents < input.policySnapshot.autoApproveBelowCents &&
    input.policySnapshot.allowedActions.includes(input.actionType)
  ) {
    matchedRules.push('amount.auto_approved');
    matchedRules.push(`action.allowed.${input.actionType}`);
    return {
      decision: PolicyDecision.Allow,
      riskLevel,
      reason: 'Amount is below the auto-approval threshold.',
      matchedRules
    };
  }

  if (riskLevel === RiskLevel.High || riskLevel === RiskLevel.Critical) {
    matchedRules.push(`risk.requires_approval.${riskLevel}`);
    return requireApproval(riskLevel, 'Risk level requires human approval.', matchedRules);
  }

  if (!input.policySnapshot.allowedActions.includes(input.actionType)) {
    matchedRules.push(`action.not_allowed.${input.actionType}`);
    return deny(riskLevel, 'Action is not allowed by policy.', matchedRules);
  }

  matchedRules.push(`action.allowed.${input.actionType}`);
  return {
    decision: PolicyDecision.Allow,
    riskLevel,
    reason: 'Policy allowed the action.',
    matchedRules
  };
}

export function scoreRisk(input: Pick<PolicyEvaluationInput, 'actionType' | 'riskSignals'>): RiskLevel {
  let risk = ACTION_RISK_DEFAULTS[input.actionType];

  for (const signal of input.riskSignals) {
    risk = maxRisk(risk, riskForSignal(signal));
  }

  return risk;
}

export function extractRiskSignals(actionContext: PolicyActionContext): RiskSignal[] {
  const signals = new Set<RiskSignal>();
  const host = hostname(actionContext.website);

  if (!matchesAnyDomain(host, actionContext.policySnapshot.allowedDomains)) {
    signals.add(RiskSignal.UnknownDomain);
  }

  if (actionContext.amountCents !== undefined && actionContext.amountCents > 0) {
    signals.add(RiskSignal.FinancialAmountPresent);
  }

  if (actionContext.credentialUsed) {
    signals.add(RiskSignal.CredentialUsed);
    if (!actionContext.knownVendor) {
      signals.add(RiskSignal.UnknownDomain);
      signals.add(RiskSignal.NewVendor);
    }
  }

  if (actionContext.firstRunForAgent) {
    signals.add(RiskSignal.FirstRunForAgent);
  }

  if (actionContext.submitButton || actionContext.actionType === ActionType.SubmitForm) {
    signals.add(RiskSignal.SubmitButton);
  }

  if (actionContext.downloadSensitiveFile) {
    signals.add(RiskSignal.DownloadSensitiveFile);
  }

  if (actionContext.actionType === ActionType.ChangePlan) {
    signals.add(RiskSignal.PlanChangeDetected);
  }

  if (actionContext.actionType === ActionType.CancelSubscription) {
    signals.add(RiskSignal.CancelDetected);
  }

  if (actionContext.actionType === ActionType.MakePurchase) {
    signals.add(RiskSignal.PaymentDetected);
  }

  const text = actionContext.text?.toLowerCase() ?? '';
  if (actionContext.policySnapshot.dangerKeywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
    signals.add(RiskSignal.DestructiveKeyword);
  }

  return [...signals].sort();
}

function deny(riskLevel: RiskLevel, reason: string, matchedRules: string[]): PolicyEvaluationResult {
  return {
    decision: PolicyDecision.Deny,
    riskLevel,
    reason,
    matchedRules
  };
}

function requireApproval(
  riskLevel: RiskLevel,
  reason: string,
  matchedRules: string[]
): PolicyEvaluationResult {
  return {
    decision: PolicyDecision.RequireApproval,
    riskLevel,
    reason,
    matchedRules
  };
}

function hostname(website: string): string {
  try {
    return new URL(website).hostname.toLowerCase();
  } catch {
    return website.toLowerCase();
  }
}

function matchesAnyDomain(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => {
    const normalized = domain.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function riskForSignal(signal: RiskSignal): RiskLevel {
  switch (signal) {
    case RiskSignal.DestructiveKeyword:
    case RiskSignal.PlanChangeDetected:
    case RiskSignal.CancelDetected:
    case RiskSignal.PaymentDetected:
      return RiskLevel.High;
    case RiskSignal.UnknownDomain:
    case RiskSignal.NewVendor:
    case RiskSignal.SubmitButton:
      return RiskLevel.High;
    case RiskSignal.CredentialUsed:
    case RiskSignal.FinancialAmountPresent:
    case RiskSignal.DownloadSensitiveFile:
    case RiskSignal.FirstRunForAgent:
      return RiskLevel.Medium;
  }
}

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order = [RiskLevel.Low, RiskLevel.Medium, RiskLevel.High, RiskLevel.Critical];
  return order.indexOf(right) > order.indexOf(left) ? right : left;
}
