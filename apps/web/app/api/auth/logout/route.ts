import { type NextRequest } from "next/server";

import { apiFetch, json } from "@/lib/bff/bff-client";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/bff/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (session) {
    await apiFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }, session.accessToken).catch(() => undefined);
  }
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
}
