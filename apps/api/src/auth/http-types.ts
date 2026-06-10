import { HeaderValue } from '../request-context/types.js';

export type HeaderReader = {
  headers?: Record<string, HeaderValue>;
};

export type CookieResponse = {
  setHeader(name: string, value: string | string[]): void;
};

export function readCookie(headers: Record<string, HeaderValue> | undefined, name: string): string | undefined {
  const cookieHeader = headers?.cookie;
  const cookies = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;

  if (!cookies) {
    return undefined;
  }

  return cookies
    .split(';')
    .map((entry) => entry.trim())
    .map((entry) => {
      const separatorIndex = entry.indexOf('=');
      return separatorIndex === -1
        ? [entry, '']
        : [entry.slice(0, separatorIndex), decodeURIComponent(entry.slice(separatorIndex + 1))];
    })
    .find(([key]) => key === name)?.[1];
}

export function readAuthorizationBearer(headers: Record<string, HeaderValue> | undefined): string | undefined {
  const value = headers?.authorization ?? headers?.Authorization;
  const authorization = Array.isArray(value) ? value[0] : value;

  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorization.slice('Bearer '.length);
}

export function readHeader(headers: Record<string, HeaderValue> | undefined, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === lowerName)?.[1];
  return Array.isArray(value) ? value[0] : value;
}
