import { db } from "../index";
import { tasks, commits, projects, workspaces } from "../schema";
import { eq, desc } from "drizzle-orm";

/**
 * State core query helpers
 */

export async function getUserWorkspaces(userId: string) {
  return db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
}

export async function getWorkspaceProjects(workspaceId: string) {
  return db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
}

export async function getRecentCommits(workspaceId: string, limit = 20) {
  return db
    .select()
    .from(commits)
    .where(eq(commits.workspaceId, workspaceId))
    .orderBy(desc(commits.createdAt))
    .limit(limit);
}

export async function getWorkspaceTasks(workspaceId: string) {
  return db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
}
