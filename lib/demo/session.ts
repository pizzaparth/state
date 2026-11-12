import { randomBytes } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { provisionAccount } from "@/lib/accounts/provision";
import { seedDemoData } from "./seed";

/**
 * Throwaway demo accounts. Each "Take a demo" creates a new account with sample data and
 * signs it in for this browser session. Nothing is kept:
 *
 *   sign out          the account and everything it owns are deleted at once
 *   tab closed        the next visit finds no tab marker and ends the demo (DemoGuard)
 *   abandoned         accounts idle for DEMO_TTL_MS are deleted on every new demo
 *
 * Deleting the user row cascades through its workspace, tasks, commits and sessions.
 */
export const DEMO_TTL_MS = 6 * 60 * 60 * 1000;
const DEMO_DOMAIN = "demo.state.invalid";

/**
 * Deletes demo accounts idle past their lifetime: no session activity (or, with no
 * session, no account activity) for DEMO_TTL_MS. A visitor still working is never cut
 * off mid-session. Bounded per call; runs before each new demo.
 */
export async function pruneDemos(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - DEMO_TTL_MS);
  const lastActive = sql`coalesce((select max(${sessions.updatedAt}) from ${sessions} where ${sessions.userId} = ${users.id}), ${users.createdAt})`;
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isDemo, true), lt(users.createdAt, cutoff), sql`${lastActive} < ${cutoff}`))
    .limit(100);
  for (const { id } of stale) await db.delete(users).where(eq(users.id, id));
  return stale.length;
}

/** Creates a seeded demo account and signs it in for this browser session. */
export async function startDemo(headers: Headers, timezone = "UTC"): Promise<{ userId: string }> {
  await pruneDemos();
  const context = await auth.$context;
  const userId = `demo-${crypto.randomUUID()}`;
  const email = `${userId}@${DEMO_DOMAIN}`;
  // Random, never shown: it exists only so the server can open the session
  const password = randomBytes(24).toString("base64url");

  await db.insert(users).values({ id: userId, name: "Demo visitor", email, emailVerified: true, isDemo: true, timezone });
  try {
    await db.insert(accounts).values({ id: crypto.randomUUID(), userId, accountId: userId, providerId: "credential", password: await context.password.hash(password) });
    await provisionAccount(userId);
    await seedDemoData(userId, Date.now(), timezone);
    await auth.api.signInEmail({ body: { email, password, rememberMe: false }, headers });
  } catch (error) {
    await db.delete(users).where(eq(users.id, userId));
    throw error;
  }
  return { userId };
}

/** Deletes a demo account and everything it owns. Does nothing for the owner. */
export async function endDemo(userId: string): Promise<void> {
  await db.delete(users).where(and(eq(users.id, userId), eq(users.isDemo, true)));
}

export async function isDemoUser(userId: string): Promise<boolean> {
  const [row] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.isDemo ?? false;
}
