import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { demoIdFromCookieHeader } from "@/lib/demo/cookie";

/**
 * Runs only for product pages (/platform). Marketing and auth pages are prerendered and
 * served from the CDN with a static CSP (next.config.ts), so they skip middleware and its
 * function invocation entirely.
 */

/**
 * Per-request nonce CSP. 'strict-dynamic' lets nonce-bearing scripts load their own
 * dependencies (Next chunks) while blocking injected inline script. The demo runs
 * Postgres as WebAssembly in a worker (lib/demo/db/worker.ts): 'wasm-unsafe-eval' lets
 * it compile, and worker-src lets the worker start (a blob: URL under Turbopack).
 */
function contentSecurityPolicy(nonce: string, https: boolean) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
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
  // and Route Handler under (app) must still verify the session server-side. A demo has
  // no session, only its marker cookie: it gets the page shell, which loads its data in
  // the browser (lib/pages/render.tsx).
  if (!getSessionCookie(request) && !demoIdFromCookieHeader(request.headers.get("cookie"))) {
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
  // Product pages only; every other page carries the static CSP from next.config.ts
  matcher: ["/platform", "/platform/:path*"],
};
