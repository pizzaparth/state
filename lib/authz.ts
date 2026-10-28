import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organisationMembers, organisations, workspaces } from "@/db/schema";

/**
 * Write authorization. Identity always comes from the server session (never from the
 * request); workspace access is re-read from the database on every mutation so a removed
 * member or downgraded role takes effect immediately.
 *
 *   personal workspace   owner only
 *   organisation         owner, admin, member write; viewer reads only
 */
export const WRITE_ROLES = ["owner", "admin", "member"] as const;

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

/** Loads the workspaces a user may write to. Callers must have verified the session. */
export async function loadActor(userId: string): Promise<Actor> {
  const [personal, orgs] = await Promise.all([
    db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, userId), eq(workspaces.type, "personal")))
      .limit(1),
    db
      .select({ workspaceId: organisations.workspaceId, role: organisationMembers.role })
      .from(organisationMembers)
      .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
      .where(eq(organisationMembers.userId, userId)),
  ]);
  const personalWorkspaceId = personal[0]?.id ?? null;
  const readable = new Set<string>(personalWorkspaceId ? [personalWorkspaceId] : []);
  const writable = new Set<string>(readable);
  for (const o of orgs) {
    readable.add(o.workspaceId);
    if ((WRITE_ROLES as readonly string[]).includes(o.role)) writable.add(o.workspaceId);
  }
  return { id: userId, personalWorkspaceId, readable, writable };
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
