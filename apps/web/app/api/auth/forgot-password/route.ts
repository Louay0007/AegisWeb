import { type NextRequest } from "next/server";
import { apiFetch, copyResponse } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return copyResponse(
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    }),
  );
}
