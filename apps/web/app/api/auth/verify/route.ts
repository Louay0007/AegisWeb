import { type NextRequest } from "next/server";
import { apiFetch, copyResponse } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return copyResponse(await apiFetch(`/auth/verify${request.nextUrl.search}`, { method: "GET" }));
}
