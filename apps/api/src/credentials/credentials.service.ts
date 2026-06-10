import { Inject, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  AuditEventType,
  Credential,
  CredentialStatus as PrismaCredentialStatus,
  Prisma
} from '@prisma/client';
import { encryptSecret, EncryptedPayload, decryptSecret, PlainSecret, redactSecretLikeValues } from '@agentpass/vault';
import { CredentialType, DomainError, DomainErrorCode } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { toPrismaCredentialType } from './credential-type-mapping.js';
import { toCredentialDto, toCredentialGrantDto } from './credentials.types.js';

export type CreateCredentialInput = {
  vendorId: string;
  label: string;
  credentialType: CredentialType;
  secretJson: PlainSecret;
};

export type UpdateCredentialInput = {
  vendorId?: string;
  label?: string;
  credentialType?: CredentialType;
  secretJson?: PlainSecret;
};

export type CreateCredentialGrantInput = {
  agentId: string;
  scope: string;
};

export type DecryptForRunInput = {
  workflowRunId: string;
};

@Injectable()
export class CredentialsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async list(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const credentials = await this.database.client.credential.findMany({
      where: { organizationId },
      include: { grants: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { label: 'asc' }]
    });

    return { data: credentials.map(toCredentialDto) };
  }

  async get(organizationId: string | undefined, id: string) {
    const credential = await this.findCredentialInOrganization(organizationId, id);
    return { data: toCredentialDto(credential) };
  }

  async create(currentUser: ContextUser | undefined, input: CreateCredentialInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    await this.assertVendorInOrganization(currentUser.organizationId, input.vendorId);

    const credential = await this.database.transaction(async (tx) => {
      const created = await tx.credential.create({
        data: {
          organizationId: currentUser.organizationId,
          vendorId: input.vendorId,
          label: input.label,
          credentialType: toPrismaCredentialType(input.credentialType),
          encryptedPayload: {} as Prisma.InputJsonObject,
          encryptionVersion: 'pending',
          status: PrismaCredentialStatus.ACTIVE,
          createdByUserId: currentUser.id
        }
      });
      const encryptedPayload = encryptSecret(input.secretJson, this.config.config.vaultMasterKey, {
        organizationId: currentUser.organizationId,
        credentialId: created.id,
        keyVersion: 'local-v1'
      });

      return tx.credential.update({
        where: { id: created.id },
        data: {
          encryptedPayload: encryptedPayload as Prisma.InputJsonObject,
          encryptionVersion: encryptedPayload.key_version
        },
        include: { grants: true }
      });
    });

    await this.recordCredentialAudit(currentUser, credential, AuditEventType.CREDENTIAL_CREATED, {
      credentialId: credential.id,
      vendorId: credential.vendorId,
      label: credential.label,
      credentialType: input.credentialType
    });

    return { data: toCredentialDto(credential) };
  }

  async update(currentUser: ContextUser | undefined, id: string, input: UpdateCredentialInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findCredentialInOrganization(currentUser.organizationId, id);
    if (existing.status === PrismaCredentialStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Revoked credentials cannot be updated.');
    }

    if (input.vendorId) {
      await this.assertVendorInOrganization(currentUser.organizationId, input.vendorId);
    }

    const encryptedPayload = input.secretJson
      ? encryptSecret(input.secretJson, this.config.config.vaultMasterKey, {
          organizationId: currentUser.organizationId,
          credentialId: existing.id,
          keyVersion: nextKeyVersion(existing.encryptionVersion)
        })
      : undefined;

    const credential = await this.database.client.credential.update({
      where: { id: existing.id },
      data: {
        vendorId: input.vendorId,
        label: input.label,
        credentialType: input.credentialType ? toPrismaCredentialType(input.credentialType) : undefined,
        encryptedPayload: encryptedPayload as Prisma.InputJsonObject | undefined,
        encryptionVersion: encryptedPayload?.key_version,
        status: encryptedPayload ? PrismaCredentialStatus.ROTATED : undefined
      },
      include: { grants: { orderBy: { createdAt: 'asc' } } }
    });

    await this.recordCredentialAudit(currentUser, credential, AuditEventType.CREDENTIAL_UPDATED, {
      credentialId: credential.id,
      vendorId: credential.vendorId,
      label: credential.label,
      rotated: Boolean(encryptedPayload)
    });

    return { data: toCredentialDto(credential) };
  }

  async grant(currentUser: ContextUser | undefined, credentialId: string, input: CreateCredentialGrantInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const credential = await this.findCredentialInOrganization(currentUser.organizationId, credentialId);
    if (credential.status === PrismaCredentialStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Revoked credentials cannot be granted.');
    }

    await this.assertAgentInOrganization(currentUser.organizationId, input.agentId);

    const existingGrant = await this.database.client.credentialAgentGrant.findUnique({
      where: {
        credentialId_agentId: {
          credentialId,
          agentId: input.agentId
        }
      }
    });

    const grant = existingGrant
      ? await this.database.client.credentialAgentGrant.update({
          where: { id: existingGrant.id },
          data: {
            scope: input.scope,
            revokedAt: null,
            createdByUserId: currentUser.id
          }
        })
      : await this.database.client.credentialAgentGrant.create({
          data: {
            credentialId,
            agentId: input.agentId,
            scope: input.scope,
            createdByUserId: currentUser.id
          }
        });

    await this.recordCredentialAudit(currentUser, credential, AuditEventType.CREDENTIAL_GRANTED_TO_AGENT, {
      credentialId,
      grantId: grant.id,
      agentId: grant.agentId,
      scope: grant.scope
    });

    return { data: toCredentialGrantDto(grant) };
  }

  async revokeGrant(currentUser: ContextUser | undefined, credentialId: string, grantId: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const credential = await this.findCredentialInOrganization(currentUser.organizationId, credentialId);
    const grant = await this.database.client.credentialAgentGrant.findFirst({
      where: {
        id: grantId,
        credentialId: credential.id,
        credential: { organizationId: currentUser.organizationId }
      }
    });

    if (!grant) {
      throw new DomainError(DomainErrorCode.NotFound, 'Credential grant was not found.');
    }

    const revokedGrant = await this.database.client.credentialAgentGrant.update({
      where: { id: grant.id },
      data: { revokedAt: grant.revokedAt ?? new Date() }
    });

    await this.recordCredentialAudit(currentUser, credential, AuditEventType.CREDENTIAL_GRANT_REVOKED, {
      credentialId,
      grantId: revokedGrant.id,
      agentId: revokedGrant.agentId
    });

    return { data: toCredentialGrantDto(revokedGrant) };
  }

  async revoke(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findCredentialInOrganization(currentUser.organizationId, id);
    const credential = await this.database.client.credential.update({
      where: { id: existing.id },
      data: {
        status: PrismaCredentialStatus.REVOKED,
        revokedAt: existing.revokedAt ?? new Date()
      },
      include: { grants: { orderBy: { createdAt: 'asc' } } }
    });

    await this.recordCredentialAudit(currentUser, credential, AuditEventType.CREDENTIAL_REVOKED, {
      credentialId: credential.id,
      vendorId: credential.vendorId
    });

    return { data: toCredentialDto(credential) };
  }

  async decryptForRun(credentialId: string, input: DecryptForRunInput) {
    const credential = await this.database.client.credential.findUnique({
      where: { id: credentialId }
    });

    if (!credential) {
      throw new DomainError(DomainErrorCode.NotFound, 'Credential was not found.');
    }

    if (credential.status === PrismaCredentialStatus.REVOKED) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Credential is revoked.');
    }

    const workflowRun = await this.database.client.workflowRun.findFirst({
      where: {
        id: input.workflowRunId,
        organizationId: credential.organizationId
      }
    });

    if (!workflowRun) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Workflow run is not authorized for this credential.');
    }

    if (workflowRun.vendorId && workflowRun.vendorId !== credential.vendorId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Credential vendor does not match the workflow run.');
    }

    const grant = await this.database.client.credentialAgentGrant.findFirst({
      where: {
        credentialId: credential.id,
        agentId: workflowRun.agentId,
        revokedAt: null
      }
    });

    if (!grant) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Credential is not granted to the workflow agent.');
    }

    const plaintext = decryptSecret(credential.encryptedPayload as EncryptedPayload, this.config.config.vaultMasterKey, {
      organizationId: credential.organizationId,
      credentialId: credential.id,
      keyVersion: credential.encryptionVersion
    });
    await this.database.client.credential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() }
    });

    await this.audit.record({
      organizationId: credential.organizationId,
      workflowRunId: workflowRun.id,
      agentId: workflowRun.agentId,
      actorType: AuditActorType.WORKER,
      actorId: 'internal-worker',
      eventType: AuditEventType.CREDENTIAL_USED,
      eventDataJson: {
        credentialId: credential.id,
        vendorId: credential.vendorId,
        grantId: grant.id,
        scope: grant.scope,
        returnedSecretShape: redactSecretLikeValues(plaintext) as Prisma.InputJsonValue
      }
    });

    return {
      data: {
        credentialId: credential.id,
        workflowRunId: workflowRun.id,
        agentId: workflowRun.agentId,
        secretJson: plaintext
      }
    };
  }

  private async findCredentialInOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const credential = await this.database.client.credential.findFirst({
      where: { id, organizationId },
      include: { grants: { orderBy: { createdAt: 'asc' } } }
    });

    if (!credential) {
      throw new DomainError(DomainErrorCode.NotFound, 'Credential was not found.');
    }

    return credential;
  }

  private async assertVendorInOrganization(organizationId: string, vendorId: string): Promise<void> {
    const vendor = await this.database.client.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!vendor) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Credential vendor belongs to another organization.');
    }
  }

  private async assertAgentInOrganization(organizationId: string, agentId: string): Promise<void> {
    const agent = await this.database.client.agent.findFirst({
      where: {
        id: agentId,
        organizationId
      },
      select: { id: true }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Credential agent belongs to another organization.');
    }
  }

  private async recordCredentialAudit(
    currentUser: ContextUser,
    credential: Credential,
    eventType: AuditEventType,
    eventDataJson: Prisma.InputJsonObject
  ): Promise<void> {
    await this.audit.record({
      organizationId: currentUser.organizationId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType,
      eventDataJson
    });
  }
}

function nextKeyVersion(current: string): string {
  const match = current.match(/^local-v(\d+)$/);
  if (!match) {
    return 'local-v2';
  }

  return `local-v${Number(match[1]) + 1}`;
}
