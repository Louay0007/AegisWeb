import { AuditActorType, AuditEvent, AuditEventType, Prisma } from '@prisma/client';

export type RecordAuditEventInput = {
  organizationId: string;
  workflowRunId?: string;
  agentId?: string;
  actorType: AuditActorType;
  actorId?: string;
  eventType: AuditEventType;
  eventDataJson: Prisma.InputJsonValue;
};

export type AuditEventDto = {
  id: string;
  organizationId: string;
  workflowRunId: string | null;
  agentId: string | null;
  actorType: string;
  actorId: string | null;
  eventType: string;
  eventDataJson: Prisma.JsonValue;
  prevHash: string | null;
  eventHash: string;
  createdAt: string;
};

export type AuditEventListQuery = {
  workflowRunId?: string;
  actorType?: AuditActorType;
  actorId?: string;
  eventType?: AuditEventType;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

export function toAuditEventDto(event: AuditEvent): AuditEventDto {
  return {
    id: event.id,
    organizationId: event.organizationId,
    workflowRunId: event.workflowRunId,
    agentId: event.agentId,
    actorType: event.actorType,
    actorId: event.actorId,
    eventType: event.eventType,
    eventDataJson: event.eventDataJson,
    prevHash: event.prevHash,
    eventHash: event.eventHash,
    createdAt: event.createdAt.toISOString()
  };
}
