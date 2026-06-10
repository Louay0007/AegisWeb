import { Inject, Injectable } from "@nestjs/common";
import {
  AuditActorType,
  AuditEventType,
  FileKind,
  Prisma,
  WorkflowRun,
  WorkflowRunStatus,
} from "@prisma/client";
import { DomainError, DomainErrorCode } from "@agentpass/domain";
import { AuditService } from "../audit/audit.service.js";
import { DatabaseService } from "../database/database.service.js";
import { FilesService } from "../files/files.service.js";
import { FileDto } from "../files/files.types.js";
import { toWorkflowRunDto } from "../workflows/workflows.types.js";

export type WorkerScopedInput = {
  organizationId: string;
};

export type WorkerEventInput = WorkerScopedInput & {
  eventType: AuditEventType;
  eventDataJson?: Prisma.InputJsonObject;
};

export type WorkerUploadInput = WorkerScopedInput & {
  filename: string;
  mimeType: string;
  bufferBase64: string;
};

export type WorkerFileUploadInput = WorkerUploadInput & {
  kind: FileKind;
};

const MAX_WORKER_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_RUN_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_ORG_UPLOAD_BYTES = 1024 * 1024 * 1024;
const allowedMimeByKind: Partial<Record<FileKind, readonly string[]>> = {
  [FileKind.SCREENSHOT]: ["image/png", "image/jpeg", "image/webp"],
  [FileKind.INVOICE]: ["application/pdf", "image/png", "image/jpeg"],
  [FileKind.PLAYWRIGHT_TRACE]: ["application/zip", "application/octet-stream"],
  [FileKind.RECEIPT_EXPORT]: ["application/json"],
  [FileKind.DOWNLOAD]: [
    "application/pdf",
    "application/json",
    "text/csv",
    "text/plain",
    "image/png",
    "image/jpeg",
  ],
};

export type WorkerCompleteInput = WorkerScopedInput & {
  resultSummary?: string;
  currentStep?: string;
  stateJson?: Prisma.InputJsonObject;
};

export type WorkerFailInput = WorkerScopedInput & {
  errorMessage: string;
  currentStep?: string;
  stateJson?: Prisma.InputJsonObject;
};

@Injectable()
export class InternalWorkerService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  async recordEvent(runId: string, input: WorkerEventInput) {
    const run = await this.findRunForWorker(runId, input.organizationId);

    const event = await this.audit.record({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.WORKER,
      actorId: "internal-worker",
      eventType: input.eventType,
      eventDataJson: {
        workflowRunId: run.id,
        ...(input.eventDataJson ?? {}),
      },
    });

    return { data: event };
  }

  async uploadScreenshot(
    runId: string,
    input: WorkerUploadInput,
  ): Promise<{ data: FileDto }> {
    const run = await this.findRunForWorker(runId, input.organizationId);
    this.assertUploadWithinQuota(run.organizationId, run.id, estimatedBase64Bytes(input.bufferBase64));

    const file = await this.files.uploadBuffer({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      kind: FileKind.SCREENSHOT,
      filename: input.filename,
      mimeType: input.mimeType,
      buffer: decodeUpload(
        input.bufferBase64,
        input.mimeType,
        FileKind.SCREENSHOT,
      ),
    });

    return { data: file };
  }

  async uploadFile(
    runId: string,
    input: WorkerFileUploadInput,
  ): Promise<{ data: FileDto }> {
    const run = await this.findRunForWorker(runId, input.organizationId);
    this.assertUploadWithinQuota(run.organizationId, run.id, estimatedBase64Bytes(input.bufferBase64));

    const file = await this.files.uploadBuffer({
      organizationId: run.organizationId,
      workflowRunId: run.id,
      kind: input.kind,
      filename: input.filename,
      mimeType: input.mimeType,
      buffer: decodeUpload(input.bufferBase64, input.mimeType, input.kind),
    });

    return { data: file };
  }

  async completeRun(runId: string, input: WorkerCompleteInput) {
    const run = await this.findRunForWorker(runId, input.organizationId);
    if (run.status !== WorkflowRunStatus.RUNNING) {
      throw new DomainError(
        DomainErrorCode.WorkflowInvalidTransition,
        "Only running workflow runs can be completed.",
        {
          from: run.status,
          to: WorkflowRunStatus.COMPLETED,
        },
      );
    }

    const completedAt = new Date();
    const completed = await this.database.client.workflowRun.update({
      where: { id: run.id },
      data: {
        status: WorkflowRunStatus.COMPLETED,
        completedAt,
        currentStep: input.currentStep ?? "completed",
        resultSummary: input.resultSummary,
        stateJson: this.nextWorkerState(run.stateJson, {
          ...(input.stateJson ?? {}),
          from: run.status,
          to: WorkflowRunStatus.COMPLETED,
          at: completedAt.toISOString(),
        }),
      },
    });

    await this.audit.record({
      organizationId: completed.organizationId,
      workflowRunId: completed.id,
      agentId: completed.agentId,
      actorType: AuditActorType.WORKER,
      actorId: "internal-worker",
      eventType: AuditEventType.WORKFLOW_RUN_COMPLETED,
      eventDataJson: {
        workflowRunId: completed.id,
        workflowId: completed.workflowId,
        resultSummary: completed.resultSummary,
      },
    });

    return { data: toWorkflowRunDto(completed) };
  }

  async failRun(runId: string, input: WorkerFailInput) {
    const run = await this.findRunForWorker(runId, input.organizationId);
    if (isTerminal(run.status)) {
      throw new DomainError(
        DomainErrorCode.WorkflowInvalidTransition,
        "Terminal workflow runs cannot be failed again.",
        {
          from: run.status,
          to: WorkflowRunStatus.FAILED,
        },
      );
    }

    const failedAt = new Date();
    const failed = await this.database.client.workflowRun.update({
      where: { id: run.id },
      data: {
        status: WorkflowRunStatus.FAILED,
        completedAt: run.completedAt ?? failedAt,
        currentStep: input.currentStep ?? "failed",
        errorMessage: input.errorMessage,
        stateJson: this.nextWorkerState(run.stateJson, {
          ...(input.stateJson ?? {}),
          from: run.status,
          to: WorkflowRunStatus.FAILED,
          errorMessage: input.errorMessage,
          at: failedAt.toISOString(),
        }),
      },
    });

    await this.audit.record({
      organizationId: failed.organizationId,
      workflowRunId: failed.id,
      agentId: failed.agentId,
      actorType: AuditActorType.WORKER,
      actorId: "internal-worker",
      eventType: AuditEventType.WORKFLOW_RUN_FAILED,
      eventDataJson: {
        workflowRunId: failed.id,
        workflowId: failed.workflowId,
        errorMessage: input.errorMessage,
      },
    });

    return { data: toWorkflowRunDto(failed) };
  }

  async findRunForWorker(
    runId: string,
    organizationId: string,
  ): Promise<WorkflowRun> {
    const run = await this.database.client.workflowRun.findFirst({
      where: {
        id: runId,
        organizationId,
      },
    });

    if (!run) {
      throw new DomainError(
        DomainErrorCode.OrganizationIsolationViolation,
        "Workflow run belongs to another organization.",
      );
    }

    return run;
  }

  private nextWorkerState(
    existing: Prisma.JsonValue,
    entry: Prisma.InputJsonObject,
  ): Prisma.InputJsonObject {
    const base =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? (existing as Prisma.JsonObject)
        : {};
    const workerTransitions = Array.isArray(base.workerTransitions)
      ? base.workerTransitions
      : [];

    return {
      ...base,
      workerTransitions: [...workerTransitions, entry],
    };
  }

  private async assertUploadWithinQuota(
    organizationId: string,
    workflowRunId: string,
    nextBytes: number,
  ): Promise<void> {
    const [runUsage, orgUsage] = await Promise.all([
      this.database.client.file.aggregate({
        where: { organizationId, workflowRunId },
        _sum: { sizeBytes: true },
      }),
      this.database.client.file.aggregate({
        where: { organizationId },
        _sum: { sizeBytes: true },
      }),
    ]);

    if ((runUsage._sum.sizeBytes ?? 0) + nextBytes > MAX_RUN_UPLOAD_BYTES) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow run file quota exceeded.');
    }

    if ((orgUsage._sum.sizeBytes ?? 0) + nextBytes > MAX_ORG_UPLOAD_BYTES) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Organization file quota exceeded.');
    }
  }
}

function decodeUpload(value: string, mimeType: string, kind: FileKind): Buffer {
  assertAllowedMime(kind, mimeType);
  if (estimatedBase64Bytes(value) > MAX_WORKER_UPLOAD_BYTES) {
    throw new DomainError(
      DomainErrorCode.ValidationFailed,
      "Worker upload is too large.",
    );
  }
  const buffer = Buffer.from(value, "base64");
  if (buffer.length > MAX_WORKER_UPLOAD_BYTES) {
    throw new DomainError(
      DomainErrorCode.ValidationFailed,
      "Worker upload is too large.",
    );
  }
  return buffer;
}

function estimatedBase64Bytes(value: string): number {
  return Math.floor((value.length * 3) / 4);
}

function assertAllowedMime(kind: FileKind, mimeType: string): void {
  const allowed = allowedMimeByKind[kind];
  if (!allowed?.includes(mimeType.toLowerCase())) {
    throw new DomainError(
      DomainErrorCode.ValidationFailed,
      "File MIME type is not allowed for this file kind.",
      {
        kind,
        mimeType,
      },
    );
  }
}

function isTerminal(status: WorkflowRunStatus): boolean {
  const terminalStatuses: WorkflowRunStatus[] = [
    WorkflowRunStatus.COMPLETED,
    WorkflowRunStatus.FAILED,
    WorkflowRunStatus.CANCELED,
    WorkflowRunStatus.DENIED,
  ];

  return terminalStatuses.includes(status);
}
