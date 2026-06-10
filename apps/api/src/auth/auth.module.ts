import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SessionAuditService } from './session-audit.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, RefreshTokenService, SessionAuditService],
  exports: [AuthService, PasswordService, TokenService, RefreshTokenService]
})
export class AuthModule {}
