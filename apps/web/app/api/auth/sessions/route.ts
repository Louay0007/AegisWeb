import { type NextRequest } from "next/server";
import { proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyWithSession(request, "/auth/sessions", { method: "GET" });
}
