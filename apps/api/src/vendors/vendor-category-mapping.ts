import { VendorCategory as PrismaVendorCategory } from '@prisma/client';
import { VendorCategory } from '@agentpass/domain';

export function toPrismaVendorCategory(category: VendorCategory): PrismaVendorCategory {
  switch (category) {
    case VendorCategory.Analytics:
      return PrismaVendorCategory.ANALYTICS;
    case VendorCategory.Productivity:
      return PrismaVendorCategory.PRODUCTIVITY;
    case VendorCategory.Sales:
      return PrismaVendorCategory.SALES;
    case VendorCategory.Payroll:
      return PrismaVendorCategory.PAYROLL;
    case VendorCategory.Finance:
      return PrismaVendorCategory.FINANCE;
    case VendorCategory.Security:
      return PrismaVendorCategory.SECURITY;
    case VendorCategory.Other:
      return PrismaVendorCategory.OTHER;
  }
}

export function fromPrismaVendorCategory(category: PrismaVendorCategory): VendorCategory {
  switch (category) {
    case PrismaVendorCategory.ANALYTICS:
      return VendorCategory.Analytics;
    case PrismaVendorCategory.PRODUCTIVITY:
      return VendorCategory.Productivity;
    case PrismaVendorCategory.SALES:
      return VendorCategory.Sales;
    case PrismaVendorCategory.PAYROLL:
      return VendorCategory.Payroll;
    case PrismaVendorCategory.FINANCE:
      return VendorCategory.Finance;
    case PrismaVendorCategory.SECURITY:
      return VendorCategory.Security;
    case PrismaVendorCategory.OTHER:
      return VendorCategory.Other;
  }
}
