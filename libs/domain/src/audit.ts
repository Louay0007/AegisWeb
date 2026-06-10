import { AuditActorType, AuditEventType } from './enums.js';
import { AgentId, AuditEventId, OrganizationId, WorkflowRunId } from './ids.js';

export type AuditEventPayload = Record<string, unknown>;

export type AuditEventRecord = {
  id: AuditEventId | string;
  organizationId: OrganizationId | string;
  workflowRunId?: WorkflowRunId | string;
  agentId?: AgentId | string;
  actorType: AuditActorType;
  actorId?: string;
  eventType: AuditEventType;
  eventDataJson: AuditEventPayload;
  prevHash?: string;
  eventHash: string;
  createdAt: string;
};

export const SECRET_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
  /encrypted/i,
  /ciphertext/i,
  /auth_tag/i,
  /username/i,
  /responseText/i
] as const;

export function isSecretFieldName(fieldName: string): boolean {
  return SECRET_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}
