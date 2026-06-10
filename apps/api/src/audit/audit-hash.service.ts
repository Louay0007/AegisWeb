import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma } from '@prisma/client';

export type AuditHashInput = {
  organizationId: string;
  workflowRunId?: string | null;
  agentId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  eventType: AuditEventType;
  eventDataJson: Prisma.JsonValue;
  prevHash?: string | null;
};

@Injectable()
export class AuditHashService {
  hash(input: AuditHashInput): string {
    return createHash('sha256')
      .update(
        stableStringify({
          organizationId: input.organizationId,
          workflowRunId: input.workflowRunId ?? null,
          agentId: input.agentId ?? null,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          eventDataJson: input.eventDataJson,
          prevHash: input.prevHash ?? null
        })
      )
      .digest('hex');
  }
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}
