import { NextResponse, type NextRequest } from "next/server";

const SESSION_MARKER_COOKIE = "__Host-aegisweb_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  if (!pathname.startsWith("/app")) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  const hasSessionMarker = Boolean(request.cookies.get(SESSION_MARKER_COOKIE)?.value);
  if (hasSessionMarker) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
}

function withSecurityHeaders(response: NextResponse, nonce: string) {
  const apiOrigin = apiOriginFromEnv();
  response.headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://vitals.vercel-insights.com`,
  ].join("; "));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

function apiOriginFromEnv() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images%20\\(2\\)).*)"],
};
