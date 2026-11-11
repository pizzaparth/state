import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, auditEvents, organisationMembers, organisations, users, workspaces } from "@/db/schema";
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
 * Permanent account deletion. Callers must have re-verified the person (password or a
 * fresh sign-in) and their typed confirmation.
 *
 * Deleting the user row cascades through every table that references it: the personal
 * workspace with its projects, boards, tasks, commits, tags and objectives; sessions and
 * linked sign-ins; organisation memberships; and the
 * person's own commits and created tasks in shared organisations.
 *
 * Refused while the person owns an organisation that other members still use, because
 * the cascade would delete that organisation for all of them.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const shared = await db
    .select({ name: organisations.name })
    .from(organisations)
    .innerJoin(workspaces, eq(workspaces.id, organisations.workspaceId))
    .where(
      and(
        eq(workspaces.ownerId, userId),
        sql`exists (select 1 from ${organisationMembers} where ${organisationMembers.organisationId} = ${organisations.id} and ${ne(organisationMembers.userId, userId)})`
      )
    )
    .limit(5);
  if (shared.length > 0) {
    throw new MutationError(
      "conflict",
      `You own ${shared.map((o) => o.name).join(", ")}, which other members use. Transfer ownership or remove them first.`
    );
  }

  await db.transaction(async (tx) => {
    // Operational record only: no name, email or content survives the deletion
    await tx.insert(auditEvents).values({ action: "account.deleted", targetType: "user", targetId: userId });
    await tx.delete(users).where(eq(users.id, userId));
  });
}
