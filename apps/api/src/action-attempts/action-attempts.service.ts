import { Inject, Injectable } from '@nestjs/common';
import { ActionAttempt, Prisma } from '@prisma/client';
import { ActionType, DomainError, DomainErrorCode, PolicyDecision, RiskLevel } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import {
  toPrismaActionType,
  toPrismaPolicyDecision,
  toPrismaRiskLevel
} from './action-attempt-mapping.js';
import { toActionAttemptDto } from './action-attempts.types.js';
import { ActionClassificationService } from './action-classification.service.js';
import { RiskSignalService } from './risk-signal.service.js';

export type CreateActionAttemptInput = {
  website: string;
  actionType: ActionType;
  riskLevel?: RiskLevel;
  riskSignals?: unknown;
  policyDecision?: PolicyDecision;
  policyReason?: string;
  inputSummary?: string;
  outputSummary?: string;
  amountCents?: number;
  metadataJson?: Prisma.InputJsonObject;
};

export type CompleteActionAttemptInput = {
  workflowRunId?: string;
  outputSummary?: string;
  metadataJson?: Prisma.InputJsonObject;
};

export type FailActionAttemptInput = {
  workflowRunId?: string;
  errorSummary: string;
  metadataJson?: Prisma.InputJsonObject;
};

@Injectable()
export class ActionAttemptsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ActionClassificationService) private readonly classification: ActionClassificationService,
    @Inject(RiskSignalService) private readonly riskSignals: RiskSignalService
  ) {}

  async listForRun(organizationId: string | undefined, runId: string) {
    await this.findRunInOrganization(organizationId, runId);

    const attempts = await this.database.client.actionAttempt.findMany({
      where: {
        workflowRunId: runId,
        organizationId
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    return { data: attempts.map(toActionAttemptDto) };
  }

  async createForRun(runId: string, input: CreateActionAttemptInput) {
    const run = await this.database.client.workflowRun.findUnique({
      where: { id: runId }
    });

    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    const riskSignals = this.riskSignals.normalize(input.riskSignals);
    const classification = this.classification.classify({
      actionType: input.actionType,
      riskSignals,
      riskLevel: input.riskLevel,
      policyDecision: input.policyDecision
    });

    const attempt = await this.database.client.actionAttempt.create({
      data: {
        organizationId: run.organizationId,
        workflowRunId: run.id,
        agentId: run.agentId,
        vendorId: run.vendorId,
        website: input.website,
        actionType: toPrismaActionType(input.actionType),
        riskLevel: toPrismaRiskLevel(classification.riskLevel),
        policyDecision: toPrismaPolicyDecision(classification.policyDecision),
        policyReason: input.policyReason,
        inputSummary: input.inputSummary,
        outputSummary: input.outputSummary,
        amountCents: input.amountCents,
        metadataJson: {
          ...(input.metadataJson ?? {}),
          riskSignals,
          policyDecisionRecordedAt: new Date().toISOString()
        }
      }
    });

    return { data: toActionAttemptDto(attempt) };
  }

  async complete(id: string, input: CompleteActionAttemptInput) {
    const attempt = await this.findAttempt(id);
    this.assertAttemptScope(attempt, input.workflowRunId);
    this.assertNotCompleted(attempt);

    const completed = await this.database.client.actionAttempt.update({
      where: { id: attempt.id },
      data: {
        completedAt: new Date(),
        outputSummary: input.outputSummary ?? attempt.outputSummary,
        metadataJson: this.mergeMetadata(attempt.metadataJson, input.metadataJson, {
          outcome: 'completed'
        })
      }
    });

    return { data: toActionAttemptDto(completed) };
  }

  async fail(id: string, input: FailActionAttemptInput) {
    const attempt = await this.findAttempt(id);
    this.assertAttemptScope(attempt, input.workflowRunId);
    this.assertNotCompleted(attempt);

    const failed = await this.database.client.actionAttempt.update({
      where: { id: attempt.id },
      data: {
        completedAt: new Date(),
        outputSummary: input.errorSummary,
        metadataJson: this.mergeMetadata(attempt.metadataJson, input.metadataJson, {
          outcome: 'failed',
          errorSummary: input.errorSummary
        })
      }
    });

    return { data: toActionAttemptDto(failed) };
  }

  private async findRunInOrganization(organizationId: string | undefined, runId: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const run = await this.database.client.workflowRun.findFirst({
      where: {
        id: runId,
        organizationId
      },
      select: { id: true }
    });

    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    return run;
  }

  private async findAttempt(id: string): Promise<ActionAttempt> {
    const attempt = await this.database.client.actionAttempt.findUnique({
      where: { id }
    });

    if (!attempt) {
      throw new DomainError(DomainErrorCode.NotFound, 'Action attempt was not found.');
    }

    return attempt;
  }

  private assertNotCompleted(attempt: ActionAttempt): void {
    if (attempt.completedAt) {
      throw new DomainError(DomainErrorCode.WorkflowInvalidTransition, 'Action attempt is already completed.');
    }
  }

  private assertAttemptScope(attempt: ActionAttempt, workflowRunId: string | undefined): void {
    if (workflowRunId && attempt.workflowRunId !== workflowRunId) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Action attempt belongs to another workflow run.');
    }
  }

  private mergeMetadata(
    existing: Prisma.JsonValue,
    next: Prisma.InputJsonObject | undefined,
    patch: Prisma.InputJsonObject
  ): Prisma.InputJsonObject {
    const existingObject =
      existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Prisma.JsonObject) : {};

    return {
      ...existingObject,
      ...(next ?? {}),
      ...patch
    };
  }
}
