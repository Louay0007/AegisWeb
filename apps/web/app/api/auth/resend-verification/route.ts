import { type NextRequest } from "next/server";
import { bodyFromRequest, proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return proxyWithSession(request, "/auth/resend-verification", {
    method: "POST",
    body: await bodyFromRequest(request),
  });
}
