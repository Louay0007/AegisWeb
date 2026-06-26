import { NextResponse, type NextRequest } from "next/server";

import { apiFetch, copyResponse, extractRefreshToken, json } from "@/lib/bff/bff-client";
import { createSession, writeSessionCookie } from "@/lib/bff/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: await request.text(),
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
  });

  if (!response.ok) return copyResponse(response);
  const envelope = (await response.json().catch(() => ({}))) as { data?: { accessToken?: string; user?: unknown; mfaRequired?: boolean; tempToken?: string } };
  if (envelope.data?.mfaRequired) return json(envelope.data);
  const accessToken = envelope.data?.accessToken;
  const refreshToken = extractRefreshToken(response);
  if (!accessToken || !refreshToken || !envelope.data?.user) return NextResponse.json({ error: { code: "AUTH_FAILED", message: "Authentication failed." } }, { status: 502 });

  const clientResponse = json({ user: envelope.data.user });
  writeSessionCookie(clientResponse, createSession(accessToken, refreshToken));
  return clientResponse;
}
