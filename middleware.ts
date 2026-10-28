import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic gate only: checks cookie presence, not validity. Every page, Server Action
// and Route Handler under (app) must still verify the session and subscription server-side.
export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // better-auth/cookies pulls in jose, which uses Node-only APIs
  runtime: "nodejs",
  matcher: [
    "/today/:path*",
    "/inbox/:path*",
    "/activity/:path*",
    "/history/:path*",
    "/metrics/:path*",
    "/personal/:path*",
    "/org/:path*",
    "/projects/:path*",
    "/settings/:path*",
  ],
};
