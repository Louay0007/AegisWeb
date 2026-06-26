import { type NextRequest } from "next/server";
import { proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(request, `/auth/sessions/${encodeURIComponent(id)}/revoke`, { method: "POST" });
}
