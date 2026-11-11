import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { boards, projects, users, workspaces } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export interface Viewer {
  id: string;
  name: string;
  email: string;
  tz: string;
  /** When first-run setup was finished or skipped; null for a new account. */
  onboardedAt: Date | null;
  personalWorkspaceId: string | null;
  personalBoardId: string | null;
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

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tz: user.timezone,
    onboardedAt: user.onboardedAt,
    personalWorkspaceId: personal?.id ?? null,
    personalBoardId: personalBoard?.id ?? null,
    workspaceIds: personal ? [personal.id] : [],
  };
});

/** Live projects the viewer can capture to (#slug). */
export async function getCaptureProjects(viewer: Viewer): Promise<{ slug: string; name: string }[]> {
  if (!viewer.personalWorkspaceId) return [];
  return db
    .select({ slug: projects.slug, name: projects.name })
    .from(projects)
    .where(and(eq(projects.workspaceId, viewer.personalWorkspaceId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name))
    .limit(500);
}
