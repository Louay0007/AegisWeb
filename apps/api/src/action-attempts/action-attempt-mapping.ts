import {
  ActionType as PrismaActionType,
  PolicyDecision as PrismaPolicyDecision,
  RiskLevel as PrismaRiskLevel
} from '@prisma/client';
import { ActionType, PolicyDecision, RiskLevel } from '@agentpass/domain';

export function toPrismaActionType(actionType: ActionType): PrismaActionType {
  switch (actionType) {
    case ActionType.OpenPage:
      return PrismaActionType.OPEN_PAGE;
    case ActionType.ReadPage:
      return PrismaActionType.READ_PAGE;
    case ActionType.FillForm:
      return PrismaActionType.FILL_FORM;
    case ActionType.ClickButton:
      return PrismaActionType.CLICK_BUTTON;
    case ActionType.DownloadFile:
      return PrismaActionType.DOWNLOAD_FILE;
    case ActionType.SubmitForm:
      return PrismaActionType.SUBMIT_FORM;
    case ActionType.ChangePlan:
      return PrismaActionType.CHANGE_PLAN;
    case ActionType.CancelSubscription:
      return PrismaActionType.CANCEL_SUBSCRIPTION;
    case ActionType.InviteUser:
      return PrismaActionType.INVITE_USER;
    case ActionType.ChangeBillingDetails:
      return PrismaActionType.CHANGE_BILLING_DETAILS;
    case ActionType.MakePurchase:
      return PrismaActionType.MAKE_PURCHASE;
    case ActionType.CredentialInjection:
      return PrismaActionType.CREDENTIAL_INJECTION;
  }
}

export function toPrismaRiskLevel(riskLevel: RiskLevel): PrismaRiskLevel {
  switch (riskLevel) {
    case RiskLevel.Low:
      return PrismaRiskLevel.LOW;
    case RiskLevel.Medium:
      return PrismaRiskLevel.MEDIUM;
    case RiskLevel.High:
      return PrismaRiskLevel.HIGH;
    case RiskLevel.Critical:
      return PrismaRiskLevel.CRITICAL;
  }
}

export function toPrismaPolicyDecision(decision: PolicyDecision): PrismaPolicyDecision {
  switch (decision) {
    case PolicyDecision.Allow:
      return PrismaPolicyDecision.ALLOW;
    case PolicyDecision.Deny:
      return PrismaPolicyDecision.DENY;
    case PolicyDecision.RequireApproval:
      return PrismaPolicyDecision.REQUIRE_APPROVAL;
    case PolicyDecision.RequireStepUpAuth:
      return PrismaPolicyDecision.REQUIRE_STEP_UP_AUTH;
    case PolicyDecision.PauseAgent:
      return PrismaPolicyDecision.PAUSE_AGENT;
  }
}

export function enumToDomain(value: string): string {
  return value.toLowerCase();
}
