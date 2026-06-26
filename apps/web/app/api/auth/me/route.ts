import { type NextRequest } from "next/server";

import { apiFetch, copyResponse, refreshSession, unauthorized } from "@/lib/bff/bff-client";
import { clearSessionCookie, readSessionFromRequest, writeSessionCookie } from "@/lib/bff/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return unauthorized();

  const response = await apiFetch("/auth/me", { method: "GET" }, session.accessToken);
  if (response.status !== 401 && response.status !== 403) return copyResponse(response);

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    const clientResponse = unauthorized();
    clearSessionCookie(clientResponse);
    return clientResponse;
  }

  const retried = await apiFetch("/auth/me", { method: "GET" }, refreshed.accessToken);
  const clientResponse = await copyResponse(retried);
  writeSessionCookie(clientResponse, refreshed);
  return clientResponse;
}
