export const UserRole = {
  Owner: 'owner',
  Admin: 'admin',
  Approver: 'approver',
  Auditor: 'auditor',
  Developer: 'developer'
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const USER_ROLES = Object.values(UserRole);

export const UserStatus = {
  Active: 'active',
  Invited: 'invited',
  Disabled: 'disabled'
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const USER_STATUSES = Object.values(UserStatus);

export const AgentStatus = {
  Active: 'active',
  Paused: 'paused',
  Revoked: 'revoked'
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];
export const AGENT_STATUSES = Object.values(AgentStatus);

export const VendorCategory = {
  Analytics: 'analytics',
  Productivity: 'productivity',
  Sales: 'sales',
  Payroll: 'payroll',
  Finance: 'finance',
  Security: 'security',
  Other: 'other'
} as const;
export type VendorCategory = (typeof VendorCategory)[keyof typeof VendorCategory];
export const VENDOR_CATEGORIES = Object.values(VendorCategory);

export const ConnectorType = {
  Sandbox: 'sandbox',
  StripeBilling: 'stripe_billing',
  Github: 'github'
} as const;
export type ConnectorType = (typeof ConnectorType)[keyof typeof ConnectorType];
export const CONNECTOR_TYPES = Object.values(ConnectorType);

export const PolicyType = {
  WebsiteAllowlist: 'website_allowlist',
  ActionPermissions: 'action_permissions',
  SpendingLimits: 'spending_limits',
  DataAccess: 'data_access',
  TimeWindow: 'time_window',
  ApprovalRules: 'approval_rules',
  AgentPolicyBundle: 'agent_policy_bundle'
} as const;
export type PolicyType = (typeof PolicyType)[keyof typeof PolicyType];
export const POLICY_TYPES = Object.values(PolicyType);

export const PolicyStatus = {
  Active: 'active',
  Draft: 'draft',
  Archived: 'archived'
} as const;
export type PolicyStatus = (typeof PolicyStatus)[keyof typeof PolicyStatus];
export const POLICY_STATUSES = Object.values(PolicyStatus);

export const CredentialType = {
  UsernamePassword: 'username_password',
  TotpSecret: 'totp_secret',
  ApiToken: 'api_token',
  OAuthToken: 'oauth_token',
  SessionCookie: 'session_cookie'
} as const;
export type CredentialType = (typeof CredentialType)[keyof typeof CredentialType];
export const CREDENTIAL_TYPES = Object.values(CredentialType);

export const CredentialStatus = {
  Active: 'active',
  Revoked: 'revoked',
  Rotated: 'rotated'
} as const;
export type CredentialStatus = (typeof CredentialStatus)[keyof typeof CredentialStatus];
export const CREDENTIAL_STATUSES = Object.values(CredentialStatus);

export const WorkflowTemplate = {
  VendorInvoiceDownload: 'vendor_invoice_download',
  SaasRenewalCheck: 'saas_renewal_check',
  PlanDowngradeRequest: 'plan_downgrade_request'
} as const;
export type WorkflowTemplate = (typeof WorkflowTemplate)[keyof typeof WorkflowTemplate];
export const WORKFLOW_TEMPLATES = Object.values(WorkflowTemplate);

export const WorkflowStatus = {
  Active: 'active',
  Paused: 'paused',
  Archived: 'archived'
} as const;
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];
export const WORKFLOW_STATUSES = Object.values(WorkflowStatus);

export const WorkflowRunStatus = {
  Queued: 'queued',
  Running: 'running',
  WaitingForApproval: 'waiting_for_approval',
  Completed: 'completed',
  Failed: 'failed',
  Canceled: 'canceled',
  Denied: 'denied'
} as const;
export type WorkflowRunStatus = (typeof WorkflowRunStatus)[keyof typeof WorkflowRunStatus];
export const WORKFLOW_RUN_STATUSES = Object.values(WorkflowRunStatus);

export const ActionType = {
  OpenPage: 'open_page',
  ReadPage: 'read_page',
  FillForm: 'fill_form',
  ClickButton: 'click_button',
  DownloadFile: 'download_file',
  SubmitForm: 'submit_form',
  ChangePlan: 'change_plan',
  CancelSubscription: 'cancel_subscription',
  InviteUser: 'invite_user',
  ChangeBillingDetails: 'change_billing_details',
  MakePurchase: 'make_purchase',
  CredentialInjection: 'credential_injection'
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];
export const ACTION_TYPES = Object.values(ActionType);

export const PolicyDecision = {
  Allow: 'allow',
  Deny: 'deny',
  RequireApproval: 'require_approval',
  RequireStepUpAuth: 'require_step_up_auth',
  PauseAgent: 'pause_agent'
} as const;
export type PolicyDecision = (typeof PolicyDecision)[keyof typeof PolicyDecision];
export const POLICY_DECISIONS = Object.values(PolicyDecision);

export const RiskLevel = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical'
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
export const RISK_LEVELS = Object.values(RiskLevel);

export const ApprovalStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Expired: 'expired',
  AutoApproved: 'auto_approved',
  Escalated: 'escalated'
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];
export const APPROVAL_STATUSES = Object.values(ApprovalStatus);

export const AuditActorType = {
  User: 'user',
  Agent: 'agent',
  Worker: 'worker',
  System: 'system',
  Integration: 'integration'
} as const;
export type AuditActorType = (typeof AuditActorType)[keyof typeof AuditActorType];
export const AUDIT_ACTOR_TYPES = Object.values(AuditActorType);

export const AuditEventType = {
  OrganizationCreated: 'organization_created',
  OrganizationUpdated: 'organization_updated',
  UserInvited: 'user_invited',
  UserRegistered: 'user_registered',
  UserLoginSucceeded: 'user_login_succeeded',
  UserLoginFailed: 'user_login_failed',
  UserLogout: 'user_logout',
  TokenRefreshed: 'token_refreshed',
  UserRoleChanged: 'user_role_changed',
  UserDisabled: 'user_disabled',
  AgentCreated: 'agent_created',
  AgentUpdated: 'agent_updated',
  AgentPaused: 'agent_paused',
  AgentResumed: 'agent_resumed',
  AgentRevoked: 'agent_revoked',
  VendorCreated: 'vendor_created',
  VendorUpdated: 'vendor_updated',
  VendorDeleted: 'vendor_deleted',
  PolicyCreated: 'policy_created',
  PolicyUpdated: 'policy_updated',
  PolicyEvaluated: 'policy_evaluated',
  CredentialCreated: 'credential_created',
  CredentialUpdated: 'credential_updated',
  CredentialGrantedToAgent: 'credential_granted_to_agent',
  CredentialGrantRevoked: 'credential_grant_revoked',
  CredentialRevoked: 'credential_revoked',
  CredentialUsed: 'credential_used',
  WorkflowCreated: 'workflow_created',
  WorkflowUpdated: 'workflow_updated',
  WorkflowRunRequested: 'workflow_run_requested',
  WorkflowRunCreated: 'workflow_run_created',
  WorkflowRunStarted: 'workflow_run_started',
  WorkflowStepStarted: 'workflow_step_started',
  WorkflowRunWaitingForApproval: 'workflow_run_waiting_for_approval',
  WorkflowRunCompleted: 'workflow_run_completed',
  WorkflowRunFailed: 'workflow_run_failed',
  WorkflowRunCanceled: 'workflow_run_canceled',
  WorkflowRunDenied: 'workflow_run_denied',
  BrowserPageOpened: 'browser_page_opened',
  BrowserElementClicked: 'browser_element_clicked',
  FileDownloaded: 'file_downloaded',
  ApprovalRequested: 'approval_requested',
  ApprovalApproved: 'approval_approved',
  ApprovalRejected: 'approval_rejected',
  ApprovalExpired: 'approval_expired',
  ReceiptCreated: 'receipt_created'
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];
export const AUDIT_EVENT_TYPES = Object.values(AuditEventType);

export const FileKind = {
  Screenshot: 'screenshot',
  Invoice: 'invoice',
  PlaywrightTrace: 'playwright_trace',
  ReceiptExport: 'receipt_export',
  Download: 'download'
} as const;
export type FileKind = (typeof FileKind)[keyof typeof FileKind];
export const FILE_KINDS = Object.values(FileKind);

export const ReceiptStatus = {
  Completed: 'completed',
  Failed: 'failed',
  Denied: 'denied',
  Canceled: 'canceled'
} as const;
export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];
export const RECEIPT_STATUSES = Object.values(ReceiptStatus);
