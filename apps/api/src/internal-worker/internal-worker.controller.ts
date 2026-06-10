import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuditEventType, FileKind, Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { InternalRoute } from '../authorization/authorization-metadata.js';
import { InternalWorkerGuard } from '../authorization/internal-worker.guard.js';
import { InternalWorkerService } from './internal-worker.service.js';

const scopedSchema = z.object({
  organizationId: z.string().uuid()
});

const eventSchema = scopedSchema.extend({
  eventType: z.nativeEnum(AuditEventType),
  eventDataJson: z.record(z.unknown()).optional()
});

const uploadSchema = scopedSchema.extend({
  filename: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120),
  bufferBase64: z.string().min(1).max(14 * 1024 * 1024)
});

const fileUploadSchema = uploadSchema.extend({
  kind: z.nativeEnum(FileKind)
});

const completeSchema = scopedSchema.extend({
  resultSummary: z.string().min(1).max(1000).optional(),
  currentStep: z.string().min(1).max(200).optional(),
  stateJson: z.record(z.unknown()).optional()
});

const failSchema = scopedSchema.extend({
  errorMessage: z.string().min(1).max(1000),
  currentStep: z.string().min(1).max(200).optional(),
  stateJson: z.record(z.unknown()).optional()
});

@Controller('internal/workers/runs')
export class InternalWorkerController {
  constructor(@Inject(InternalWorkerService) private readonly internalWorker: InternalWorkerService) {}

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/events')
  recordEvent(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid worker event request.');
    }

    return this.internalWorker.recordEvent(runId, {
      ...parsed.data,
      eventDataJson: parsed.data.eventDataJson as Prisma.InputJsonObject | undefined
    });
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/screenshots')
  uploadScreenshot(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid worker screenshot upload request.');
    }

    return this.internalWorker.uploadScreenshot(runId, parsed.data);
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/files')
  uploadFile(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = fileUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid worker file upload request.');
    }

    return this.internalWorker.uploadFile(runId, parsed.data);
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/complete')
  complete(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid worker complete request.');
    }

    return this.internalWorker.completeRun(runId, {
      ...parsed.data,
      stateJson: parsed.data.stateJson as Prisma.InputJsonObject | undefined
    });
  }

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':runId/fail')
  fail(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = failSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid worker fail request.');
    }

    return this.internalWorker.failRun(runId, {
      ...parsed.data,
      stateJson: parsed.data.stateJson as Prisma.InputJsonObject | undefined
    });
  }
}
