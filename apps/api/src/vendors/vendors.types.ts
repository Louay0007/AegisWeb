import { Prisma, Vendor } from '@prisma/client';
import { fromPrismaConnectorType } from './vendor-connector-type-mapping.js';
import { fromPrismaVendorCategory } from './vendor-category-mapping.js';

export type VendorRiskProfile = {
  level: 'low' | 'medium' | 'high' | 'blocked';
  reasons: string[];
};

export type VendorDto = {
  id: string;
  organizationId: string;
  name: string;
  website: string;
  category: string;
  connectorType: string;
  renewalDate: string | null;
  monthlyCostCents: number | null;
  ownerUserId: string | null;
  metadataJson: Prisma.JsonValue;
  riskProfile: VendorRiskProfile;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toVendorDto(vendor: Vendor, riskProfile: VendorRiskProfile): VendorDto {
  return {
    id: vendor.id,
    organizationId: vendor.organizationId,
    name: vendor.name,
    website: vendor.website,
    category: fromPrismaVendorCategory(vendor.category),
    connectorType: fromPrismaConnectorType(vendor.connectorType),
    renewalDate: vendor.renewalDate?.toISOString().slice(0, 10) ?? null,
    monthlyCostCents: vendor.monthlyCostCents,
    ownerUserId: vendor.ownerUserId,
    metadataJson: vendor.metadataJson,
    riskProfile,
    deletedAt: vendor.deletedAt?.toISOString() ?? null,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString()
  };
}
