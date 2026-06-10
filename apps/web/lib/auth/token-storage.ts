"use client";

import { isProductionRuntime } from "@/lib/runtime-config";

const ACCESS_TOKEN_KEY = "aegisweb.access_token";
const LEGACY_SESSION_KEY = "aegisweb.session";
const SESSION_MARKER_KEY = "aegisweb_session";

function tokenMemory() {
  return globalThis as typeof globalThis & {
    __aegiswebAccessToken?: string | null;
  };
}

export function readAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  if (isProductionRuntime()) {
    return tokenMemory().__aegiswebAccessToken ?? null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(token: string) {
  tokenMemory().__aegiswebAccessToken = token || null;
  if (isProductionRuntime()) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  tokenMemory().__aegiswebAccessToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function readLegacySession(): unknown | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = localStorage.getItem(LEGACY_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveLegacySession(session: unknown) {
  localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(sanitizeStoredSession(session)));
  writeSessionMarker(session);
}

export function clearLegacySession() {
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function clearStoredSession() {
  clearAccessToken();
  clearLegacySession();
  clearSessionMarker();
}

function writeSessionMarker(session: unknown): void {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = session && typeof session === "object" && (session as { mode?: unknown }).mode === "api"
    ? 60 * 60 * 24 * 30
    : 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_MARKER_KEY}=1; Path=/app; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearSessionMarker(): void {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_MARKER_KEY}=; Path=/app; SameSite=Lax; Max-Age=0${secure}`;
}

function sanitizeStoredSession(session: unknown): unknown {
  if (!isProductionRuntime()) {
    return session;
  }

  if (!session || typeof session !== "object") {
    return session;
  }

  const maybeSession = session as { mode?: unknown; accessToken?: unknown };
  if (maybeSession.mode === "api") {
    return { ...maybeSession, accessToken: null };
  }

  return session;
}
