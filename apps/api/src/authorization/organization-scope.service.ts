import { Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';

@Injectable()
export class OrganizationScopeService {
  assertSameOrganization(authenticatedOrganizationId: string | undefined, resourceOrganizationId: string): void {
    if (!authenticatedOrganizationId || authenticatedOrganizationId !== resourceOrganizationId) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Resource belongs to another organization.');
    }
  }

  whereFor<T extends object>(organizationId: string | undefined, where: T): T & { organizationId: string } {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    return {
      ...where,
      organizationId
    };
  }
}
