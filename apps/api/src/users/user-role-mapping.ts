import { UserRole as PrismaUserRole } from '@prisma/client';
import { UserRole } from '@agentpass/domain';

export function toPrismaUserRole(role: UserRole): PrismaUserRole {
  switch (role) {
    case UserRole.Owner:
      return PrismaUserRole.OWNER;
    case UserRole.Admin:
      return PrismaUserRole.ADMIN;
    case UserRole.Approver:
      return PrismaUserRole.APPROVER;
    case UserRole.Auditor:
      return PrismaUserRole.AUDITOR;
    case UserRole.Developer:
      return PrismaUserRole.DEVELOPER;
  }
}

export function fromPrismaUserRole(role: PrismaUserRole): UserRole {
  switch (role) {
    case PrismaUserRole.OWNER:
      return UserRole.Owner;
    case PrismaUserRole.ADMIN:
      return UserRole.Admin;
    case PrismaUserRole.APPROVER:
      return UserRole.Approver;
    case PrismaUserRole.AUDITOR:
      return UserRole.Auditor;
    case PrismaUserRole.DEVELOPER:
      return UserRole.Developer;
  }
}
