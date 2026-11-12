import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users, workspaces } from "@/db/schema";
import { auth } from "@/lib/auth";
import { purgeDeleted } from "@/lib/mutations";
import { provisionAccount } from "@/lib/accounts/provision";
import { AUTHOR } from "@/lib/site";

/**
 * The single permanent account. It signs in with one access code, read from the
 * OWNER_CODE environment variable and never stored in the repository. The account is
 * created on the first correct sign-in, and its stored hash follows OWNER_CODE when the
 * code is rotated.
 */
export const OWNER_ID = "owner";
const OWNER_EMAIL = "owner@state.invalid";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Constant-time comparison against OWNER_CODE. False when OWNER_CODE is not set. */
export function isOwnerCode(code: string): boolean {
  const expected = process.env.OWNER_CODE;
  if (!expected) return false;
  return timingSafeEqual(digest(code), digest(expected));
}

/** Creates the owner account, or updates its password hash, so `code` signs it in. */
async function ensureOwner(code: string): Promise<void> {
  const context = await auth.$context;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, OWNER_ID)).limit(1);
  if (!user) {
    await db.insert(users).values({ id: OWNER_ID, name: AUTHOR, email: OWNER_EMAIL, emailVerified: true }).onConflictDoNothing();
  }
  const [credential] = await db
    .select({ id: accounts.id, hash: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, OWNER_ID), eq(accounts.providerId, "credential")))
    .limit(1);
  if (!credential) {
    await db.insert(accounts).values({ id: crypto.randomUUID(), userId: OWNER_ID, accountId: OWNER_ID, providerId: "credential", password: await context.password.hash(code) });
  } else if (!credential.hash || !(await context.password.verify({ hash: credential.hash, password: code }))) {
    await db.update(accounts).set({ password: await context.password.hash(code), updatedAt: new Date() }).where(eq(accounts.id, credential.id));
  }
  await provisionAccount(OWNER_ID);
}

/**
 * Signs the owner in for this browser session. Callers must have checked the code with
 * isOwnerCode and throttled the attempt. Sets the session cookie through nextCookies.
 */
export async function signInOwner(code: string, headers: Headers): Promise<void> {
  await ensureOwner(code);
  await auth.api.signInEmail({ body: { email: OWNER_EMAIL, password: code, rememberMe: false }, headers });
  // Maintenance on sign-in (no cron or queue): tasks deleted over 30 days ago go for good
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.ownerId, OWNER_ID), eq(workspaces.type, "personal"))).limit(1);
  if (ws) await purgeDeleted(ws.id).catch((error) => console.error("[maintenance] purge", error));
}
