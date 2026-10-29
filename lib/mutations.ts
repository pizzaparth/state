import { and, asc, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, boards, columns, commits, organisations, projects, tasks } from "@/db/schema";
import { assertWritable, MutationError, type Actor } from "@/lib/authz";
import { keyBetween } from "@/lib/position";
import { parseQuickCapture } from "@/lib/validation";
import type { z } from "zod";
import type { captureTaskSchema, createProjectSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "@/lib/validation";

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

/**
 * Inbox triage: puts an untriaged task at the top of a column on a board in the task's
 * own workspace. Done columns are refused; completing happens on the board, where the
 * commit is recorded.
 */
export async function placeTask(actor: Actor, input: z.infer<typeof placeTaskSchema>): Promise<{ boardName: string; columnName: string }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, boardId: tasks.boardId, startedAt: tasks.startedAt })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (task.boardId) throw new MutationError("conflict", "This task is already on a board.");

    // The column's board must live in the task's workspace
    const [column] = await tx
      .select({ id: columns.id, name: columns.name, stateType: columns.stateType, boardId: boards.id, boardName: boards.name })
      .from(columns)
      .innerJoin(boards, eq(boards.id, columns.boardId))
      .where(and(eq(columns.id, input.columnId), eq(boards.workspaceId, task.workspaceId)))
      .limit(1);
    if (!column) throw new MutationError("not_found", "That column no longer exists.");
    if (column.stateType === "done") throw new MutationError("invalid", "Move it to Done from the board so its commit is recorded.");

    const [first] = await tx
      .select({ position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.boardId, column.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt)))
      .orderBy(asc(byPosition))
      .limit(1);
    const update: Partial<typeof tasks.$inferInsert> = { boardId: column.boardId, columnId: column.id, position: keyBetween(null, first?.position ?? null) };
    if (column.stateType !== "backlog" && !task.startedAt) update.startedAt = new Date();
    await tx.update(tasks).set(update).where(eq(tasks.id, task.id));
    return { boardName: column.boardName, columnName: column.name };
  });
}

/**
 * Changes a task's title. A completed task's commit keeps the message it was recorded
 * with; commit messages are corrected on the commit itself.
 */
export async function renameTask(actor: Actor, input: z.infer<typeof renameTaskSchema>): Promise<{ title: string }> {
  const [task] = await db
    .select({ id: tasks.id, workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw new MutationError("not_found", "That task no longer exists.");
  assertWritable(actor, task.workspaceId);

  await db.update(tasks).set({ title: input.title }).where(and(eq(tasks.id, task.id), isNull(tasks.deletedAt)));
  return { title: input.title };
}

/** Sets a task's priority (none, low, medium, high, critical). */
export async function setTaskPriority(actor: Actor, input: z.infer<typeof setTaskPrioritySchema>): Promise<{ priority: string }> {
  const [task] = await db
    .select({ id: tasks.id, workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw new MutationError("not_found", "That task no longer exists.");
  assertWritable(actor, task.workspaceId);

  await db.update(tasks).set({ priority: input.priority }).where(and(eq(tasks.id, task.id), isNull(tasks.deletedAt)));
  return { priority: input.priority };
}

/**
 * Sets an open task's weight. Refused once the task is done: its commit recorded the
 * execution value, and commit execution is immutable. The row lock orders this against
 * a concurrent move to Done, which reads the weight inside its own lock.
 */
export async function setTaskWeight(actor: Actor, input: z.infer<typeof setTaskWeightSchema>): Promise<{ weight: number }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (task.completedAt) throw new MutationError("invalid", "Weight is fixed once a task is done. Its commit already recorded the execution.");

    await tx.update(tasks).set({ weight: input.weight }).where(eq(tasks.id, task.id));
    return { weight: input.weight };
  });
}

/**
 * Soft-deletes an open task (Undo restores it). Completed tasks are execution history and
 * are refused: reopen them on the board first, which retires their commit.
 */
export async function deleteTask(actor: Actor, input: z.infer<typeof taskRefSchema>): Promise<{ title: string }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, title: tasks.title, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (task.completedAt) throw new MutationError("invalid", "Completed tasks are part of your history. Move it out of Done first.");

    await tx.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, task.id));
    await tx.insert(auditEvents).values({ workspaceId: task.workspaceId, actorId: actor.id, action: "task.deleted", targetType: "task", targetId: task.id });
    return { title: task.title };
  });
}

/** Undo for deleteTask. */
export async function restoreTask(actor: Actor, input: z.infer<typeof taskRefSchema>): Promise<{ title: string }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNotNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task can no longer be restored.");
    assertWritable(actor, task.workspaceId);

    await tx.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, task.id));
    await tx.insert(auditEvents).values({ workspaceId: task.workspaceId, actorId: actor.id, action: "task.restored", targetType: "task", targetId: task.id });
    return { title: task.title };
  });
}

/**
 * New project in the actor's personal workspace, or in an organisation they can write to.
 * Slugs are unique per workspace (archived projects included), enforced by an index.
 */
export async function createProject(actor: Actor, input: z.infer<typeof createProjectSchema>): Promise<{ id: string; slug: string; href: string }> {
  let workspaceId = actor.personalWorkspaceId;
  let orgSlug: string | null = null;
  if (input.organisationId) {
    const [org] = await db
      .select({ workspaceId: organisations.workspaceId, slug: organisations.slug })
      .from(organisations)
      .where(eq(organisations.id, input.organisationId))
      .limit(1);
    // A missing organisation and a foreign one fail identically in assertWritable
    workspaceId = org?.workspaceId ?? null;
    orgSlug = org?.slug ?? null;
  }
  assertWritable(actor, workspaceId);

  const [row] = await db
    .insert(projects)
    .values({ workspaceId, name: input.name, slug: input.slug, description: input.description || null })
    .onConflictDoNothing({ target: [projects.workspaceId, projects.slug] })
    .returning({ id: projects.id, slug: projects.slug });
  if (!row) throw new MutationError("conflict", `#${input.slug} is already used here. Choose another slug.`);
  return { ...row, href: orgSlug ? `/org/${orgSlug}/projects/${row.slug}` : `/projects/${row.slug}` };
}

/** Where a project lives in the app: /projects/<slug> or /org/<org>/projects/<slug>. */
async function projectHref(workspaceId: string, slug: string): Promise<string> {
  const [org] = await db.select({ slug: organisations.slug }).from(organisations).where(eq(organisations.workspaceId, workspaceId)).limit(1);
  return org ? `/org/${org.slug}/projects/${slug}` : `/projects/${slug}`;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && ((error as { code?: string }).code === "23505" || isUniqueViolation((error as { cause?: unknown }).cause));

/**
 * Edits a project's name, slug, description and status. A new slug changes what #slug
 * matches in capture and the project's URL; the result carries the new href.
 */
export async function updateProject(actor: Actor, input: z.infer<typeof updateProjectSchema>): Promise<{ slug: string; href: string }> {
  const [project] = await db.select({ id: projects.id, workspaceId: projects.workspaceId }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
  if (!project) throw new MutationError("not_found", "That project no longer exists.");
  assertWritable(actor, project.workspaceId);

  const taken = new MutationError("conflict", `#${input.slug} is already used here. Choose another slug.`);
  const [clash] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, project.workspaceId), eq(projects.slug, input.slug), ne(projects.id, project.id)))
    .limit(1);
  if (clash) throw taken;
  try {
    await db
      .update(projects)
      .set({ name: input.name, slug: input.slug, description: input.description || null, status: input.status })
      .where(eq(projects.id, project.id));
  } catch (error) {
    // A concurrent rename to the same slug loses at the unique index
    if (isUniqueViolation(error)) throw taken;
    throw error;
  }
  return { slug: input.slug, href: await projectHref(project.workspaceId, input.slug) };
}

/**
 * Archives or restores a project. Archived projects leave the project lists, #capture and
 * the commit dialog; their tasks, commits and history stay as they are.
 */
export async function setProjectArchived(actor: Actor, input: z.infer<typeof setProjectArchivedSchema>): Promise<{ name: string; archived: boolean }> {
  const [project] = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId, name: projects.name })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) throw new MutationError("not_found", "That project no longer exists.");
  assertWritable(actor, project.workspaceId);

  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ archivedAt: input.archived ? sql`coalesce(${projects.archivedAt}, now())` : null })
      .where(eq(projects.id, project.id));
    await tx.insert(auditEvents).values({
      workspaceId: project.workspaceId,
      actorId: actor.id,
      action: input.archived ? "project.archived" : "project.unarchived",
      targetType: "project",
      targetId: project.id,
    });
  });
  return { name: project.name, archived: input.archived };
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
