import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { columns, commits, objectives, organisationMembers, organisations, projects, tags, tasks, users, workspaces } from "@/db/schema";

/**
 * Data export (docs/state_desc.md §41). Covers the person's personal workspace in full
 * (projects, tags, tasks, commits, objectives, metrics) plus which organisations they
 * belong to. Organisation content belongs to the organisation and is not included.
 * Deleted tasks and retired commits are left out. Every list is bounded.
 *
 * The JSON file is what /api/import reads back (lib/data/import.ts).
 */

export const EXPORT_FORMAT = "state-export";
export const EXPORT_VERSION = 1;

const MAX_ROWS = { projects: 5_000, tasks: 50_000, commits: 100_000, objectives: 1_000, organisations: 200 };

// Inbox captures have no column; review columns keep their own name
const TASK_STATUS = sql<string>`case when ${tasks.boardId} is null then 'inbox' when ${columns.stateType} = 'backlog' then 'queued' else coalesce(${columns.stateType}, 'queued') end`;

const tagsOf = (link: "task_tags" | "commit_tags", key: "task_id" | "commit_id", id: typeof tasks.id | typeof commits.id) =>
  sql<string[]>`coalesce((select array_agg(t.name order by t.name) from ${sql.raw(link)} l join ${tags} t on t.id = l.tag_id where l.${sql.raw(key)} = ${id}), '{}')`;

export async function personalWorkspaceId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.type, "personal")))
    .limit(1);
  return row?.id ?? null;
}

export async function exportProjects(workspaceId: string) {
  return db
    .select({
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      archivedAt: projects.archivedAt,
    })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.createdAt))
    .limit(MAX_ROWS.projects);
}

export async function exportTasks(workspaceId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      project: projects.slug,
      status: TASK_STATUS,
      priority: tasks.priority,
      weight: tasks.weight,
      recurrenceRule: tasks.recurrenceRule,
      dueAt: tasks.dueAt,
      startedAt: tasks.startedAt,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      archivedAt: tasks.archivedAt,
      tags: tagsOf("task_tags", "task_id", tasks.id),
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(columns, eq(columns.id, tasks.columnId))
    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.createdAt))
    .limit(MAX_ROWS.tasks);
}

export async function exportCommits(workspaceId: string) {
  return db
    .select({
      id: commits.id,
      message: commits.message,
      project: projects.slug,
      taskId: commits.taskId,
      executionValue: commits.executionValue,
      source: commits.source,
      createdAt: commits.createdAt,
      tags: tagsOf("commit_tags", "commit_id", commits.id),
    })
    .from(commits)
    .leftJoin(projects, eq(projects.id, commits.projectId))
    .where(and(eq(commits.workspaceId, workspaceId), isNull(commits.deletedAt)))
    .orderBy(asc(commits.createdAt))
    .limit(MAX_ROWS.commits);
}

/** All-time totals with the formulas the Metrics page uses. */
async function exportMetrics(workspaceId: string, tz: string) {
  const [row] = await db
    .select({
      execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int`,
      commits: sql<number>`count(*)::int`,
      activeDays: sql<number>`count(distinct (${commits.createdAt} at time zone ${tz})::date)::int`,
      firstCommitAt: sql<string | null>`min(${commits.createdAt})`,
    })
    .from(commits)
    .where(and(eq(commits.workspaceId, workspaceId), isNull(commits.deletedAt)));
  const [done] = await db
    .select({ n: sql<number>`count(${tasks.completedAt})::int` })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)));
  return {
    timezone: tz,
    execution: row.execution,
    commits: row.commits,
    tasksCompleted: done.n,
    activeDays: row.activeDays,
    firstCommitAt: row.firstCommitAt ? new Date(row.firstCommitAt) : null,
    formulas: {
      execution: "sum of commit execution values",
      activeDays: "days with at least one commit",
    },
  };
}

export async function buildExport(userId: string) {
  const [account] = await db
    .select({ name: users.name, email: users.email, timezone: users.timezone, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const workspaceId = await personalWorkspaceId(userId);
  const tz = account?.timezone ?? "UTC";

  const memberships = db
    .select({ name: organisations.name, slug: organisations.slug, role: organisationMembers.role, joinedAt: organisationMembers.joinedAt })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
    .where(eq(organisationMembers.userId, userId))
    .orderBy(asc(organisations.name))
    .limit(MAX_ROWS.organisations);

  const [projectRows, tagRows, taskRows, commitRows, objectiveRows, metrics, organisationRows] = await Promise.all([
    workspaceId ? exportProjects(workspaceId) : [],
    workspaceId
      ? db.select({ name: tags.name }).from(tags).where(eq(tags.workspaceId, workspaceId)).orderBy(asc(tags.name)).limit(MAX_ROWS.projects)
      : [],
    workspaceId ? exportTasks(workspaceId) : [],
    workspaceId ? exportCommits(workspaceId) : [],
    workspaceId
      ? db
          .select({
            name: objectives.name,
            currentValue: objectives.currentValue,
            targetValue: objectives.targetValue,
            unit: objectives.unit,
            startAt: objectives.startAt,
            deadlineAt: objectives.deadlineAt,
            completedAt: objectives.completedAt,
            archivedAt: objectives.archivedAt,
          })
          .from(objectives)
          .where(eq(objectives.workspaceId, workspaceId))
          .orderBy(asc(objectives.startAt))
          .limit(MAX_ROWS.objectives)
      : [],
    workspaceId ? exportMetrics(workspaceId, tz) : null,
    memberships,
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(),
    account: account ?? null,
    metrics,
    projects: projectRows,
    tags: tagRows.map((t) => t.name),
    tasks: taskRows,
    commits: commitRows,
    objectives: objectiveRows,
    organisations: organisationRows,
  };
}

