export type Permission =
  | "agent:create"
  | "agent:update"
  | "agent:pause"
  | "agent:revoke"
  | "vendor:create"
  | "vendor:update"
  | "vendor:delete"
  | "credential:create"
  | "credential:grant"
  | "credential:revoke"
  | "policy:create"
  | "policy:update"
  | "policy:evaluate"
  | "workflow:create"
  | "workflow:update"
  | "workflow:run"
  | "workflow:cancel"
  | "approval:approve"
  | "receipt:read"
  | "audit:read";

const rolePermissions: Record<string, Permission[]> = {
  OWNER: [
    "agent:create",
    "agent:update",
    "agent:pause",
    "agent:revoke",
    "vendor:create",
    "vendor:update",
    "vendor:delete",
    "credential:create",
    "credential:grant",
    "credential:revoke",
    "policy:create",
    "policy:update",
    "policy:evaluate",
    "workflow:create",
    "workflow:update",
    "workflow:run",
    "workflow:cancel",
    "approval:approve",
    "receipt:read",
    "audit:read",
  ],
  ADMIN: [
    "agent:create",
    "agent:update",
    "agent:pause",
    "agent:revoke",
    "vendor:create",
    "vendor:update",
    "vendor:delete",
    "credential:create",
    "credential:grant",
    "credential:revoke",
    "policy:create",
    "policy:update",
    "policy:evaluate",
    "workflow:create",
    "workflow:update",
    "workflow:run",
    "workflow:cancel",
    "approval:approve",
    "receipt:read",
    "audit:read",
  ],
  APPROVER: ["workflow:run", "approval:approve", "receipt:read"],
  AUDITOR: ["receipt:read", "audit:read"],
  DEVELOPER: ["workflow:create", "workflow:update", "workflow:run", "workflow:cancel", "receipt:read", "audit:read"],
};

export function can(role: string | undefined, permission: Permission) {
  return role ? (rolePermissions[role.toUpperCase()] ?? []).includes(permission) : false;
}
