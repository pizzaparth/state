"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { isOwnerCode, signInOwner } from "@/lib/auth/owner";
import { DEMO_COOKIE } from "@/lib/demo/cookie";
import { consumeThrottle } from "@/lib/security/throttle";

/**
 * Session actions: owner sign-in by access code, and signing out. A demo has no server
 * session: it runs in the visitor's browser (lib/demo/local.ts).
 * Server Actions are public POST endpoints; each one validates and throttles itself.
 * Next.js rejects cross-site calls by comparing Origin with Host.
 */

export type SessionResult = { ok: true } | { ok: false; error: string };

const codeSchema = z.strictObject({ code: z.string().trim().min(1, "Enter your access code.").max(128, "That code is not valid.") });

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel overwrites x-forwarded-for at the edge; the first entry is the client
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function clearAuthCookies() {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name.includes("better-auth.")) jar.set(name, "", { maxAge: 0, path: "/", secure: name.startsWith("__Secure-") });
  }
}

export async function signInOwnerAction(input: unknown): Promise<SessionResult> {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your access code." };
  try {
    // Per IP, and overall: rotating addresses cannot run a guessing campaign
    const ip = await clientIp();
    if (!(await consumeThrottle(`owner-code:${ip}`, 5, 15 * 60)) || !(await consumeThrottle("owner-code", 30, 15 * 60))) {
      return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
    }
    if (!isOwnerCode(parsed.data.code)) return { ok: false, error: "That code is not valid." };
    // Signing in from inside a demo leaves it; its browser data goes with the next demo
    (await cookies()).delete(DEMO_COOKIE);
    await clearAuthCookies();
    await signInOwner(parsed.data.code, await headers());
    return { ok: true };
  } catch (error) {
    console.error("[session] owner sign-in", error);
    return { ok: false, error: "Could not sign in. Try again." };
  }
}

/** Signs the owner out. */
export async function signOutAction(): Promise<SessionResult> {
  try {
    const session = await getSession();
    if (session) await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
    await clearAuthCookies();
    return { ok: true };
  } catch (error) {
    console.error("[session] sign out", error);
    return { ok: false, error: "Could not sign out. Try again." };
  }
}
