import { NextResponse, type NextRequest } from "next/server";

import { createSession, clearSessionCookie, readSessionFromRequest, writeSessionCookie, type BffSession } from "@/lib/bff/session";

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; requestId?: string; details?: Record<string, unknown> };
  message?: string;
};

type AuthData = {
  accessToken: string;
  tokenType?: "Bearer";
  expiresInSeconds?: number;
  user?: unknown;
};

const REFRESH_COOKIE_NAME = "agentpass_refresh_token";

export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}, accessToken?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body !== undefined) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export async function refreshSession(session: BffSession): Promise<BffSession | null> {
  const response = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) return null;

  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<AuthData>;
  const accessToken = json.data?.accessToken;
  const refreshToken = extractRefreshToken(response) ?? session.refreshToken;
  if (!accessToken) return null;
  return createSession(accessToken, refreshToken);
}

export async function proxyWithSession(request: NextRequest, path: string, init: RequestInit): Promise<NextResponse> {
  const session = readSessionFromRequest(request);
  if (!session) return unauthorized();

  const first = await apiFetch(path, init, session.accessToken);
  if (first.status !== 401 && first.status !== 403) return copyResponse(first);

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    const response = unauthorized();
    clearSessionCookie(response);
    return response;
  }

  const retried = await apiFetch(path, init, refreshed.accessToken);
  const response = await copyResponse(retried);
  writeSessionCookie(response, refreshed);
  return response;
}

export async function parseAuthResponse(response: Response): Promise<{ session: BffSession; data: AuthData } | null> {
  if (!response.ok) return null;
  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<AuthData>;
  const accessToken = json.data?.accessToken;
  const refreshToken = extractRefreshToken(response);
  if (!accessToken || !refreshToken || !json.data) return null;
  return { session: createSession(accessToken, refreshToken), data: json.data };
}

export async function copyResponse(response: Response): Promise<NextResponse> {
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.delete("content-encoding");
  return new NextResponse(body, { status: response.status, headers });
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
}

export async function bodyFromRequest(request: NextRequest): Promise<BodyInit | undefined> {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const text = await request.text();
  return text.length ? text : undefined;
}

export function extractRefreshToken(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;,]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
