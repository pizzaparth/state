import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Every product page lives under /platform
const PROTECTED_PREFIXES = ["/platform"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Per-request nonce CSP. 'strict-dynamic' lets nonce-bearing scripts load their own
 * dependencies (Next chunks) while blocking injected inline script.
 */
function contentSecurityPolicy(nonce: string, https: boolean) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Optimistic gate only: checks cookie presence, not validity. Every page, Server Action
  // and Route Handler under (app) must still verify the session and subscription server-side.
  if (isProtected(pathname) && !getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = contentSecurityPolicy(nonce, https);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the request CSP to attach the nonce to its own scripts
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // better-auth/cookies pulls in jose, which uses Node-only APIs
  runtime: "nodejs",
  // Every page; API routes return JSON and set their own headers
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
