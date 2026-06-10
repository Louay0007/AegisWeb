import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { DomainError, DomainErrorCode } from "@agentpass/domain";
import { PublicRoute } from "../authorization/authorization-metadata.js";
import { ConfigService } from "../config/config.service.js";
import { AuthService } from "./auth.service.js";
import {
  CookieResponse,
  HeaderReader,
  readAuthorizationBearer,
  readCookie,
  readHeader,
} from "./http-types.js";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from "./dto.js";

const REFRESH_COOKIE_NAME = "agentpass_refresh_token";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @PublicRoute()
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.authService.register(
      parseOrThrow(registerSchema, body),
    );
    writeRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenMaxAgeSeconds,
      this.configService.config.nodeEnv,
    );
    return resultWithoutRefreshToken(result);
  }

  @PublicRoute()
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.authService.login(
      parseOrThrow(loginSchema, body),
    );
    writeRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenMaxAgeSeconds,
      this.configService.config.nodeEnv,
    );
    return resultWithoutRefreshToken(result);
  }

  @PublicRoute()
  @Post("refresh")
  async refresh(
    @Body() body: unknown,
    @Req() request: HeaderReader,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(
      request.headers,
      this.configService.config.allowedOrigins,
    );
    const dto = parseOrThrow(refreshSchema, body ?? {});
    const refreshToken =
      dto.refreshToken ?? readCookie(request.headers, REFRESH_COOKIE_NAME);

    if (!refreshToken) {
      throw new DomainError(
        DomainErrorCode.PermissionDenied,
        "Refresh token is required.",
      );
    }

    const result = await this.authService.refresh(refreshToken);
    writeRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenMaxAgeSeconds,
      this.configService.config.nodeEnv,
    );
    return resultWithoutRefreshToken(result);
  }

  @PublicRoute()
  @Post("logout")
  async logout(
    @Body() body: unknown,
    @Req() request: HeaderReader,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertTrustedOrigin(
      request.headers,
      this.configService.config.allowedOrigins,
    );
    const dto = parseOrThrow(logoutSchema, body ?? {});
    const refreshToken =
      dto.refreshToken ?? readCookie(request.headers, REFRESH_COOKIE_NAME);
    const accessToken = readAuthorizationBearer(headers);
    clearRefreshCookie(response, this.configService.config.nodeEnv);
    return this.authService.logout(refreshToken, accessToken);
  }

  @Get("me")
  async me(@Headers() headers: Record<string, string | string[] | undefined>) {
    return this.authService.me(readAuthorizationBearer(headers));
  }
}

function parseOrThrow<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new DomainError(
      DomainErrorCode.ValidationFailed,
      "Invalid request body.",
    );
  }

  return parsed.data;
}

function writeRefreshCookie(
  response: CookieResponse,
  token: string,
  maxAgeSeconds: number,
  nodeEnv: string,
): void {
  response.setHeader("set-cookie", [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=${maxAgeSeconds}${secureCookieSuffix(nodeEnv)}`,
  ]);
}

function clearRefreshCookie(response: CookieResponse, nodeEnv: string): void {
  response.setHeader("set-cookie", [
    `${REFRESH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=0${secureCookieSuffix(nodeEnv)}`,
  ]);
}

function secureCookieSuffix(nodeEnv: string): string {
  return nodeEnv === "production" ? "; Secure" : "";
}

function assertTrustedOrigin(
  headers: HeaderReader["headers"],
  allowedOrigins: readonly string[],
): void {
  const origin = readHeader(headers, "origin");
  const referer = readHeader(headers, "referer");

  if (!origin && !referer) {
    return;
  }

  const trusted = origin
    ? allowedOrigins.includes(origin)
    : isTrustedReferer(referer, allowedOrigins);

  if (!trusted) {
    throw new DomainError(
      DomainErrorCode.PermissionDenied,
      "Request origin is not allowed.",
    );
  }
}

function isTrustedReferer(
  referer: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!referer) {
    return false;
  }

  try {
    const url = new URL(referer);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

function resultWithoutRefreshToken<T extends { data: unknown }>(
  result: T,
): Pick<T, "data"> {
  return { data: result.data };
}
