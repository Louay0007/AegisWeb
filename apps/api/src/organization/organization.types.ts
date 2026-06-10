import { Organization } from '@prisma/client';

export type OrganizationDto = {
  id: string;
  name: string;
  domain: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
};

export function toOrganizationDto(organization: Organization): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    domain: organization.domain,
    plan: organization.plan,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString()
  };
}
