import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { VendorRiskProfileService } from './vendor-risk-profile.service.js';
import { VendorUrlService } from './vendor-url.service.js';
import { VendorsController } from './vendors.controller.js';
import { VendorsService } from './vendors.service.js';

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorUrlService, VendorRiskProfileService],
  exports: [VendorsService, VendorUrlService, VendorRiskProfileService]
})
export class VendorsModule {}
