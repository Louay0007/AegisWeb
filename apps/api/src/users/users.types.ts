import { User } from '@prisma/client';

export type UserDto = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
};

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    disabledAt: user.disabledAt?.toISOString() ?? null
  };
}
