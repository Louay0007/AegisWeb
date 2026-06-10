import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType } from '@prisma/client';
import { DomainError, DomainErrorCode, UserRole } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { toOrganizationDto } from './organization.types.js';

export type UpdateOrganizationInput = {
  name?: string;
  domain?: string;
};

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async getCurrentOrganization(organizationId: string | undefined) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const organization = await this.database.client.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new DomainError(DomainErrorCode.NotFound, 'Organization was not found.');
    }

    return { data: toOrganizationDto(organization) };
  }

  async updateCurrentOrganization(currentUser: ContextUser | undefined, input: UpdateOrganizationInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    if (currentUser.role !== UserRole.Owner) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Only owners can update the organization.');
    }

    const organization = await this.database.client.organization.update({
      where: { id: currentUser.organizationId },
      data: {
        name: input.name,
        domain: input.domain
      }
    });

    await this.audit.record({
      organizationId: organization.id,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.ORGANIZATION_UPDATED,
      eventDataJson: {
        name: organization.name,
        domain: organization.domain
      }
    });

    return { data: toOrganizationDto(organization) };
  }
}
