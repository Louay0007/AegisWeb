import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { PublicRoute } from '../authorization/authorization-metadata.js';
import { ConfigService } from '../config/config.service.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { AuthService } from './auth.service.js';
import { CookieResponse } from './http-types.js';
import { mfaChallengeSchema, mfaDisableSchema, mfaRecoverySchema, mfaVerifySchema } from './dto.js';
import { MfaService } from './mfa.service.js';

const REFRESH_COOKIE_NAME = 'agentpass_refresh_token';

@Controller('auth/mfa')
export class MfaController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(MfaService) private readonly mfaService: MfaService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  @Post('enroll')
  enroll(@CurrentUser() currentUser: ContextUser | undefined) {
    return this.mfaService.enroll(currentUser);
  }

  @Post('verify')
  verify(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const dto = parseOrThrow(mfaVerifySchema, body);
    return this.mfaService.verifyEnrollment(currentUser, dto.code);
  }

  @Post('disable')
  disable(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const dto = parseOrThrow(mfaDisableSchema, body);
    return this.mfaService.disable(currentUser, dto.code);
  }

  @PublicRoute()
  @Post('challenge')
  async challenge(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.authService.completeMfaChallenge(parseOrThrow(mfaChallengeSchema, body));
    writeRefreshCookie(response, result.refreshToken, result.refreshTokenMaxAgeSeconds, this.configService.config.nodeEnv);
    return { data: result.data };
  }

  @PublicRoute()
  @Post('recovery')
  async recovery(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.authService.completeMfaRecovery(parseOrThrow(mfaRecoverySchema, body));
    writeRefreshCookie(response, result.refreshToken, result.refreshTokenMaxAgeSeconds, this.configService.config.nodeEnv);
    return { data: result.data };
  }
}

function parseOrThrow<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid request body.');
  return parsed.data;
}

function writeRefreshCookie(response: CookieResponse, token: string, maxAgeSeconds: number, nodeEnv: string): void {
  response.setHeader('set-cookie', [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=${maxAgeSeconds}${nodeEnv === 'production' ? '; Secure' : ''}`
  ]);
}
