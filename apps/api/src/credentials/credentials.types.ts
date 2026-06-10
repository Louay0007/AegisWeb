import { Credential, CredentialAgentGrant } from '@prisma/client';
import { fromPrismaCredentialStatus, fromPrismaCredentialType } from './credential-type-mapping.js';

export type CredentialGrantDto = {
  id: string;
  credentialId: string;
  agentId: string;
  scope: string;
  createdByUserId: string;
  createdAt: string;
  revokedAt: string | null;
};

export type CredentialDto = {
  id: string;
  organizationId: string;
  vendorId: string;
  label: string;
  credentialType: string;
  encryptionVersion: string;
  status: string;
  lastUsedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  grants?: CredentialGrantDto[];
};

export function toCredentialDto(
  credential: Credential & { grants?: CredentialAgentGrant[] }
): CredentialDto {
  return {
    id: credential.id,
    organizationId: credential.organizationId,
    vendorId: credential.vendorId,
    label: credential.label,
    credentialType: fromPrismaCredentialType(credential.credentialType),
    encryptionVersion: credential.encryptionVersion,
    status: fromPrismaCredentialStatus(credential.status),
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    createdByUserId: credential.createdByUserId,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
    revokedAt: credential.revokedAt?.toISOString() ?? null,
    grants: credential.grants?.map(toCredentialGrantDto)
  };
}

export function toCredentialGrantDto(grant: CredentialAgentGrant): CredentialGrantDto {
  return {
    id: grant.id,
    credentialId: grant.credentialId,
    agentId: grant.agentId,
    scope: grant.scope,
    createdByUserId: grant.createdByUserId,
    createdAt: grant.createdAt.toISOString(),
    revokedAt: grant.revokedAt?.toISOString() ?? null
  };
}
