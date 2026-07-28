import { type NextRequest } from "next/server";

import { bodyFromRequest, proxyWithSession } from "@/lib/bff/bff-client";

export const runtime = "nodejs";

async function handle(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const targetPath = `/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const requestId = request.headers.get("x-request-id");
  const stepUpToken = request.headers.get("x-step-up-token");
  if (contentType) headers.set("content-type", contentType);
  if (requestId) headers.set("x-request-id", requestId);
  if (stepUpToken) headers.set("x-step-up-token", stepUpToken);
  return proxyWithSession(request, targetPath, {
    method: request.method,
    headers,
    body: await bodyFromRequest(request),
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
