import type {
  AgentFixture,
  ApprovalFixture,
  AuditEventFixture,
  CredentialFixture,
  PolicyDecision,
  PolicyFixture,
  ReceiptFixture,
  RiskLevel,
  StatusKind,
  VendorFixture,
  WorkflowFixture,
  WorkflowRunFixture,
} from "@/lib/fixtures/dashboard";
import type { EvidenceFile } from "@/lib/evidence-types";

export type AgentDto = {
  id: string;
  organizationId: string;
  name: string;
  identifier: string;
  purpose: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type VendorDto = {
  id: string;
  organizationId: string;
  name: string;
  website: string;
  category: string;
  renewalDate: string | null;
  monthlyCostCents: number | null;
  ownerUserId: string | null;
  metadataJson: Record<string, unknown> | unknown;
  riskProfile?: { level: string; reasons: string[] };
};

export type CredentialDto = {
  id: string;
  organizationId: string;
  vendorId: string;
  label: string;
  credentialType: string;
  status: string;
  lastUsedAt: string | null;
  createdByUserId: string;
  grants?: Array<{ id: string; agentId: string; scope?: string; revokedAt: string | null }>;
};

export type PolicyDto = {
  id: string;
  organizationId: string;
  agentId: string | null;
  name: string;
  type: string;
  version: number;
  status: string;
  rulesJson: Record<string, unknown> | unknown;
  updatedAt: string;
};

export type WorkflowDto = {
  id: string;
  organizationId: string;
  agentId: string;
  vendorId: string;
  name: string;
  template: string;
  status: string;
  updatedAt: string;
  configurationJson: Record<string, unknown> | unknown;
};

export type WorkflowRunSummaryDto = {
  id: string;
  workflowId: string;
  agentId: string;
  vendorId: string | null;
  status: string;
  startedAt: string | null;
  currentStep: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  workflow?: { id: string; name: string; template: string };
  agent?: { id: string; name: string; identifier: string };
  vendor?: { id: string; name: string; website: string } | null;
  files?: Array<{ id: string; kind: string; mimeType?: string; sizeBytes?: number; sha256: string; createdAt?: string }>;
  actionAttempts?: Array<{
    id?: string;
    website?: string;
    actionType?: string;
    riskLevel: string;
    policyDecision: string;
    policyReason: string | null;
    inputSummary: string | null;
    outputSummary?: string | null;
    amountCents: number | null;
    createdAt?: string;
    completedAt?: string | null;
  }>;
  approvalRequests?: Array<{
    id: string;
    status: string;
    summary: string;
    riskLevel: string;
    amountCents: number | null;
    expiresAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    createdAt?: string;
  }>;
  receipt?: { id: string; finalStatus: string; summary: string; createdAt: string } | null;
};

export type WorkflowRunDetailDto = WorkflowRunSummaryDto;

export type ApprovalRequestDto = {
  id: string;
  workflowRunId: string;
  status: string;
  requestedByAgentId: string;
  summary: string;
  riskLevel: string;
  amountCents: number | null;
  expiresAt: string | null;
  createdAt: string;
  policyTriggeredJson: unknown;
};

export type ReceiptListDto = {
  id: string;
  organizationId?: string;
  workflowRunId: string;
  agentId: string;
  finalStatus: string;
  summary: string;
  agent?: { id: string; name: string; identifier: string };
  workflowRun?: { id: string; status: string; currentStep: string | null; vendor?: { id: string; name: string; website: string } | null };
  createdAt: string;
};

export type ReceiptDetailDto = ReceiptListDto & {
  workflow?: { id: string; name: string; template: string };
  vendor?: { id: string; name: string; website: string } | null;
  timeline?: unknown;
  screenshots?: unknown;
  files?: unknown;
  policyDecisions?: unknown;
  approvalDetails?: unknown;
};

export type AuditEventDto = {
  id: string;
  workflowRunId: string | null;
  agentId: string | null;
  actorType: string;
  actorId: string | null;
  eventType: string;
  eventDataJson: Record<string, unknown> | unknown;
  prevHash: string | null;
  eventHash: string;
  createdAt: string;
};

export type OrganizationDto = {
  id: string;
  name: string;
  domain: string;
  plan: string;
};

export type UserDto = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export function mapAgent(dto: AgentDto): AgentFixture {
  return {
    id: dto.id,
    name: dto.name,
    identifier: dto.identifier,
    status: toStatus(dto.status),
    purpose: dto.purpose,
    policy: "Policy bundle",
    recentRuns: 0,
    lastActivity: relativeTime(dto.updatedAt),
    credentialGrants: [],
  };
}

export function mapVendor(dto: VendorDto): VendorFixture {
  const monthly = centsToDollars(dto.monthlyCostCents);
  return {
    id: dto.id,
    name: dto.name,
    website: dto.website,
    category: dto.category,
    renewalDate: dto.renewalDate ?? "Not set",
    monthlyCost: monthly,
    renewalCost: monthly * 12,
    unusedSeats: readNumber(dto, "unusedSeats", 0),
    risk: toRisk(dto.riskProfile?.level),
    owner: dto.ownerUserId ?? "Workspace",
  } as VendorFixture & { ownerUserId?: string };
}

export function mapCredential(dto: CredentialDto, vendors: VendorFixture[], agents: AgentFixture[]): CredentialFixture {
  const vendor = vendors.find((item) => item.id === dto.vendorId);
  const activeGrants = (dto.grants ?? []).filter((grant) => !grant.revokedAt);
  return {
    id: dto.id,
    vendorId: dto.vendorId,
    label: dto.label,
    vendor: vendor?.name ?? dto.vendorId,
    type: dto.credentialType,
    status: toStatus(dto.status),
    grantedAgents: activeGrants.map((grant) => agents.find((agent) => agent.id === grant.agentId)?.name ?? grant.agentId),
    grantedAgentDetails: activeGrants.map((grant) => {
      const agent = agents.find((item) => item.id === grant.agentId);
      return {
        grantId: grant.id,
        agentId: grant.agentId,
        agentName: agent?.name ?? grant.agentId,
        scope: grant.scope ?? "login",
      };
    }),
    lastUsed: dto.lastUsedAt ? relativeTime(dto.lastUsedAt) : "Never",
    createdBy: dto.createdByUserId,
  };
}

export function mapPolicy(dto: PolicyDto, agents: AgentFixture[]): PolicyFixture {
  const rules = asRecord(dto.rulesJson);
  const agent = agents.find((item) => item.id === dto.agentId);
  return {
    id: dto.id,
    agentId: dto.agentId,
    type: dto.type,
    name: dto.name,
    agent: agent?.name ?? "Workspace",
    version: `v${dto.version}`,
    status: toStatus(dto.status),
    allowedDomains: stringArray(rules.allowedDomains),
    blockedDomains: stringArray(rules.blockedDomains),
    approvalActions: stringArray(rules.approvalRequiredActions),
    rulesJson: rules,
    decision: "approval_required",
    risk: "medium",
    updatedAt: relativeTime(dto.updatedAt),
  };
}

export function mapWorkflow(dto: WorkflowDto, agents: AgentFixture[], vendors: VendorFixture[]): WorkflowFixture {
  const agent = agents.find((item) => item.id === dto.agentId);
  const vendor = vendors.find((item) => item.id === dto.vendorId);
  return {
    id: dto.id,
    agentId: dto.agentId,
    vendorId: dto.vendorId,
    templateKey: dto.template,
    configurationJson: asRecord(dto.configurationJson),
    name: dto.name,
    template: labelize(dto.template),
    agent: agent?.name ?? dto.agentId,
    vendor: vendor?.name ?? dto.vendorId,
    status: toStatus(dto.status),
    lastRun: relativeTime(dto.updatedAt),
    readiness: "ready",
  };
}

export function mapWorkflowRun(dto: WorkflowRunSummaryDto): WorkflowRunFixture {
  const attempt = dto.actionAttempts?.[0];
  const approvals = (dto.approvalRequests ?? []).map((approval) => ({
    id: approval.id,
    status: toStatus(approval.status),
    action: approval.summary,
    agent: dto.agent?.name ?? dto.agentId,
    vendor: dto.vendor?.name ?? dto.vendorId ?? "Vendor",
    risk: toRisk(approval.riskLevel),
    amount: centsToDollars(approval.amountCents),
    requestedAt: approval.createdAt ? shortTime(approval.createdAt) : "Requested",
    expiresAt: approval.expiresAt ? shortTime(approval.expiresAt) : "No expiry",
    policyTrigger: attempt?.policyReason ?? "Policy required human approval.",
  }));
  return {
    id: dto.id,
    workflow: dto.workflow?.name ?? dto.workflowId,
    vendor: dto.vendor?.name ?? dto.vendorId ?? "No vendor",
    agent: dto.agent?.name ?? dto.agentId,
    status: toStatus(dto.status),
    risk: toRisk(attempt?.riskLevel ?? dto.approvalRequests?.[0]?.riskLevel),
    startedAt: dto.startedAt ? shortTime(dto.startedAt) : shortTime(dto.createdAt),
    duration: dto.startedAt ? durationSince(dto.startedAt, dto.updatedAt) : "Queued",
    currentStep: dto.currentStep ?? dto.resultSummary ?? dto.errorMessage ?? "Queued",
    policyDecision: toPolicyDecision(attempt?.policyDecision),
    files: fileEvidenceFromRecords(dto.files ?? []),
    evidence: {
      timeline: timelineFromRun(dto),
      screenshots: screenshotsFromFiles(dto.files),
      approvals,
      receipt: dto.receipt
        ? {
            id: dto.receipt.id,
            status: toStatus(dto.receipt.finalStatus),
            summary: dto.receipt.summary,
            createdAt: shortTime(dto.receipt.createdAt),
          }
        : null,
    },
  };
}

export function mapApproval(dto: ApprovalRequestDto, runs: WorkflowRunFixture[]): ApprovalFixture {
  const run = runs.find((item) => item.id === dto.workflowRunId);
  return {
    id: dto.id,
    status: toStatus(dto.status),
    action: dto.summary,
    agent: run?.agent ?? dto.requestedByAgentId,
    vendor: run?.vendor ?? "Vendor",
    risk: toRisk(dto.riskLevel),
    amount: centsToDollars(dto.amountCents),
    requestedAt: shortTime(dto.createdAt),
    expiresAt: dto.expiresAt ? shortTime(dto.expiresAt) : "No expiry",
    policyTrigger: policyReason(dto.policyTriggeredJson) ?? "Policy required human approval.",
  };
}

export function mapReceipt(dto: ReceiptListDto | ReceiptDetailDto): ReceiptFixture {
  const detail = "timeline" in dto;
  const policyDecision = detail ? policyDecisionFromJson(dto.policyDecisions) : undefined;
  return {
    id: dto.id,
    status: toStatus(dto.finalStatus),
    summary: dto.summary,
    vendor: "vendor" in dto && dto.vendor ? dto.vendor.name : dto.workflowRun?.vendor?.name ?? "AegisWeb",
    agent: dto.agent?.name ?? dto.agentId,
    workflowRun: dto.workflowRunId,
    createdAt: shortTime(dto.createdAt),
    files: detail ? fileEvidenceFromJson(dto.files) : [],
    hash: detail ? receiptHash(dto) : `hash_${dto.id.slice(0, 12)}`,
    evidence: detail
      ? {
          timeline: timelineFromReceipt(dto.timeline),
          screenshots: screenshotsFromJson(dto.screenshots),
          approvals: approvalsFromReceipt(dto, policyDecision),
          policyDecision,
        }
      : undefined,
  };
}

export function mapAuditEvent(dto: AuditEventDto): AuditEventFixture {
  return {
    id: dto.id,
    timestamp: shortTime(dto.createdAt),
    eventType: dto.eventType.toLowerCase(),
    actor: dto.actorId ? `${dto.actorType}:${dto.actorId}` : dto.actorType,
    description: auditDescription(dto),
    workflowRun: dto.workflowRunId ?? "workspace",
    hash: dto.eventHash,
    payload: asRecord(dto.eventDataJson),
  };
}

export function mapOrganizationSettings(organization: OrganizationDto | null, users: UserDto[]) {
  return {
    organizationItems: [
      ["Name", organization?.name ?? "Northstar Labs"],
      ["Domain", organization?.domain ?? "northstarlabs.dev"],
      ["Plan", organization?.plan ?? "Local MVP"],
      ["Users", `${users.length || 1} active users`],
    ] as [string, string][],
    userItems: users.map((user) => [user.name, `${user.email} / ${user.role}`] as [string, string]),
  };
}

function toStatus(value: string | undefined): StatusKind {
  const normalized = (value ?? "pending").toLowerCase().replace("waiting_for_approval", "waiting");
  if (normalized === "queued") return "pending";
  if (normalized === "denied" || normalized === "canceled" || normalized === "cancelled") return "failed";
  return normalized as StatusKind;
}

function toRisk(value: string | undefined): RiskLevel {
  const normalized = (value ?? "low").toLowerCase();
  if (normalized === "blocked") return "critical";
  if (["low", "medium", "high", "critical"].includes(normalized)) return normalized as RiskLevel;
  return "low";
}

function toPolicyDecision(value: string | undefined): PolicyDecision {
  const normalized = (value ?? "record_only").toLowerCase();
  if (normalized === "require_approval") return "approval_required";
  if (["allow", "approval_required", "deny", "record_only"].includes(normalized)) return normalized as PolicyDecision;
  return "record_only";
}

function centsToDollars(cents: number | null | undefined) {
  return Math.round((cents ?? 0) / 100);
}

function shortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function durationSince(start: string, end: string) {
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function readNumber(dto: VendorDto, key: string, fallback: number) {
  const metadata = asRecord(dto.metadataJson);
  const value = metadata[key];
  return typeof value === "number" ? value : fallback;
}

function policyReason(value: unknown) {
  const record = asRecord(value);
  return typeof record.reason === "string" ? record.reason : undefined;
}

function auditDescription(dto: AuditEventDto) {
  const payload = asRecord(dto.eventDataJson);
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.action === "string") return payload.action;
  return labelize(dto.eventType.toLowerCase());
}

function fileEvidenceFromRecords(files: NonNullable<WorkflowRunSummaryDto["files"]>): EvidenceFile[] {
  return files.map((file) => ({
    id: file.id,
    label: `${labelize(file.kind.toLowerCase())} ${file.id.slice(0, 8)}`,
    kind: file.kind,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    createdAt: file.createdAt ? shortTime(file.createdAt) : undefined,
    downloadHref: `/files/${file.id}/download`,
  }));
}

function fileEvidenceFromJson(value: unknown): EvidenceFile[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = asRecord(item);
    const id = stringValue(record.id) ?? stringValue(record.fileId) ?? `evidence-${index + 1}`;
    const kind = stringValue(record.kind);
    const objectKey = stringValue(record.objectKey);
    return {
      id,
      label: objectKey?.split("/").pop() ?? (kind ? `${labelize(kind.toLowerCase())} ${id.slice(0, 8)}` : `Evidence ${index + 1}`),
      kind,
      mimeType: stringValue(record.mimeType),
      sizeBytes: numberValue(record.sizeBytes),
      sha256: stringValue(record.sha256),
      createdAt: typeof record.createdAt === "string" ? shortTime(record.createdAt) : undefined,
      downloadHref: `/files/${id}/download`,
    };
  });
}

function screenshotsFromFiles(files: WorkflowRunSummaryDto["files"]) {
  return fileEvidenceFromRecords((files ?? []).filter((file) => file.kind.toLowerCase() === "screenshot")).map((file) => ({
    id: file.id,
    fileId: file.id,
    title: file.label,
    timestamp: file.createdAt ?? "Captured",
    source: "workflow evidence",
    description: file.sha256 ? `SHA-256 ${file.sha256}` : "Screenshot evidence captured by the worker.",
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    downloadHref: file.downloadHref,
  }));
}

function screenshotsFromJson(value: unknown) {
  return fileEvidenceFromJson(value).map((file) => ({
    id: file.id,
    fileId: file.id,
    title: file.label,
    timestamp: file.createdAt ?? "Captured",
    source: file.mimeType ?? "receipt evidence",
    description: file.sha256 ? `SHA-256 ${file.sha256}` : "Screenshot evidence captured by the worker.",
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    downloadHref: file.downloadHref,
  }));
}

function timelineFromRun(dto: WorkflowRunSummaryDto) {
  const attemptEvents = (dto.actionAttempts ?? []).map((attempt) => ({
    time: attempt.createdAt ? shortTime(attempt.createdAt) : dto.startedAt ? shortTime(dto.startedAt) : shortTime(dto.createdAt),
    actor: dto.agent?.name ?? dto.agentId,
    status: toStatus(attempt.completedAt ? "completed" : dto.status),
    summary: attempt.inputSummary ?? attempt.outputSummary ?? attempt.policyReason ?? labelize(attempt.actionType ?? "action_attempt"),
    hash: attempt.id,
  }));
  const approvalEvents = (dto.approvalRequests ?? []).map((approval) => ({
    time: approval.createdAt ? shortTime(approval.createdAt) : shortTime(dto.createdAt),
    actor: "AegisWeb Policy",
    status: toStatus(approval.status),
    summary: approval.summary,
    hash: approval.id,
  }));
  const fileEvents = fileEvidenceFromRecords(dto.files ?? []).map((file) => ({
    time: file.createdAt ?? "Captured",
    actor: "Worker evidence store",
    status: "completed" as const,
    summary: `${file.label} attached to the run.`,
    hash: file.sha256,
  }));

  return [
    {
      title: "Workflow evidence",
      events:
        [...attemptEvents, ...approvalEvents, ...fileEvents].length > 0
          ? [...attemptEvents, ...approvalEvents, ...fileEvents]
          : [
              {
                time: shortTime(dto.createdAt),
                actor: "AegisWeb Orchestrator",
                status: toStatus(dto.status),
                summary: dto.currentStep ?? dto.resultSummary ?? "Workflow run recorded.",
                hash: dto.id,
              },
            ],
    },
  ];
}

function timelineFromReceipt(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const events = value.map((item) => {
    const record = asRecord(item);
    const type = stringValue(record.type) ?? "event";
    const data = asRecord(record.data);
    const summary =
      stringValue(record.summary) ??
      stringValue(record.inputSummary) ??
      stringValue(record.outputSummary) ??
      stringValue(record.policyReason) ??
      stringValue(data.summary) ??
      stringValue(data.action) ??
      labelize(type);
    return {
      time: typeof record.at === "string" ? shortTime(record.at) : "Recorded",
      actor: stringValue(record.actorType) ?? stringValue(record.actorId) ?? actorForTimelineType(type),
      status: toTimelineStatus(stringValue(record.status) ?? stringValue(record.policyDecision)),
      summary,
      hash: stringValue(record.sha256) ?? stringValue(record.id),
    };
  });

  return [
    {
      title: "Receipt timeline",
      events,
    },
  ];
}

function approvalsFromReceipt(dto: ReceiptDetailDto, policyDecision: string | undefined) {
  const details = asRecord(dto.approvalDetails);
  const approvalsValue = details.approvals;
  if (!Array.isArray(approvalsValue)) return [];

  return approvalsValue.map((item) => {
    const record = asRecord(item);
    return {
      id: stringValue(record.id) ?? "approval",
      status: toStatus(stringValue(record.status) ?? "pending"),
      action: stringValue(record.summary) ?? dto.summary,
      agent: dto.agent?.name ?? dto.agentId,
      vendor: dto.vendor?.name ?? "AegisWeb",
      risk: "medium" as const,
      amount: centsToDollars(numberValue(record.amountCents)),
      requestedAt: dto.createdAt ? shortTime(dto.createdAt) : "Recorded",
      expiresAt: "No expiry",
      policyTrigger: policyDecision ? `Policy decision: ${labelize(policyDecision)}` : "Approval details were recorded in the receipt.",
    };
  });
}

function policyDecisionFromJson(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const first = asRecord(value[0]);
  return stringValue(first.policyDecision) ?? stringValue(first.decision);
}

function receiptHash(dto: ReceiptDetailDto) {
  const fileHash = fileEvidenceFromJson(dto.files).find((file) => file.sha256)?.sha256;
  return fileHash ?? `hash_${dto.id.slice(0, 12)}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function actorForTimelineType(type: string) {
  if (type.includes("audit")) return "AegisWeb Audit";
  if (type.includes("approval")) return "AegisWeb Policy";
  if (type.includes("file")) return "Evidence Store";
  return "AegisWeb";
}

function toTimelineStatus(value: string | undefined) {
  const normalized = value?.toLowerCase();
  if (normalized === "pending" || normalized === "running" || normalized === "waiting" || normalized === "approved" || normalized === "rejected" || normalized === "failed") {
    return toStatus(normalized);
  }
  return "completed" as const;
}
