import { UserRole, USER_ROLES } from './enums.js';

export const Permission = {
  OrganizationRead: 'organization:read',
  OrganizationUpdate: 'organization:update',
  UserRead: 'user:read',
  UserInvite: 'user:invite',
  AgentCreate: 'agent:create',
  AgentRead: 'agent:read',
  AgentUpdate: 'agent:update',
  AgentPause: 'agent:pause',
  AgentRevoke: 'agent:revoke',
  VendorCreate: 'vendor:create',
  VendorRead: 'vendor:read',
  VendorUpdate: 'vendor:update',
  PolicyCreate: 'policy:create',
  PolicyRead: 'policy:read',
  PolicyUpdate: 'policy:update',
  CredentialCreate: 'credential:create',
  CredentialRead: 'credential:read',
  CredentialGrant: 'credential:grant',
  CredentialRevoke: 'credential:revoke',
  WorkflowCreate: 'workflow:create',
  WorkflowRead: 'workflow:read',
  WorkflowRun: 'workflow:run',
  WorkflowCancel: 'workflow:cancel',
  ApprovalRead: 'approval:read',
  ApprovalApprove: 'approval:approve',
  ReceiptRead: 'receipt:read',
  AuditRead: 'audit:read',
  FileRead: 'file:read'
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
export const PERMISSIONS = Object.values(Permission);

const readPermissions = [
  Permission.OrganizationRead,
  Permission.UserRead,
  Permission.AgentRead,
  Permission.VendorRead,
  Permission.PolicyRead,
  Permission.CredentialRead,
  Permission.WorkflowRead,
  Permission.ApprovalRead,
  Permission.ReceiptRead,
  Permission.AuditRead,
  Permission.FileRead
] as const;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.Owner]: PERMISSIONS,
  [UserRole.Admin]: PERMISSIONS,
  [UserRole.Approver]: [
    Permission.OrganizationRead,
    Permission.AgentRead,
    Permission.VendorRead,
    Permission.WorkflowRead,
    Permission.ApprovalRead,
    Permission.ApprovalApprove,
    Permission.ReceiptRead,
    Permission.FileRead
  ],
  [UserRole.Auditor]: [
    Permission.OrganizationRead,
    Permission.AgentRead,
    Permission.VendorRead,
    Permission.WorkflowRead,
    Permission.ApprovalRead,
    Permission.ReceiptRead,
    Permission.AuditRead,
    Permission.FileRead
  ],
  [UserRole.Developer]: [
    ...readPermissions,
    Permission.WorkflowRun,
    Permission.WorkflowCancel
  ]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertRolePermissionCoverage(): boolean {
  return USER_ROLES.every((role) => Array.isArray(ROLE_PERMISSIONS[role]));
}
