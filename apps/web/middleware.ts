import { NextResponse, type NextRequest } from "next/server";

const SECURE_SESSION_COOKIE = "__Host-aegisweb_session";
const INSECURE_SESSION_COOKIE = "aegisweb_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const insecureHttp = isInsecureHttpDemo();
  const apiOrigin = apiOriginFromEnv();
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    // Next.js extracts this nonce from the *request* CSP and stamps framework scripts.
    // strict-dynamic lets nonce-bearing scripts load their children without per-script nonces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // A style nonce makes browsers ignore 'unsafe-inline'; keep styles usable for CSS-in-JS / next-themes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://vitals.vercel-insights.com`,
    insecureHttp ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Required: Next.js reads CSP from the incoming request during SSR to apply nonces.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const next = () =>
    withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      contentSecurityPolicy,
      insecureHttp,
    );

  if (!pathname.startsWith("/app")) {
    return next();
  }

  const hasSessionMarker = Boolean(
    request.cookies.get(SECURE_SESSION_COOKIE)?.value ||
      request.cookies.get(INSECURE_SESSION_COOKIE)?.value,
  );
  if (hasSessionMarker) {
    return next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return withSecurityHeaders(NextResponse.redirect(loginUrl), contentSecurityPolicy, insecureHttp);
}

function withSecurityHeaders(
  response: NextResponse,
  contentSecurityPolicy: string,
  insecureHttp: boolean,
) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (process.env.NODE_ENV === "production" && !insecureHttp) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

function isInsecureHttpDemo() {
  if (process.env.SESSION_COOKIE_SECURE === "false") return true;
  const dashboard = process.env.DASHBOARD_BASE_URL ?? "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  return dashboard.startsWith("http://") || apiUrl.startsWith("http://");
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
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|images%20\\(2\\)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
