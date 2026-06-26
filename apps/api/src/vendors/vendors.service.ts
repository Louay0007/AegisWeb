import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, AuditEventType, Prisma } from '@prisma/client';
import { DomainError, DomainErrorCode, VendorCategory, VENDOR_CATEGORIES } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { PageQuery, pageToSkip, paginationMeta } from '../common/pagination.js';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';
import { toPrismaVendorCategory } from './vendor-category-mapping.js';
import { VendorRiskProfileService } from './vendor-risk-profile.service.js';
import { VendorUrlService } from './vendor-url.service.js';
import { toVendorDto } from './vendors.types.js';

export type CreateVendorInput = {
  name: string;
  website: string;
  category: VendorCategory;
  renewalDate?: string;
  monthlyCostCents?: number;
  ownerUserId?: string;
  metadataJson?: Prisma.InputJsonObject;
};

export type UpdateVendorInput = Partial<CreateVendorInput>;

@Injectable()
export class VendorsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VendorUrlService) private readonly urls: VendorUrlService,
    @Inject(VendorRiskProfileService) private readonly riskProfiles: VendorRiskProfileService
  ) {}

  async list(organizationId: string | undefined, page: PageQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where = { organizationId, deletedAt: null };
    const [vendors, total] = await Promise.all([
      this.database.client.vendor.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip: pageToSkip(page),
        take: page.limit
      }),
      this.database.client.vendor.count({ where })
    ]);

    return { data: vendors.map((vendor) => toVendorDto(vendor, this.riskProfiles.build(vendor))), meta: paginationMeta(total, page) };
  }

  async get(organizationId: string | undefined, id: string) {
    const vendor = await this.findVendorInOrganization(organizationId, id);
    return { data: toVendorDto(vendor, this.riskProfiles.build(vendor)) };
  }

  async create(currentUser: ContextUser | undefined, input: CreateVendorInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    this.assertKnownCategory(input.category);
    await this.assertOwnerInOrganization(currentUser.organizationId, input.ownerUserId);

    const website = this.urls.normalize(input.website);
    await this.assertNoActiveDuplicate(currentUser.organizationId, website);

    const vendor = await this.database.client.vendor.create({
      data: {
        organizationId: currentUser.organizationId,
        name: input.name,
        website,
        category: toPrismaVendorCategory(input.category),
        renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined,
        monthlyCostCents: input.monthlyCostCents,
        ownerUserId: input.ownerUserId,
        metadataJson: input.metadataJson ?? {}
      }
    });

    await this.recordVendorAudit(currentUser, AuditEventType.VENDOR_CREATED, {
      vendorId: vendor.id,
      name: vendor.name,
      website: vendor.website,
      category: input.category
    });

    return { data: toVendorDto(vendor, this.riskProfiles.build(vendor)) };
  }

  async update(currentUser: ContextUser | undefined, id: string, input: UpdateVendorInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findVendorInOrganization(currentUser.organizationId, id);

    if (input.category) {
      this.assertKnownCategory(input.category);
    }

    await this.assertOwnerInOrganization(currentUser.organizationId, input.ownerUserId);

    const nextWebsite = input.website ? this.urls.normalize(input.website) : undefined;

    if (nextWebsite && nextWebsite !== existing.website) {
      await this.assertNoActiveDuplicate(currentUser.organizationId, nextWebsite);
    }

    const vendor = await this.database.client.vendor.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        website: nextWebsite,
        category: input.category ? toPrismaVendorCategory(input.category) : undefined,
        renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined,
        monthlyCostCents: input.monthlyCostCents,
        ownerUserId: input.ownerUserId,
        metadataJson: input.metadataJson
      }
    });

    await this.recordVendorAudit(currentUser, AuditEventType.VENDOR_UPDATED, {
      vendorId: vendor.id,
      name: vendor.name,
      website: vendor.website
    });

    return { data: toVendorDto(vendor, this.riskProfiles.build(vendor)) };
  }

  async delete(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findVendorInOrganization(currentUser.organizationId, id);
    const workflowCount = await this.database.client.workflow.count({
      where: {
        organizationId: currentUser.organizationId,
        vendorId: existing.id
      }
    });

    if (workflowCount > 0) {
      const vendor = await this.database.client.vendor.update({
        where: { id: existing.id },
        data: { deletedAt: existing.deletedAt ?? new Date() }
      });
      await this.recordVendorAudit(currentUser, AuditEventType.VENDOR_DELETED, {
        vendorId: vendor.id,
        name: vendor.name,
        softDeleted: true
      });
      return { data: toVendorDto(vendor, this.riskProfiles.build(vendor)) };
    }

    await this.database.client.vendor.delete({
      where: { id: existing.id }
    });
    await this.recordVendorAudit(currentUser, AuditEventType.VENDOR_DELETED, {
      vendorId: existing.id,
      name: existing.name,
      softDeleted: false
    });

    return { data: { id: existing.id, deleted: true, softDeleted: false } };
  }

  private async findVendorInOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const vendor = await this.database.client.vendor.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null
      }
    });

    if (!vendor) {
      throw new DomainError(DomainErrorCode.NotFound, 'Vendor was not found.');
    }

    return vendor;
  }

  private async assertNoActiveDuplicate(organizationId: string, website: string): Promise<void> {
    const duplicate = await this.database.client.vendor.findFirst({
      where: {
        organizationId,
        website,
        deletedAt: null
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Active vendor website already exists.');
    }
  }

  private async assertOwnerInOrganization(organizationId: string, ownerUserId: string | undefined): Promise<void> {
    if (!ownerUserId) {
      return;
    }

    const owner = await this.database.client.user.findFirst({
      where: {
        id: ownerUserId,
        organizationId
      },
      select: { id: true }
    });

    if (!owner) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Vendor owner belongs to another organization.');
    }
  }

  private assertKnownCategory(category: VendorCategory): void {
    if (!VENDOR_CATEGORIES.includes(category)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Vendor category must be known.');
    }
  }

  private async recordVendorAudit(
    currentUser: ContextUser,
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
