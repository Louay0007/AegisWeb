import { NextResponse, type NextRequest } from "next/server";

import { refreshSession, unauthorized } from "@/lib/bff/bff-client";
import { clearSessionCookie, readSessionFromRequest, writeSessionCookie } from "@/lib/bff/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return unauthorized();
  const refreshed = await refreshSession(session);
  if (!refreshed) {
    const response = unauthorized();
    clearSessionCookie(response);
    return response;
  }
  const response = new NextResponse(null, { status: 204 });
  writeSessionCookie(response, refreshed);
  return response;
}
