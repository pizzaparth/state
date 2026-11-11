import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";

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
