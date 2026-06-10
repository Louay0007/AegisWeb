import { Module } from '@nestjs/common';
import { VendorSandboxController } from './vendor-sandbox.controller.js';

@Module({
  controllers: [VendorSandboxController]
})
export class VendorSandboxModule {}
