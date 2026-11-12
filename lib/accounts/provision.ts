import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, boards, columns, users } from "@/db/schema";

const PERSONAL_COLUMNS = [
  { name: "Queued", stateType: "backlog" },
  { name: "Active", stateType: "active" },
  { name: "Done", stateType: "done" },
] as const;

/**
 * Creates the personal workspace, personal board and default columns once payment
 * succeeds (payment is required before workspace creation). Idempotent: safe to call
 * from every webhook delivery.
 */
export async function provisionAccount(userId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, userId), eq(workspaces.type, "personal")))
      .limit(1);
    if (existing) return existing.id;

    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: "Personal", slug: `personal-${userId}`, type: "personal", ownerId: userId })
      .returning({ id: workspaces.id });

    const [board] = await tx
      .insert(boards)
      .values({ workspaceId: workspace.id, name: "Board", type: "personal" })
      .returning({ id: boards.id });

    await tx.insert(columns).values(
      PERSONAL_COLUMNS.map((column, position) => ({ boardId: board.id, position, ...column }))
    );

    await tx.update(users).set({ defaultWorkspaceId: workspace.id }).where(eq(users.id, userId));

    return workspace.id;
  });
}
