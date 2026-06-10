import { Injectable } from '@nestjs/common';
import { Prisma, Vendor, VendorCategory } from '@prisma/client';
import { VendorRiskProfile } from './vendors.types.js';

@Injectable()
export class VendorRiskProfileService {
  build(vendor: Vendor): VendorRiskProfile {
    const metadataRisk = readMetadataRisk(vendor.metadataJson);

    if (metadataRisk) {
      return {
        level: metadataRisk,
        reasons: [`Metadata risk is ${metadataRisk}.`]
      };
    }

    if (vendor.category === VendorCategory.PAYROLL) {
      return {
        level: 'blocked',
        reasons: ['Payroll vendors are blocked for MVP automation by default.']
      };
    }

    if ((vendor.monthlyCostCents ?? 0) >= 100000) {
      return {
        level: 'high',
        reasons: ['Monthly spend is at least $1,000.']
      };
    }

    if ((vendor.monthlyCostCents ?? 0) >= 50000) {
      return {
        level: 'medium',
        reasons: ['Monthly spend is at least $500.']
      };
    }

    return {
      level: 'low',
      reasons: ['No elevated risk signals.']
    };
  }
}

function readMetadataRisk(metadata: Prisma.JsonValue): VendorRiskProfile['level'] | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const risk = metadata.risk;
  return risk === 'low' || risk === 'medium' || risk === 'high' || risk === 'blocked' ? risk : undefined;
}
