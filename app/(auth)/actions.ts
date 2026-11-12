"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { isOwnerCode, signInOwner } from "@/lib/auth/owner";
import { endDemo, startDemo } from "@/lib/demo/session";
import { consumeThrottle } from "@/lib/security/throttle";
import { isTimeZone } from "@/lib/tz";

/**
 * Session actions: owner sign-in by access code, starting a demo, and signing out.
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
    // Signing in from inside a demo ends that demo
    const current = await getSession();
    if (current) await endDemo(current.user.id);
    await clearAuthCookies();
    await signInOwner(parsed.data.code, await headers());
    return { ok: true };
  } catch (error) {
    console.error("[session] owner sign-in", error);
    return { ok: false, error: "Could not sign in. Try again." };
  }
}

const demoSchema = z.strictObject({ timezone: z.string().max(64).refine(isTimeZone).optional() }).optional();

/** Starts a demo. The browser's time zone is set silently at seed time (UTC if missing or unknown). */
export async function startDemoAction(input?: unknown): Promise<SessionResult & { userId?: string }> {
  const parsed = demoSchema.safeParse(input);
  const timezone = (parsed.success && parsed.data?.timezone) || "UTC";
  try {
    const session = await getSession();
    // Already inside a demo (or signed in as the owner): keep that session
    if (session) return { ok: true, userId: session.user.id };
    const ip = await clientIp();
    if (!(await consumeThrottle(`demo:${ip}`, 10, 60 * 60)) || !(await consumeThrottle("demo", 300, 60 * 60))) {
      return { ok: false, error: "Too many demos started from here. Try again in an hour." };
    }
    const { userId } = await startDemo(await headers(), timezone);
    return { ok: true, userId };
  } catch (error) {
    console.error("[session] start demo", error);
    return { ok: false, error: "Could not start the demo. Try again." };
  }
}

/** Signs out. A demo account is deleted with everything it holds. */
export async function signOutAction(): Promise<SessionResult> {
  try {
    const session = await getSession();
    if (session) {
      await endDemo(session.user.id);
      // The owner's session row; a demo's went with its account
      await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
    }
    await clearAuthCookies();
    return { ok: true };
  } catch (error) {
    console.error("[session] sign out", error);
    return { ok: false, error: "Could not sign out. Try again." };
  }
}
