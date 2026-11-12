import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { boards, projects, users, workspaces } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getTicker } from "@/db/queries";

export interface Viewer {
  id: string;
  name: string;
  email: string;
  tz: string;
  /** A throwaway demo visitor (lib/demo/session.ts), not the owner. */
  isDemo: boolean;
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

  // One round trip: the user, their personal workspace and its personal board
  const [row] = await db
    .select({ user: users, personalWorkspaceId: workspaces.id, personalBoardId: boards.id })
    .from(users)
    .leftJoin(workspaces, and(eq(workspaces.ownerId, users.id), eq(workspaces.type, "personal")))
    .leftJoin(boards, and(eq(boards.workspaceId, workspaces.id), eq(boards.type, "personal")))
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) redirect("/login");
  const { user, personalWorkspaceId, personalBoardId } = row;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tz: user.timezone,
    isDemo: user.isDemo,
    onboardedAt: user.onboardedAt,
    personalWorkspaceId: personalWorkspaceId ?? null,
    personalBoardId: personalBoardId ?? null,
    workspaceIds: personalWorkspaceId ? [personalWorkspaceId] : [],
  };
});

/** The viewer's ticker, once per request: the app layout and Today both show it. */
export const getViewerTicker = cache((viewer: Viewer) =>
  getTicker({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz)
);

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
