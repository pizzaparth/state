import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { boards, organisationMembers, organisations, projects, users, workspaces } from "@/db/schema";
import { WRITE_ROLES } from "@/lib/authz";
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
  /** When first-run setup was finished or skipped; null for a new account. */
  onboardedAt: Date | null;
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

  const [[personal], orgs] = await Promise.all([
    db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, user.id), eq(workspaces.type, "personal")))
      .limit(1),
    db
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
      .orderBy(asc(organisations.name)),
  ]);

  const [personalBoard] = personal
    ? await db
        .select({ id: boards.id })
        .from(boards)
        .where(and(eq(boards.workspaceId, personal.id), eq(boards.type, "personal")))
        .limit(1)
    : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tz: user.timezone,
    onboardedAt: user.onboardedAt,
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

/**
 * Live projects the viewer can capture to (#slug): personal first, then each organisation
 * they can write to, matching how the server picks between equal slugs.
 */
export async function getCaptureProjects(viewer: Viewer): Promise<{ slug: string; name: string; organisation: string | null }[]> {
  const writable = viewer.orgs.filter((o) => (WRITE_ROLES as readonly string[]).includes(o.role));
  const ids = [...(viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []), ...writable.map((o) => o.workspaceId)];
  if (ids.length === 0) return [];
  const rows = await db
    .select({ slug: projects.slug, name: projects.name, workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(inArray(projects.workspaceId, ids), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name))
    .limit(500);
  const orgName = new Map(writable.map((o) => [o.workspaceId, o.name]));
  return rows
    .map((p) => ({ slug: p.slug, name: p.name, organisation: orgName.get(p.workspaceId) ?? null }))
    .sort((a, b) => Number(a.organisation !== null) - Number(b.organisation !== null) || (a.organisation ?? "").localeCompare(b.organisation ?? ""));
}
