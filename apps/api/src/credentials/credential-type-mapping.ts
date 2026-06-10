import {
  CredentialStatus as PrismaCredentialStatus,
  CredentialType as PrismaCredentialType
} from '@prisma/client';
import { CredentialStatus, CredentialType } from '@agentpass/domain';

export function toPrismaCredentialType(type: CredentialType): PrismaCredentialType {
  switch (type) {
    case CredentialType.UsernamePassword:
      return PrismaCredentialType.USERNAME_PASSWORD;
    case CredentialType.TotpSecret:
      return PrismaCredentialType.TOTP_SECRET;
    case CredentialType.ApiToken:
      return PrismaCredentialType.API_TOKEN;
    case CredentialType.OAuthToken:
      return PrismaCredentialType.OAUTH_TOKEN;
    case CredentialType.SessionCookie:
      return PrismaCredentialType.SESSION_COOKIE;
  }
}

export function fromPrismaCredentialType(type: PrismaCredentialType): CredentialType {
  switch (type) {
    case PrismaCredentialType.USERNAME_PASSWORD:
      return CredentialType.UsernamePassword;
    case PrismaCredentialType.TOTP_SECRET:
      return CredentialType.TotpSecret;
    case PrismaCredentialType.API_TOKEN:
      return CredentialType.ApiToken;
    case PrismaCredentialType.OAUTH_TOKEN:
      return CredentialType.OAuthToken;
    case PrismaCredentialType.SESSION_COOKIE:
      return CredentialType.SessionCookie;
  }
}

export function fromPrismaCredentialStatus(status: PrismaCredentialStatus): CredentialStatus {
  switch (status) {
    case PrismaCredentialStatus.ACTIVE:
      return CredentialStatus.Active;
    case PrismaCredentialStatus.REVOKED:
      return CredentialStatus.Revoked;
    case PrismaCredentialStatus.ROTATED:
      return CredentialStatus.Rotated;
  }
}
