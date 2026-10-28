import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, columns, commits, projects, tasks } from "@/db/schema";
import { assertWritable, MutationError, type Actor } from "@/lib/authz";
import { keyBetween } from "@/lib/position";
import { parseQuickCapture } from "@/lib/validation";
import type { z } from "zod";
import type { captureTaskSchema, manualCommitSchema, moveTaskSchema } from "@/lib/validation";

/**
 * Product writes. Each function takes an Actor built from the server session and input
 * already parsed by its Zod schema, re-checks every referenced id against the actor's
 * workspaces, and writes in one transaction. Ids that point outside those workspaces
 * behave exactly like ids that do not exist.
 */

const byPosition = sql`${tasks.position} collate "C"`;

export interface MoveResult {
  /** Execution recorded by this move (task reached Done), or 0. */
  committed: number;
  reopened: boolean;
}

/**
 * Moves a board card to a column and position. Reaching a Done column completes the task
 * and records its commit (at most one live commit per task, enforced by a unique index);
 * leaving Done reopens it and retires that commit.
 */
export async function moveTask(actor: Actor, input: z.infer<typeof moveTaskSchema>): Promise<MoveResult> {
  return db.transaction(async (tx) => {
    // Row lock: concurrent moves of the same card apply one after the other
    const [task] = await tx
      .select({
        id: tasks.id,
        workspaceId: tasks.workspaceId,
        boardId: tasks.boardId,
        columnId: tasks.columnId,
        projectId: tasks.projectId,
        assigneeId: tasks.assigneeId,
        title: tasks.title,
        weight: tasks.weight,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (!task.boardId) throw new MutationError("invalid", "Put this task on a board first.");

    // The target column must belong to the task's own board
    const [column] = await tx
      .select({ id: columns.id, stateType: columns.stateType })
      .from(columns)
      .where(and(eq(columns.id, input.columnId), eq(columns.boardId, task.boardId)))
      .limit(1);
    if (!column) throw new MutationError("not_found", "That column no longer exists.");

    const inColumn = and(eq(tasks.boardId, task.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt), ne(tasks.id, task.id));
    let before: string | null = null;
    let append = false;
    if (input.afterTaskId) {
      const [above] = await tx.select({ position: tasks.position }).from(tasks).where(and(eq(tasks.id, input.afterTaskId), inColumn)).limit(1);
      if (above) before = above.position;
      else append = true; // stale or foreign neighbour: place at the end instead
    }
    if (append) {
      const [last] = await tx.select({ position: tasks.position }).from(tasks).where(inColumn).orderBy(desc(byPosition)).limit(1);
      before = last?.position ?? null;
    }
    const [next] = append
      ? []
      : await tx
          .select({ position: tasks.position })
          .from(tasks)
          .where(before === null ? inColumn : and(inColumn, sql`${tasks.position} collate "C" > ${before} collate "C"`))
          .orderBy(asc(byPosition))
          .limit(1);
    const position = keyBetween(before, next?.position ?? null);

    const now = new Date();
    const toDone = column.stateType === "done";
    const wasDone = task.completedAt !== null;
    const update: Partial<typeof tasks.$inferInsert> = { columnId: column.id, position };
    if (!toDone && column.stateType !== "backlog" && !task.startedAt) update.startedAt = now;
    if (toDone && !wasDone) update.completedAt = now;
    if (!toDone && wasDone) update.completedAt = null;
    await tx.update(tasks).set(update).where(eq(tasks.id, task.id));

    let committed = 0;
    if (toDone && !wasDone) {
      // Execution belongs to whoever the task was assigned to; unassigned work to the mover
      const inserted = await tx
        .insert(commits)
        .values({
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          userId: task.assigneeId ?? actor.id,
          message: task.title,
          executionValue: task.weight,
          source: "task_completion",
        })
        .onConflictDoNothing()
        .returning({ id: commits.id });
      committed = inserted.length > 0 ? task.weight : 0;
    }

    let reopened = false;
    if (!toDone && wasDone) {
      const retired = await tx
        .update(commits)
        .set({ deletedAt: now })
        .where(and(eq(commits.taskId, task.id), eq(commits.source, "task_completion"), isNull(commits.deletedAt)))
        .returning({ id: commits.id });
      reopened = true;
      if (retired.length > 0) {
        await tx.insert(auditEvents).values({
          workspaceId: task.workspaceId,
          actorId: actor.id,
          action: "task.reopened",
          targetType: "task",
          targetId: task.id,
          metadata: { retiredCommitIds: retired.map((r) => r.id) },
        });
      }
    }
    return { committed, reopened };
  });
}

/** Inbox capture in the actor's personal workspace. `#project` must name one of theirs. */
export async function captureTask(actor: Actor, input: z.infer<typeof captureTaskSchema>): Promise<{ id: string; title: string; projectName: string | null }> {
  assertWritable(actor, actor.personalWorkspaceId);
  const parsed = parseQuickCapture(input.text);
  const title = parsed.title.trim();
  if (!title) throw new MutationError("invalid", "Add a title as well as the #project or !priority.");

  let project: { id: string; name: string } | undefined;
  if (parsed.projectSlug) {
    [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, actor.personalWorkspaceId), eq(projects.slug, parsed.projectSlug.toLowerCase()), isNull(projects.archivedAt)))
      .limit(1);
  }

  const [row] = await db
    .insert(tasks)
    .values({
      workspaceId: actor.personalWorkspaceId,
      creatorId: actor.id,
      assigneeId: actor.id,
      projectId: project?.id ?? null,
      title,
      priority: parsed.priority ?? "none",
    })
    .returning({ id: tasks.id });
  return { id: row.id, title, projectName: project?.name ?? null };
}

/** Manual commit: work that never started as a task. Goes to the project's workspace. */
export async function createManualCommit(actor: Actor, input: z.infer<typeof manualCommitSchema>): Promise<{ id: string }> {
  let workspaceId = actor.personalWorkspaceId;
  if (input.projectId) {
    const [project] = await db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), isNull(projects.archivedAt)))
      .limit(1);
    if (!project) throw new MutationError("not_found", "That project no longer exists.");
    workspaceId = project.workspaceId;
  }
  assertWritable(actor, workspaceId);

  const [row] = await db
    .insert(commits)
    .values({
      workspaceId,
      projectId: input.projectId,
      userId: actor.id,
      message: input.message,
      executionValue: input.weight,
      source: "manual",
    })
    .returning({ id: commits.id });
  return row;
}
