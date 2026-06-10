import { Inject, Injectable } from '@nestjs/common';
import {
  ActionType as PrismaActionType,
  PolicyDecision as PrismaPolicyDecision,
  Prisma,
  RiskLevel as PrismaRiskLevel
} from '@prisma/client';
import { ActionType, DomainError, DomainErrorCode, PolicyDecision, RiskLevel } from '@agentpass/domain';
import { WorkerDatabaseService } from '../database/worker-database.service.js';

export type ConnectorActionAttemptInput = {
  workflowRunId: string;
  website: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  policyDecision: PolicyDecision;
  policyReason?: string;
  inputSummary?: string;
  amountCents?: number;
  metadataJson?: Prisma.InputJsonObject;
};

@Injectable()
export class ConnectorActionAttemptService {
  constructor(@Inject(WorkerDatabaseService) private readonly database: WorkerDatabaseService) {}

  async record(input: ConnectorActionAttemptInput): Promise<{ id: string }> {
    const run = await this.database.client.workflowRun.findUnique({
      where: { id: input.workflowRunId }
    });
    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    const attempt = await this.database.client.actionAttempt.create({
      data: {
        organizationId: run.organizationId,
        workflowRunId: run.id,
        agentId: run.agentId,
        vendorId: run.vendorId,
        website: input.website,
        actionType: toPrismaActionType(input.actionType),
        riskLevel: toPrismaRiskLevel(input.riskLevel),
        policyDecision: toPrismaPolicyDecision(input.policyDecision),
        policyReason: input.policyReason,
        inputSummary: input.inputSummary,
        amountCents: input.amountCents,
        metadataJson: input.metadataJson ?? {}
      },
      select: { id: true }
    });

    return attempt;
  }

  async complete(id: string, outputSummary: string, metadataJson: Prisma.InputJsonObject = {}): Promise<void> {
    const attempt = await this.database.client.actionAttempt.findUnique({ where: { id } });
    if (!attempt) {
      throw new DomainError(DomainErrorCode.NotFound, 'Action attempt was not found.');
    }

    const existing =
      attempt.metadataJson && typeof attempt.metadataJson === 'object' && !Array.isArray(attempt.metadataJson)
        ? (attempt.metadataJson as Prisma.JsonObject)
        : {};

    await this.database.client.actionAttempt.update({
      where: { id },
      data: {
        completedAt: new Date(),
        outputSummary,
        metadataJson: {
          ...existing,
          ...metadataJson,
          outcome: 'completed'
        }
      }
    });
  }
}

function toPrismaActionType(actionType: ActionType): PrismaActionType {
  return {
    [ActionType.OpenPage]: PrismaActionType.OPEN_PAGE,
    [ActionType.ReadPage]: PrismaActionType.READ_PAGE,
    [ActionType.FillForm]: PrismaActionType.FILL_FORM,
    [ActionType.ClickButton]: PrismaActionType.CLICK_BUTTON,
    [ActionType.DownloadFile]: PrismaActionType.DOWNLOAD_FILE,
    [ActionType.SubmitForm]: PrismaActionType.SUBMIT_FORM,
    [ActionType.ChangePlan]: PrismaActionType.CHANGE_PLAN,
    [ActionType.CancelSubscription]: PrismaActionType.CANCEL_SUBSCRIPTION,
    [ActionType.InviteUser]: PrismaActionType.INVITE_USER,
    [ActionType.ChangeBillingDetails]: PrismaActionType.CHANGE_BILLING_DETAILS,
    [ActionType.MakePurchase]: PrismaActionType.MAKE_PURCHASE,
    [ActionType.CredentialInjection]: PrismaActionType.CREDENTIAL_INJECTION
  }[actionType];
}

function toPrismaRiskLevel(riskLevel: RiskLevel): PrismaRiskLevel {
  return {
    [RiskLevel.Low]: PrismaRiskLevel.LOW,
    [RiskLevel.Medium]: PrismaRiskLevel.MEDIUM,
    [RiskLevel.High]: PrismaRiskLevel.HIGH,
    [RiskLevel.Critical]: PrismaRiskLevel.CRITICAL
  }[riskLevel];
}

function toPrismaPolicyDecision(policyDecision: PolicyDecision): PrismaPolicyDecision {
  switch (policyDecision) {
    case PolicyDecision.Allow:
      return PrismaPolicyDecision.ALLOW;
    case PolicyDecision.RequireApproval:
      return PrismaPolicyDecision.REQUIRE_APPROVAL;
    case PolicyDecision.Deny:
      return PrismaPolicyDecision.DENY;
    case PolicyDecision.RequireStepUpAuth:
    case PolicyDecision.PauseAgent:
      throw new DomainError(DomainErrorCode.ValidationFailed, `Unsupported connector policy decision ${policyDecision}.`);
  }
}
