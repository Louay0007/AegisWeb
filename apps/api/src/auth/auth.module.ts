import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SessionAuditService } from './session-audit.service.js';
import { StepUpController } from './step-up.controller.js';
import { StepUpService } from './step-up.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [AuthController, MfaController, StepUpController],
  providers: [AuthService, MfaService, StepUpService, PasswordService, TokenService, RefreshTokenService, SessionAuditService],
  exports: [AuthService, PasswordService, TokenService, RefreshTokenService, StepUpService]
})
export class AuthModule {}
