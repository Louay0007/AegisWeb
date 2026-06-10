import type { EvidenceFileItem, ReceiptEvidence, WorkflowRunEvidence } from "@/lib/evidence-types";

export type StatusKind = "active" | "paused" | "revoked" | "pending" | "running" | "waiting" | "approved" | "rejected" | "completed" | "failed";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PolicyDecision = "allow" | "approval_required" | "deny" | "record_only";

export type AgentFixture = {
  id: string;
  name: string;
  identifier: string;
  status: StatusKind;
  purpose: string;
  policy: string;
  recentRuns: number;
  lastActivity: string;
  credentialGrants: string[];
};

export type VendorFixture = {
  id: string;
  name: string;
  website: string;
  category: string;
  renewalDate: string;
  monthlyCost: number;
  renewalCost: number;
  unusedSeats: number;
  risk: RiskLevel;
  owner: string;
};

export type CredentialFixture = {
  id: string;
  vendorId?: string;
  label: string;
  vendor: string;
  type: string;
  status: StatusKind;
  grantedAgents: string[];
  grantedAgentDetails?: Array<{ grantId: string; agentId: string; agentName: string; scope: string }>;
  lastUsed: string;
  createdBy: string;
};

export type PolicyFixture = {
  id: string;
  agentId?: string | null;
  type?: string;
  name: string;
  agent: string;
  version: string;
  status: StatusKind;
  allowedDomains: string[];
  blockedDomains: string[];
  approvalActions: string[];
  rulesJson?: Record<string, unknown>;
  decision: PolicyDecision;
  risk: RiskLevel;
  updatedAt: string;
};

export type WorkflowFixture = {
  id: string;
  agentId?: string;
  vendorId?: string;
  templateKey?: string;
  configurationJson?: Record<string, unknown>;
  name: string;
  template: string;
  agent: string;
  vendor: string;
  status: StatusKind;
  lastRun: string;
  readiness: "ready" | "missing_grant" | "policy_review";
};

export type WorkflowRunFixture = {
  id: string;
  workflow: string;
  vendor: string;
  agent: string;
  status: StatusKind;
  risk: RiskLevel;
  startedAt: string;
  duration: string;
  currentStep: string;
  policyDecision: PolicyDecision;
  files: EvidenceFileItem[];
  evidence?: WorkflowRunEvidence;
};

export type ApprovalFixture = {
  id: string;
  status: StatusKind;
  action: string;
  agent: string;
  vendor: string;
  risk: RiskLevel;
  amount: number;
  requestedAt: string;
  expiresAt: string;
  policyTrigger: string;
};

export type ReceiptFixture = {
  id: string;
  status: StatusKind;
  summary: string;
  vendor: string;
  agent: string;
  workflowRun: string;
  createdAt: string;
  files: EvidenceFileItem[];
  hash: string;
  evidence?: ReceiptEvidence;
};

export type AuditEventFixture = {
  id: string;
  timestamp: string;
  eventType: string;
  actor: string;
  description: string;
  workflowRun: string;
  hash: string;
  payload: Record<string, unknown>;
};

export const agents: AgentFixture[] = [
  {
    id: "agt-finance-ops",
    name: "Finance Ops Agent",
    identifier: "agt_finance_ops_7x9l",
    status: "active",
    purpose: "Reads invoices, checks renewals, and prepares plan changes.",
    policy: "Finance SaaS Control",
    recentRuns: 18,
    lastActivity: "12 minutes ago",
    credentialGrants: ["Acme Analytics vault item", "Linear billing read-only"],
  },
  {
    id: "agt-procurement-review",
    name: "Procurement Review Agent",
    identifier: "agt_procurement_review_2m4q",
    status: "paused",
    purpose: "Compares vendor plans and flags contract risk.",
    policy: "Procurement Review",
    recentRuns: 7,
    lastActivity: "2 hours ago",
    credentialGrants: ["Notion procurement workspace"],
  },
  {
    id: "agt-audit-export",
    name: "Audit Export Agent",
    identifier: "agt_audit_export_93ka",
    status: "active",
    purpose: "Exports receipts and audit evidence for compliance review.",
    policy: "Evidence Export",
    recentRuns: 11,
    lastActivity: "31 minutes ago",
    credentialGrants: ["AegisWeb evidence store"],
  },
];

export const vendors: VendorFixture[] = [
  {
    id: "ven-acme",
    name: "Acme Analytics",
    website: "billing.acme-analytics.test",
    category: "Analytics",
    renewalDate: "2026-07-15",
    monthlyCost: 18450,
    renewalCost: 221400,
    unusedSeats: 18,
    risk: "high",
    owner: "Finance Ops",
  },
  {
    id: "ven-linear",
    name: "Linear",
    website: "linear.test",
    category: "Engineering",
    renewalDate: "2026-08-30",
    monthlyCost: 4200,
    renewalCost: 50400,
    unusedSeats: 6,
    risk: "medium",
    owner: "Dev Platform",
  },
  {
    id: "ven-notion",
    name: "Notion",
    website: "notion.test",
    category: "Knowledge base",
    renewalDate: "2026-09-12",
    monthlyCost: 2900,
    renewalCost: 34800,
    unusedSeats: 4,
    risk: "low",
    owner: "Operations",
  },
];

export const credentials: CredentialFixture[] = [
  {
    id: "cred-acme-billing",
    label: "Acme billing portal",
    vendor: "Acme Analytics",
    type: "Password vault item",
    status: "active",
    grantedAgents: ["Finance Ops Agent"],
    lastUsed: "12 minutes ago",
    createdBy: "Louay Founder",
  },
  {
    id: "cred-linear-read",
    label: "Linear billing read-only",
    vendor: "Linear",
    type: "Scoped token",
    status: "active",
    grantedAgents: ["Finance Ops Agent", "Audit Export Agent"],
    lastUsed: "1 hour ago",
    createdBy: "Dev Operator",
  },
  {
    id: "cred-notion-procurement",
    label: "Notion procurement workspace",
    vendor: "Notion",
    type: "OAuth grant",
    status: "paused",
    grantedAgents: ["Procurement Review Agent"],
    lastUsed: "Yesterday",
    createdBy: "Louay Founder",
  },
];

export const policies: PolicyFixture[] = [
  {
    id: "pol-finance-saas",
    name: "Finance SaaS Control",
    agent: "Finance Ops Agent",
    version: "v4",
    status: "active",
    allowedDomains: ["billing.acme-analytics.test", "linear.test"],
    blockedDomains: ["admin.payment-methods.test"],
    approvalActions: ["plan downgrade", "seat removal", "annual renewal"],
    decision: "approval_required",
    risk: "high",
    updatedAt: "Today",
  },
  {
    id: "pol-evidence-export",
    name: "Evidence Export",
    agent: "Audit Export Agent",
    version: "v2",
    status: "active",
    allowedDomains: ["aegisweb.local"],
    blockedDomains: ["external-storage.test"],
    approvalActions: ["bulk export"],
    decision: "record_only",
    risk: "low",
    updatedAt: "Yesterday",
  },
];

export const workflows: WorkflowFixture[] = [
  {
    id: "wf-acme-downgrade",
    name: "Acme Downgrade Request",
    template: "Plan downgrade request",
    agent: "Finance Ops Agent",
    vendor: "Acme Analytics",
    status: "active",
    lastRun: "12 minutes ago",
    readiness: "ready",
  },
  {
    id: "wf-acme-invoice",
    name: "Acme Invoice Download",
    template: "Vendor invoice download",
    agent: "Finance Ops Agent",
    vendor: "Acme Analytics",
    status: "active",
    lastRun: "36 minutes ago",
    readiness: "ready",
  },
  {
    id: "wf-linear-renewal",
    name: "Linear Renewal Check",
    template: "SaaS renewal check",
    agent: "Procurement Review Agent",
    vendor: "Linear",
    status: "paused",
    lastRun: "2 days ago",
    readiness: "policy_review",
  },
];

export const workflowRuns: WorkflowRunFixture[] = [
  {
    id: "run-acme-2048",
    workflow: "Acme Downgrade Request",
    vendor: "Acme Analytics",
    agent: "Finance Ops Agent",
    status: "waiting",
    risk: "high",
    startedAt: "10:42:11",
    duration: "3m 22s",
    currentStep: "Waiting for finance approval",
    policyDecision: "approval_required",
    files: ["screenshot-before-plan-change.png", "policy-evaluation.json"],
  },
  {
    id: "run-invoice-2047",
    workflow: "Acme Invoice Download",
    vendor: "Acme Analytics",
    agent: "Finance Ops Agent",
    status: "completed",
    risk: "low",
    startedAt: "10:06:04",
    duration: "48s",
    currentStep: "Receipt generated",
    policyDecision: "allow",
    files: ["invoice-may-2026.pdf", "receipt-run-invoice-2047.json"],
  },
  {
    id: "run-linear-2039",
    workflow: "Linear Renewal Check",
    vendor: "Linear",
    agent: "Procurement Review Agent",
    status: "failed",
    risk: "medium",
    startedAt: "Yesterday",
    duration: "1m 04s",
    currentStep: "Credential grant paused",
    policyDecision: "deny",
    files: ["error-screenshot.png"],
  },
];

export const approvals: ApprovalFixture[] = [
  {
    id: "apr-acme-downgrade",
    status: "pending",
    action: "Request Acme plan downgrade",
    agent: "Finance Ops Agent",
    vendor: "Acme Analytics",
    risk: "high",
    amount: 18450,
    requestedAt: "10:42:13",
    expiresAt: "11:12:13",
    policyTrigger: "Plan change requires human approval above $10,000 annual impact.",
  },
  {
    id: "apr-bulk-export",
    status: "approved",
    action: "Export receipt packet",
    agent: "Audit Export Agent",
    vendor: "AegisWeb",
    risk: "medium",
    amount: 0,
    requestedAt: "09:18:44",
    expiresAt: "09:48:44",
    policyTrigger: "Bulk evidence export recorded and approved.",
  },
];

export const receipts: ReceiptFixture[] = [
  {
    id: "rcpt-invoice-2047",
    status: "completed",
    summary: "Invoice downloaded from Acme Analytics with no credential exposure.",
    vendor: "Acme Analytics",
    agent: "Finance Ops Agent",
    workflowRun: "run-invoice-2047",
    createdAt: "10:07:02",
    files: ["invoice-may-2026.pdf", "browser-evidence.png"],
    hash: "hash_9b18a7c441e0",
  },
  {
    id: "rcpt-export-2045",
    status: "completed",
    summary: "Audit evidence packet exported for finance review.",
    vendor: "AegisWeb",
    agent: "Audit Export Agent",
    workflowRun: "run-export-2045",
    createdAt: "09:20:11",
    files: ["evidence-packet.zip"],
    hash: "hash_5d72cf13aa90",
  },
];

export const auditEvents: AuditEventFixture[] = [
  {
    id: "evt-1042",
    timestamp: "10:42:11",
    eventType: "workflow_run_started",
    actor: "Finance Ops Agent",
    description: "Acme Downgrade Request started with scoped billing credential.",
    workflowRun: "run-acme-2048",
    hash: "evt_hash_30b7",
    payload: { runId: "run-acme-2048", credential: "[REDACTED]", vendor: "Acme Analytics" },
  },
  {
    id: "evt-1043",
    timestamp: "10:42:13",
    eventType: "approval_requested",
    actor: "AegisWeb Policy",
    description: "Plan downgrade paused for finance approval.",
    workflowRun: "run-acme-2048",
    hash: "evt_hash_4aa1",
    payload: { risk: "high", amount: 18450, password: "[REDACTED]" },
  },
  {
    id: "evt-1032",
    timestamp: "10:07:02",
    eventType: "receipt_generated",
    actor: "AegisWeb Receipt",
    description: "Receipt generated for invoice download.",
    workflowRun: "run-invoice-2047",
    hash: "evt_hash_a811",
    payload: { file: "invoice-may-2026.pdf", hash: "hash_9b18a7c441e0" },
  },
];

export const dashboardMetrics = [
  { label: "Pending approvals", value: "3", detail: "2 high risk", tone: "warning" as const },
  { label: "Active agents", value: "12", detail: "9 scoped", tone: "neutral" as const },
  { label: "Runs today", value: "48", detail: "4 paused", tone: "running" as const },
  { label: "Credentials exposed", value: "0", detail: "vault enforced", tone: "success" as const },
];

export const timeline = [
  { title: "Agent authenticated", description: "Finance Ops Agent received scoped authority.", time: "10:42:11", status: "completed" as StatusKind },
  { title: "Policy evaluated", description: "Plan change crossed approval threshold.", time: "10:42:12", status: "completed" as StatusKind },
  { title: "Approval requested", description: "Finance Ops must approve before continuing.", time: "10:42:13", status: "waiting" as StatusKind },
  { title: "Receipt pending", description: "Final receipt will include decision and evidence.", time: "After approval", status: "pending" as StatusKind },
];

export function findById<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id) ?? items[0];
}
