import { Injectable } from '@nestjs/common';
import { ActionType, PolicyDecision, RiskLevel } from '@agentpass/domain';

export type WorkerPolicyInput = {
  actionType: ActionType;
  website: string;
  approvalToken?: string;
  amountCents?: number;
};

export type WorkerPolicyResult = {
  decision: PolicyDecision;
  riskLevel: RiskLevel;
  reason: string;
};

const riskyActions = new Set<ActionType>([
  ActionType.SubmitForm,
  ActionType.ChangePlan,
  ActionType.CancelSubscription,
  ActionType.MakePurchase
]);

const deniedActions = new Set<ActionType>([
  ActionType.InviteUser,
  ActionType.ChangeBillingDetails
]);

@Injectable()
export class WorkerPolicyClient {
  async evaluateAction(input: WorkerPolicyInput): Promise<WorkerPolicyResult> {
    if (deniedActions.has(input.actionType)) {
      return {
        decision: PolicyDecision.Deny,
        riskLevel: RiskLevel.Critical,
        reason: `Sandbox policy denies ${input.actionType}.`
      };
    }

    if (riskyActions.has(input.actionType) && !input.approvalToken) {
      return {
        decision: PolicyDecision.RequireApproval,
        riskLevel: input.actionType === ActionType.CancelSubscription ? RiskLevel.Critical : RiskLevel.High,
        reason: `Sandbox policy requires approval for ${input.actionType}.`
      };
    }

    return {
      decision: PolicyDecision.Allow,
      riskLevel: input.actionType === ActionType.CredentialInjection ? RiskLevel.Medium : RiskLevel.Low,
      reason: `Sandbox policy allows ${input.actionType}.`
    };
  }
}
