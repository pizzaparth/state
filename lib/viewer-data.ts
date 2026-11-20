import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#db";
import { boards, projects, users, workspaces } from "@/db/schema";
import { getTicker } from "@/db/queries";
import { parsePreferences, type Preferences } from "@/lib/preferences";

/**
 * The viewer, loaded from the database by user id. Shared by the server (lib/viewer.ts,
 * after the session check) and the demo in the browser (its own PGlite), so it imports
 * nothing server-only.
 */

export interface Viewer {
  id: string;
  name: string;
  email: string;
  tz: string;
  /** A throwaway demo visitor (lib/demo/local.ts), not the owner. */
  isDemo: boolean;
  /** When first-run setup was finished or skipped; null for a new account. */
  onboardedAt: Date | null;
  personalWorkspaceId: string | null;
  personalBoardId: string | null;
  /** Every workspace this user may read. All product queries are scoped to these. */
  workspaceIds: string[];
  preferences: Preferences;
  /** Dates and numbers: the saved language, else the browser's, else en-GB. */
  locale: string;
}

/** The user, their personal workspace and its personal board, in one round trip. Null when the user is gone. */
export async function loadViewerData(userId: string, fallbackLocale: string): Promise<Viewer | null> {
  const [row] = await db
    .select({ user: users, personalWorkspaceId: workspaces.id, personalBoardId: boards.id })
    .from(users)
    .leftJoin(workspaces, and(eq(workspaces.ownerId, users.id), eq(workspaces.type, "personal")))
    .leftJoin(boards, and(eq(boards.workspaceId, workspaces.id), eq(boards.type, "personal")))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const { user, personalWorkspaceId, personalBoardId } = row;
  const preferences = parsePreferences(user.preferences);
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
    preferences,
    locale: preferences.locale ?? fallbackLocale,
  };
}

/** The viewer's ticker: the app shell and Today both show it. */
export function loadViewerTicker(viewer: Viewer) {
  return getTicker({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz);
}

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
