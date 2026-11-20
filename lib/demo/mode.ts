import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { demoIdFromCookieHeader } from "./cookie";

/**
 * True when this request comes from a demo tab: a demo cookie and no owner session
 * cookie (the owner always wins). Reads cookies only; no database.
 */
export async function isDemoRequest(): Promise<boolean> {
  const h = await headers();
  return !getSessionCookie(h) && demoIdFromCookieHeader(h.get("cookie")) !== null;
}
