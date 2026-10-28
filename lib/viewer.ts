import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boards, organisationMembers, organisations, users, workspaces } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export interface ViewerOrg {
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
  role: string;
  timezone: string;
}

export interface Viewer {
  id: string;
  name: string;
  email: string;
  tz: string;
  dailyExecutionTarget: number | null;
  personalWorkspaceId: string | null;
  personalBoardId: string | null;
  orgs: ViewerOrg[];
  /** Every workspace this user may read. All product queries are scoped to these. */
  workspaceIds: string[];
}

/** The signed-in user and the workspaces they can access, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) redirect("/login");

  const [personal] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, user.id), eq(workspaces.type, "personal")))
    .limit(1);

  const [personalBoard] = personal
    ? await db
        .select({ id: boards.id })
        .from(boards)
        .where(and(eq(boards.workspaceId, personal.id), eq(boards.type, "personal")))
        .limit(1)
    : [];

  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      workspaceId: organisations.workspaceId,
      timezone: organisations.timezone,
      role: organisationMembers.role,
    })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
    .where(eq(organisationMembers.userId, user.id))
    .orderBy(asc(organisations.name));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tz: user.timezone,
    dailyExecutionTarget: user.dailyExecutionTarget,
    personalWorkspaceId: personal?.id ?? null,
    personalBoardId: personalBoard?.id ?? null,
    orgs,
    workspaceIds: [...(personal ? [personal.id] : []), ...orgs.map((o) => o.workspaceId)],
  };
});

/** Resolves an organisation the viewer belongs to, or 404s (never reveals others). */
export async function getViewerOrg(slug: string): Promise<{ viewer: Viewer; org: ViewerOrg }> {
  const viewer = await getViewer();
  const org = viewer.orgs.find((o) => o.slug === slug);
  if (!org) notFound();
  return { viewer, org };
}
