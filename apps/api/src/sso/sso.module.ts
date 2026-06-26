import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller.js';
import { SsoService } from './sso.service.js';

@Module({
  controllers: [SsoController],
  providers: [SsoService]
})
export class SsoModule {}
