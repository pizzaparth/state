import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";

/**
 * Write authorization. Identity always comes from the server session (never from the
 * request). Every account (the owner, and each demo visitor) has exactly one personal
 * workspace and can read and write only that workspace.
 */
export interface Actor {
  id: string;
  personalWorkspaceId: string | null;
  /** Workspaces this user may read. */
  readable: ReadonlySet<string>;
  /** Workspaces this user may create or change objects in. */
  writable: ReadonlySet<string>;
}

export class MutationError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "invalid" | "conflict" | "rate_limited" | "unauthenticated",
    message: string
  ) {
    super(message);
  }
}

/** Loads the workspace a user may write to. Callers must have verified the session. */
export async function loadActor(userId: string): Promise<Actor> {
  const [personal] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.type, "personal")))
    .limit(1);
  const personalWorkspaceId = personal?.id ?? null;
  const own = new Set<string>(personalWorkspaceId ? [personalWorkspaceId] : []);
  return { id: userId, personalWorkspaceId, readable: own, writable: own };
}

/**
 * Objects outside the actor's workspaces are reported as missing, not forbidden, so
 * probing ids reveals nothing about other tenants.
 */
export function assertWritable(actor: Actor, workspaceId: string | null | undefined): asserts workspaceId is string {
  if (workspaceId && actor.writable.has(workspaceId)) return;
  if (workspaceId && actor.readable.has(workspaceId)) throw new MutationError("forbidden", "You have view-only access here.");
  throw new MutationError("not_found", "That item no longer exists.");
}
