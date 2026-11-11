import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, auditEvents, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { MutationError } from "@/lib/authz";

// Accounts without a password (Google, GitHub) prove themselves by a recent sign-in
const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

export class IdentityError extends MutationError {
  constructor(readonly field: "password" | "session", message: string) {
    super("invalid", message);
  }
}

/**
 * Re-verifies the person before deletion: their password when the account has one,
 * otherwise a sign-in within the last 10 minutes.
 */
export async function verifyIdentity(userId: string, sessionCreatedAt: Date, password: string | undefined): Promise<void> {
  const [credential] = await db
    .select({ hash: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  if (credential?.hash) {
    if (!password) throw new IdentityError("password", "Enter your password.");
    const context = await auth.$context;
    if (!(await context.password.verify({ hash: credential.hash, password }))) throw new IdentityError("password", "That password is incorrect.");
    return;
  }
  if (Date.now() - new Date(sessionCreatedAt).getTime() > FRESH_SIGN_IN_MS) {
    throw new IdentityError("session", "Sign out and sign in again, then delete within 10 minutes.");
  }
}

/**
 * Permanent account deletion. Deleting the user row cascades through every table that
 * references it: the personal workspace with its projects, boards, tasks, commits, tags
 * and objectives, plus sessions and sign-ins.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Operational record only: no name, email or content survives the deletion
    await tx.insert(auditEvents).values({ action: "account.deleted", targetType: "user", targetId: userId });
    await tx.delete(users).where(eq(users.id, userId));
  });
}
