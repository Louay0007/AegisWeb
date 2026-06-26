import { type NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return proxyWithSession(request, "/auth/mfa/disable", { method: "POST", body: await request.text(), headers: { "content-type": "application/json" } });
}
