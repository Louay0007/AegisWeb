import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { AuditHashService } from './audit-hash.service.js';
import { AuditRedactionService } from './audit-redaction.service.js';
import { RecordAuditEventInput, toAuditEventDto } from './audit.types.js';

@Injectable()
export class AuditService {
  private readonly organizationLocks = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditHashService) private readonly hashService: AuditHashService,
    @Inject(AuditRedactionService) private readonly redactionService: AuditRedactionService
  ) {}

  async record(input: RecordAuditEventInput) {
    return this.withOrganizationLock(input.organizationId, () => this.recordLocked(input));
  }

  private async recordLocked(input: RecordAuditEventInput) {
    this.assertKnownEnums(input);

    const redactedPayload = this.redactionService.redact(input.eventDataJson) as Prisma.InputJsonValue;
    const previous = await this.database.client.auditEvent.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const prevHash = previous?.eventHash ?? null;
    const eventHash = this.hashService.hash({
      organizationId: input.organizationId,
      workflowRunId: input.workflowRunId,
      agentId: input.agentId,
      actorType: input.actorType,
      actorId: input.actorId,
      eventType: input.eventType,
      eventDataJson: redactedPayload as Prisma.JsonValue,
      prevHash
    });

    const event = await this.database.client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        workflowRunId: input.workflowRunId,
        agentId: input.agentId,
        actorType: input.actorType,
        actorId: input.actorId,
        eventType: input.eventType,
        eventDataJson: redactedPayload,
        prevHash,
        eventHash
      }
    });

    return toAuditEventDto(event);
  }

  private async withOrganizationLock<T>(organizationId: string, handler: () => Promise<T>): Promise<T> {
    const previous = this.organizationLocks.get(organizationId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.organizationLocks.set(organizationId, previous.then(() => current, () => current));

    await previous.catch(() => undefined);
    try {
      return await handler();
    } finally {
      release();
      if (this.organizationLocks.get(organizationId) === current) {
        this.organizationLocks.delete(organizationId);
      }
    }
  }

  private assertKnownEnums(input: RecordAuditEventInput): void {
    if (!Object.values(AuditActorType).includes(input.actorType)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Audit actor type must be known.');
    }

    if (!Object.values(AuditEventType).includes(input.eventType)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Audit event type must be known.');
    }
  }
}
