import { NextResponse, type NextRequest } from "next/server";

import { apiFetch, copyResponse, json, parseAuthResponse } from "@/lib/bff/bff-client";
import { writeSessionCookie } from "@/lib/bff/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = await apiFetch("/auth/mfa/recovery", { method: "POST", body: await request.text(), headers: { "content-type": "application/json" } });
  if (!response.ok) return copyResponse(response);
  const parsed = await parseAuthResponse(response);
  if (!parsed?.data.user) return NextResponse.json({ error: { code: "AUTH_FAILED", message: "Recovery failed." } }, { status: 502 });
  const clientResponse = json({ user: parsed.data.user });
  writeSessionCookie(clientResponse, parsed.session);
  return clientResponse;
}
