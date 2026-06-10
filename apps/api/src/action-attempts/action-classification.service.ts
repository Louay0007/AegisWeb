import { Injectable } from '@nestjs/common';
import {
  ActionType,
  ACTION_RISK_DEFAULTS,
  DomainError,
  DomainErrorCode,
  PolicyDecision,
  RiskLevel,
  RiskSignal
} from '@agentpass/domain';
import { scoreRisk } from '@agentpass/policy-engine';

const POLICY_DECISION_REQUIRED_ACTIONS = new Set<ActionType>([
  ActionType.SubmitForm,
  ActionType.ChangePlan,
  ActionType.CancelSubscription,
  ActionType.MakePurchase,
  ActionType.InviteUser,
  ActionType.ChangeBillingDetails
]);

@Injectable()
export class ActionClassificationService {
  classify(input: {
    actionType: ActionType;
    riskSignals: RiskSignal[];
    riskLevel?: RiskLevel;
    policyDecision?: PolicyDecision;
  }): { riskLevel: RiskLevel; policyDecision: PolicyDecision } {
    if (this.requiresPolicyDecision(input.actionType) && !input.policyDecision) {
      throw new DomainError(
        DomainErrorCode.ValidationFailed,
        'Policy decision is required before recording risky actions.'
      );
    }

    const riskLevel =
      input.riskLevel ??
      (input.riskSignals.length > 0
        ? scoreRisk({ actionType: input.actionType, riskSignals: input.riskSignals })
        : ACTION_RISK_DEFAULTS[input.actionType]);

    return {
      riskLevel,
      policyDecision: input.policyDecision ?? PolicyDecision.Allow
    };
  }

  requiresPolicyDecision(actionType: ActionType): boolean {
    return POLICY_DECISION_REQUIRED_ACTIONS.has(actionType);
  }
}
