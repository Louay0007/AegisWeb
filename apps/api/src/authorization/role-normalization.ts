import { UserRole } from '@agentpass/domain';

const roleMap: Record<string, UserRole> = {
  OWNER: UserRole.Owner,
  owner: UserRole.Owner,
  ADMIN: UserRole.Admin,
  admin: UserRole.Admin,
  APPROVER: UserRole.Approver,
  approver: UserRole.Approver,
  AUDITOR: UserRole.Auditor,
  auditor: UserRole.Auditor,
  DEVELOPER: UserRole.Developer,
  developer: UserRole.Developer
};

export function normalizeRole(role: string | undefined): UserRole | undefined {
  return role ? roleMap[role] : undefined;
}
