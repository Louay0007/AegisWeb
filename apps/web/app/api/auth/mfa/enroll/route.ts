import { type NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return proxyWithSession(request, "/auth/mfa/enroll", { method: "POST", body: "{}" });
}
