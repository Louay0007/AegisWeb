import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "__Host-aegisweb_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type BffSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export function createSession(accessToken: string, refreshToken: string): BffSession {
  return { accessToken, refreshToken, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
}

export async function readSessionFromCookies(): Promise<BffSession | null> {
  const cookieStore = await cookies();
  return verifySessionValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function readSessionFromRequest(request: NextRequest): BffSession | null {
  return verifySessionValue(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function writeSessionCookie(response: NextResponse, session: BffSession): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signSession(session),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function signSession(session: BffSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function verifySessionValue(value: string | undefined): BffSession | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !safeEqual(mac, signature(payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<BffSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null;
    if (parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function signature(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function sessionSecret(): string {
  const secret = process.env.BFF_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BFF_SESSION_SECRET is required in production.");
  }
  return secret ?? "local-bff-session-secret-change-before-production";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
