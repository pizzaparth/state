import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, objectiveProjects, objectives, boards, columns, commitTags, commits, projects, tags, taskTags, tasks, users } from "@/db/schema";
import { assertWritable, MutationError, type Actor } from "@/lib/authz";
import { keyBetween } from "@/lib/position";
import { nextDueDay, step as recurrenceStep } from "@/lib/recurrence";
import { dayKey } from "@/lib/format";
import { IMPORT_LIMITS, parseQuickCapture, type ImportData } from "@/lib/validation";
import { parsePreferences, type Preferences, type setPreferencesSchema } from "@/lib/preferences";
import type { z } from "zod";
import type { addBoardTaskSchema, createObjectiveSchema, setObjectiveArchivedSchema, setObjectiveProgressSchema, editCommitSchema, setTaskRecurrenceSchema, captureTaskSchema, createProjectSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskProjectSchema, setTaskWeightSchema, setTimezoneSchema, taskRefSchema, addColumnSchema, bulkUpdateSchema, columnRefSchema, moveColumnSchema, renameColumnSchema, setColumnLimitSchema, captureManySchema, setTaskTagsSchema, commitRefSchema, updateObjectiveSchema, mergeTagsSchema, renameTagSchema, setProjectNotesSchema, setTaskDeferSchema, setTaskDescriptionSchema, setTaskPlannedSchema, setTaskStageSchema, tagRefSchema } from "@/lib/validation";

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
  /** A recurring task's next occurrence was created by this move. */
  recurred: boolean;
  /** Reopening removed the untouched next occurrence it had queued. */
  removedNext?: boolean;
}

/**
 * Moves a board card to a column and position. Reaching a Done column completes the task
 * and records its commit (at most one live commit per task, enforced by a unique index);
 * leaving Done reopens it and retires that commit. Completing a recurring task also creates
 * its next occurrence, once: reopening and completing again does not add another.
 */
export async function moveTask(actor: Actor, input: z.infer<typeof moveTaskSchema>): Promise<MoveResult> {
  return db.transaction((tx) => moveInTx(tx, actor, input));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function moveInTx(tx: Tx, actor: Actor, input: z.infer<typeof moveTaskSchema>): Promise<MoveResult> {
  {
    // Row lock: concurrent moves of the same card apply one after the other
    const [task] = await tx
      .select({
        id: tasks.id,
        workspaceId: tasks.workspaceId,
        boardId: tasks.boardId,
        columnId: tasks.columnId,
        projectId: tasks.projectId,
        assigneeId: tasks.assigneeId,
        creatorId: tasks.creatorId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        weight: tasks.weight,
        recurrenceRule: tasks.recurrenceRule,
        dueAt: tasks.dueAt,
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
    const boardId = task.boardId;

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
    if (task.columnId !== column.id) update.columnEnteredAt = now;
    if (!toDone && column.stateType !== "backlog" && !task.startedAt) update.startedAt = now;
    if (toDone && !wasDone) update.completedAt = now;
    if (!toDone && wasDone) update.completedAt = null;
    await tx.update(tasks).set(update).where(eq(tasks.id, task.id));
    if (task.columnId !== column.id) await auditTask(tx, actor, task.workspaceId, task.id, "task.moved", { columnId: column.id });

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
      // The commit carries the task's tags, so History can filter on them
      if (inserted.length > 0) {
        const labels = await tx.select({ tagId: taskTags.tagId }).from(taskTags).where(eq(taskTags.taskId, task.id)).limit(50);
        if (labels.length > 0) await tx.insert(commitTags).values(labels.map((l) => ({ commitId: inserted[0].id, tagId: l.tagId }))).onConflictDoNothing();
      }
    }

    let recurred = false;
    if (committed > 0 && task.recurrenceRule) {
      const [existing] = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.recurrenceParentId, task.id), isNull(tasks.deletedAt))).limit(1);
      // The next occurrence waits in the board's first queued column
      const [queued] = await tx
        .select({ id: columns.id })
        .from(columns)
        .where(and(eq(columns.boardId, boardId), ne(columns.stateType, "done")))
        .orderBy(sql`${columns.stateType} = 'backlog' desc`, asc(columns.position))
        .limit(1);
      if (!existing && queued) {
        const [{ tz }] = await tx.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
        const dueDay = nextDueDay(task.recurrenceRule, task.dueAt ? dayKey(task.dueAt, tz) : null, dayKey(now, tz));
        const [top] = await tx
          .select({ position: tasks.position })
          .from(tasks)
          .where(and(eq(tasks.boardId, boardId), eq(tasks.columnId, queued.id), isNull(tasks.deletedAt)))
          .orderBy(asc(byPosition))
          .limit(1);
        const [next] = await tx
          .insert(tasks)
          .values({
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            boardId,
            columnId: queued.id,
            position: keyBetween(null, top?.position ?? null),
            assigneeId: task.assigneeId,
            creatorId: task.creatorId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            weight: task.weight,
            recurrenceRule: task.recurrenceRule,
            recurrenceParentId: task.id,
            dueAt: sql<Date>`((${dueDay})::date + time '23:59') at time zone ${tz}`,
          })
          .returning({ id: tasks.id });
        const labels = await tx.select({ tagId: taskTags.tagId }).from(taskTags).where(eq(taskTags.taskId, task.id)).limit(50);
        if (labels.length > 0) await tx.insert(taskTags).values(labels.map((l) => ({ taskId: next.id, tagId: l.tagId })));
        recurred = true;
      }
    }

    let reopened = false;
    let removedNext = false;
    if (!toDone && wasDone) {
      // The next occurrence it queued goes too, if nobody touched it yet
      const [child] = await tx
        .select({ id: tasks.id, title: tasks.title, startedAt: tasks.startedAt, completedAt: tasks.completedAt, stateType: columns.stateType })
        .from(tasks)
        .leftJoin(columns, eq(columns.id, tasks.columnId))
        .where(and(eq(tasks.recurrenceParentId, task.id), isNull(tasks.deletedAt)))
        .limit(1);
      if (child && child.stateType === "backlog" && !child.startedAt && !child.completedAt && child.title === task.title) {
        await tx.update(tasks).set({ deletedAt: now }).where(eq(tasks.id, child.id));
        await auditTask(tx, actor, task.workspaceId, child.id, "task.deleted", { reason: "parent reopened" });
        removedNext = true;
      }
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
    return { committed, reopened, recurred, removedNext };
  }
}

export interface CompleteResult extends MoveResult {
  title: string;
  /** Column the task was in before, for Undo; null when it came from the Inbox. */
  previousColumnId: string | null;
  /** The board's first queued column (Undo target for an Inbox task). */
  queuedColumnId: string | null;
}

/**
 * Finishes a task in one action. A board task moves to the top of its board's Done
 * column (recording its commit, as a drag would); an Inbox task is placed on the personal
 * board and completed in the same transaction.
 */
export async function completeTask(actor: Actor, input: z.infer<typeof taskRefSchema>): Promise<CompleteResult> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, boardId: tasks.boardId, columnId: tasks.columnId, title: tasks.title, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (task.completedAt) throw new MutationError("conflict", "This task is already done.");

    let boardId = task.boardId;
    if (!boardId) {
      const [board] = await tx
        .select({ id: boards.id })
        .from(boards)
        .where(and(eq(boards.workspaceId, task.workspaceId), eq(boards.type, "personal")))
        .limit(1);
      if (!board) throw new MutationError("not_found", "Your board is still being set up. Try again in a moment.");
      boardId = board.id;
      await tx.update(tasks).set({ boardId }).where(eq(tasks.id, task.id));
    }
    const boardColumns = await tx
      .select({ id: columns.id, stateType: columns.stateType })
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(asc(columns.position))
      .limit(50);
    const done = boardColumns.find((c) => c.stateType === "done");
    if (!done) throw new MutationError("not_found", "This board has no Done column.");
    const result = await moveInTx(tx, actor, { taskId: task.id, columnId: done.id, afterTaskId: null });
    return {
      ...result,
      title: task.title,
      previousColumnId: task.columnId,
      queuedColumnId: boardColumns.find((c) => c.stateType === "backlog")?.id ?? null,
    };
  });
}

export interface CaptureResult {
  id: string;
  title: string;
  projectName: string | null;
  dueAt: Date | null;
  /** Went straight to the board's Queued column. */
  queued: boolean;
}

/**
 * Quick capture (parseQuickCapture) into the personal Inbox, optionally tagged with one
 * of the actor's live projects. Due days are read in the actor's timezone and stored as
 * the end of that day. The task is always the actor's own.
 */
export async function captureTask(actor: Actor, input: z.infer<typeof captureTaskSchema>): Promise<CaptureResult> {
  assertWritable(actor, actor.personalWorkspaceId);
  return db.transaction(async (tx) => {
    const ctx = await captureContext(tx, actor, input.queued ?? false);
    return captureOne(tx, actor, ctx, input.text);
  });
}

/** A pasted list: one capture per line, all or nothing, one write. */
export async function captureMany(actor: Actor, input: z.infer<typeof captureManySchema>): Promise<{ count: number; queued: boolean }> {
  assertWritable(actor, actor.personalWorkspaceId);
  return db.transaction(async (tx) => {
    const ctx = await captureContext(tx, actor, input.queued ?? false);
    // Each lands on top of the column, so go bottom-up to keep the pasted order
    for (const line of [...input.lines].reverse()) await captureOne(tx, actor, ctx, line);
    return { count: input.lines.length, queued: ctx.column !== null };
  });
}

interface CaptureContext {
  workspaceId: string;
  tz: string;
  weight: 1 | 2 | 4 | 8;
  /** Target column when capturing straight to Queued; null = Inbox. */
  column: { id: string; boardId: string; top: string | null } | null;
}

async function captureContext(tx: Tx, actor: Actor, queued: boolean): Promise<CaptureContext> {
  const workspaceId = actor.personalWorkspaceId!;
  const [{ tz, preferences }] = await tx.select({ tz: users.timezone, preferences: users.preferences }).from(users).where(eq(users.id, actor.id)).limit(1);
  const weight = parsePreferences(preferences).defaultWeight;
  if (!queued) return { workspaceId, tz, weight, column: null };
  const [column] = await tx
    .select({ id: columns.id, boardId: boards.id })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .where(and(eq(boards.workspaceId, workspaceId), eq(boards.type, "personal"), eq(columns.stateType, "backlog")))
    .orderBy(asc(columns.position))
    .limit(1);
  if (!column) throw new MutationError("not_found", "Your board is still being set up. Try again in a moment.");
  const [first] = await tx
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.boardId, column.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt)))
    .orderBy(asc(byPosition))
    .limit(1);
  return { workspaceId, tz, weight, column: { ...column, top: first?.position ?? null } };
}

async function captureOne(tx: Tx, actor: Actor, ctx: CaptureContext, text: string): Promise<CaptureResult> {
  const parsed = parseQuickCapture(text, dayKey(new Date(), ctx.tz));
  const title = parsed.title.trim();
  if (!title) throw new MutationError("invalid", "Add a title as well as the #project, !priority or date.");

  let project: { id: string; name: string } | undefined;
  if (parsed.projectSlug) {
    [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.slug, parsed.projectSlug.toLowerCase()), isNull(projects.archivedAt)))
      .limit(1);
  }
  const position = ctx.column ? keyBetween(null, ctx.column.top) : undefined;
  if (ctx.column && position) ctx.column.top = position;

  const [row] = await tx
    .insert(tasks)
    .values({
      workspaceId: ctx.workspaceId,
      creatorId: actor.id,
      assigneeId: actor.id,
      projectId: project?.id ?? null,
      boardId: ctx.column?.boardId ?? null,
      columnId: ctx.column?.id ?? null,
      ...(position ? { position } : {}),
      title,
      priority: parsed.priority ?? "none",
      weight: parsed.weight ?? ctx.weight,
      recurrenceRule: parsed.repeat ?? null,
      dueAt: parsed.dueDate ? sql<Date>`((${parsed.dueDate})::date + time '23:59') at time zone ${ctx.tz}` : null,
    })
    .returning({ id: tasks.id, dueAt: tasks.dueAt });
  return { id: row.id, title, projectName: project?.name ?? null, dueAt: row.dueAt, queued: ctx.column !== null };
}

export interface AddedCard {
  id: string;
  columnId: string;
  title: string;
  projectName: string | null;
  priority: string;
  weight: number;
  dueAt: Date | null;
}

/**
 * New task at the top of a column of the actor's personal board (default: the first
 * queued column). Done columns are refused: finishing records a commit, so it happens by
 * moving an existing task. Capture tokens in the title are read in the actor's time zone.
 */
export async function addBoardTask(actor: Actor, input: z.infer<typeof addBoardTaskSchema>): Promise<AddedCard> {
  assertWritable(actor, actor.personalWorkspaceId);
  const workspaceId = actor.personalWorkspaceId;
  const [column] = await db
    .select({ id: columns.id, boardId: boards.id, stateType: columns.stateType })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .where(
      and(
        eq(boards.workspaceId, workspaceId),
        eq(boards.type, "personal"),
        input.columnId ? eq(columns.id, input.columnId) : eq(columns.stateType, "backlog")
      )
    )
    .orderBy(asc(columns.position))
    .limit(1);
  if (!column) throw new MutationError("not_found", input.columnId ? "That column no longer exists." : "Your board is still being set up. Try again in a moment.");
  if (column.stateType === "done") throw new MutationError("invalid", "Add it to another column, then move it to Done so its commit is recorded.");

  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  const parsed = parseQuickCapture(input.title, dayKey(new Date(), tz));
  const title = parsed.title.trim();
  if (!title) throw new MutationError("invalid", "Add a title as well as the #project, !priority or date.");
  let project: { id: string; name: string } | undefined;
  if (parsed.projectSlug) {
    [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, parsed.projectSlug.toLowerCase()), isNull(projects.archivedAt)))
      .limit(1);
  }

  const [first] = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.boardId, column.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt)))
    .orderBy(asc(byPosition))
    .limit(1);
  const weight = parsed.weight ?? input.weight ?? (await defaultWeightOf(db, actor));
  const [row] = await db
    .insert(tasks)
    .values({
      workspaceId,
      boardId: column.boardId,
      columnId: column.id,
      position: keyBetween(null, first?.position ?? null),
      creatorId: actor.id,
      assigneeId: actor.id,
      projectId: project?.id ?? null,
      title,
      priority: parsed.priority ?? "none",
      weight,
      recurrenceRule: parsed.repeat ?? null,
      dueAt: parsed.dueDate ? sql<Date>`((${parsed.dueDate})::date + time '23:59') at time zone ${tz}` : null,
      startedAt: column.stateType === "backlog" ? null : new Date(),
    })
    .returning({ id: tasks.id, dueAt: tasks.dueAt });
  return { id: row.id, columnId: column.id, title, projectName: project?.name ?? null, priority: parsed.priority ?? "none", weight, dueAt: row.dueAt };
}

/**
 * Changes the actor's time zone. Open tasks' due dates and live objectives' deadlines keep
 * their calendar day: the day is read in the old zone and stored as 23:59 of that day in
 * the new one, in the same transaction.
 */
export async function setTimezone(actor: Actor, input: z.infer<typeof setTimezoneSchema>): Promise<{ timezone: string; moved: number }> {
  assertWritable(actor, actor.personalWorkspaceId);
  const workspaceId = actor.personalWorkspaceId;
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1).for("update");
    if (!user) throw new MutationError("not_found", "That account no longer exists.");
    if (user.tz === input.timezone) return { timezone: input.timezone, moved: 0 };
    const keepDay = (column: typeof tasks.dueAt | typeof objectives.deadlineAt) =>
      sql<Date>`((${column} at time zone ${user.tz})::date + time '23:59') at time zone ${input.timezone}`;
    const dues = await tx
      .update(tasks)
      .set({ dueAt: keepDay(tasks.dueAt) })
      .where(and(eq(tasks.workspaceId, workspaceId), isNotNull(tasks.dueAt), isNull(tasks.completedAt), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id });
    const deadlines = await tx
      .update(objectives)
      .set({ deadlineAt: keepDay(objectives.deadlineAt) })
      .where(and(eq(objectives.workspaceId, workspaceId), isNotNull(objectives.deadlineAt), isNull(objectives.completedAt)))
      .returning({ id: objectives.id });
    await tx.update(users).set({ timezone: input.timezone, updatedAt: new Date() }).where(eq(users.id, actor.id));
    return { timezone: input.timezone, moved: dues.length + deadlines.length };
  });
}

/** Marks first-run setup as finished (or skipped). Idempotent. */
export async function finishOnboarding(actor: Actor): Promise<{ done: true }> {
  await db.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, now())` }).where(eq(users.id, actor.id));
  return { done: true };
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
    const update: Partial<typeof tasks.$inferInsert> = { boardId: column.boardId, columnId: column.id, position: keyBetween(null, first?.position ?? null), columnEnteredAt: new Date() };
    if (column.stateType !== "backlog" && !task.startedAt) update.startedAt = new Date();
    await tx.update(tasks).set(update).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.moved", { columnId: column.id });
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
  await auditTask(db, actor, task.workspaceId, task.id, "task.renamed", { title: input.title });
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
  await auditTask(db, actor, task.workspaceId, task.id, "task.priority", { priority: input.priority });
  return { priority: input.priority };
}

/**
 * Files a task under one of the live projects in its own workspace, or unfiles it. A done
 * task's commit follows, so project execution stays with the task (commit project tags are
 * correctable; time and value are not touched).
 */
export async function setTaskProject(actor: Actor, input: z.infer<typeof setTaskProjectSchema>): Promise<{ projectName: string | null }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);

    let projectName: string | null = null;
    if (input.projectId) {
      const [project] = await tx
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, task.workspaceId), isNull(projects.archivedAt)))
        .limit(1);
      if (!project) throw new MutationError("not_found", "That project no longer exists.");
      projectName = project.name;
    }
    if (input.projectId === task.projectId) return { projectName };

    await tx.update(tasks).set({ projectId: input.projectId }).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.project", { project: projectName });
    const moved = await tx
      .update(commits)
      .set({ projectId: input.projectId })
      .where(and(eq(commits.taskId, task.id), eq(commits.workspaceId, task.workspaceId), eq(commits.userId, actor.id), isNull(commits.deletedAt)))
      .returning({ id: commits.id });
    if (moved.length > 0) {
      await tx.insert(auditEvents).values(
        moved.map((c) => ({
          workspaceId: task.workspaceId,
          actorId: actor.id,
          action: "commit.edited",
          targetType: "commit",
          targetId: c.id,
          metadata: { changed: ["project"], fromProjectId: task.projectId, toProjectId: input.projectId },
        }))
      );
    }
    return { projectName };
  });
}

/**
 * Sets or clears an open task's due date. The day is read in the actor's own timezone
 * and stored as the end of that day (23:59) in UTC, so it shows as that day for them.
 */
export async function setTaskDue(actor: Actor, input: z.infer<typeof setTaskDueSchema>): Promise<{ dueAt: Date | null }> {
  const [task] = await db
    .select({ id: tasks.id, workspaceId: tasks.workspaceId, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw new MutationError("not_found", "That task no longer exists.");
  assertWritable(actor, task.workspaceId);
  if (task.completedAt) throw new MutationError("invalid", "This task is done; it no longer has a due date to change.");

  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  const dueAt = input.dueDate === null ? null : sql<Date>`((${input.dueDate})::date + time '23:59') at time zone ${tz}`;
  const [row] = await db
    .update(tasks)
    .set({ dueAt })
    .where(and(eq(tasks.id, task.id), isNull(tasks.deletedAt)))
    .returning({ dueAt: tasks.dueAt });
  await auditTask(db, actor, task.workspaceId, task.id, "task.due", { due: input.dueDate });
  return { dueAt: row?.dueAt ?? null };
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
    await auditTask(tx, actor, task.workspaceId, task.id, "task.weight", { weight: input.weight });
    return { weight: input.weight };
  });
}

/**
 * Sets how an open task repeats, or stops it repeating. The rule applies when the task is
 * next completed; a completed task's next occurrence carries the rule from then on.
 */
export async function setTaskRecurrence(actor: Actor, input: z.infer<typeof setTaskRecurrenceSchema>): Promise<{ rule: string | null }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    if (task.completedAt) throw new MutationError("invalid", "This task is done. Change the repeat on its next occurrence.");

    await tx.update(tasks).set({ recurrenceRule: input.rule }).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.repeat", { rule: input.rule });
    return { rule: input.rule };
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
 * New project in the actor's personal workspace.
 * Slugs are unique per workspace (archived projects included), enforced by an index.
 */
export async function createProject(actor: Actor, input: z.infer<typeof createProjectSchema>): Promise<{ id: string; slug: string; href: string }> {
  const workspaceId = actor.personalWorkspaceId;
  assertWritable(actor, workspaceId);

  const [row] = await db
    .insert(projects)
    .values({ workspaceId, name: input.name, slug: input.slug, description: input.description || null })
    .onConflictDoNothing({ target: [projects.workspaceId, projects.slug] })
    .returning({ id: projects.id, slug: projects.slug });
  if (!row) throw new MutationError("conflict", `#${input.slug} is already used here. Choose another slug.`);
  return { ...row, href: `/platform/projects/${row.slug}` };
}

/** Where a project lives in the app. */
const projectHref = (slug: string) => `/platform/projects/${slug}`;

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
  return { slug: input.slug, href: projectHref(input.slug) };
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

  return db.transaction(async (tx) => {
    const [row] = await tx
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
    const ids = await tagIds(tx, workspaceId, input.tags ?? []);
    if (ids.length) await tx.insert(commitTags).values(ids.map((tagId) => ({ commitId: row.id, tagId })));
    return row;
  });
}

/**
 * Corrects a commit's message, project and tags. Its time, execution value, author,
 * source and task stay as recorded. Only the author can edit a commit. The project must be a live project
 * in the commit's own workspace (or none); tags are created in that workspace by name.
 */
export async function editCommit(actor: Actor, input: z.infer<typeof editCommitSchema>): Promise<{ message: string }> {
  return db.transaction(async (tx) => {
    const [commit] = await tx
      .select({ id: commits.id, workspaceId: commits.workspaceId, userId: commits.userId, message: commits.message, projectId: commits.projectId })
      .from(commits)
      .where(and(eq(commits.id, input.commitId), isNull(commits.deletedAt)))
      .limit(1)
      .for("update");
    if (!commit) throw new MutationError("not_found", "That commit no longer exists.");
    assertWritable(actor, commit.workspaceId);
    if (commit.userId !== actor.id) throw new MutationError("forbidden", "Only its author can edit this commit.");

    if (input.projectId && input.projectId !== commit.projectId) {
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, commit.workspaceId), isNull(projects.archivedAt)))
        .limit(1);
      if (!project) throw new MutationError("not_found", "That project no longer exists.");
    }

    const before = await tx
      .select({ name: tags.name })
      .from(commitTags)
      .innerJoin(tags, eq(tags.id, commitTags.tagId))
      .where(eq(commitTags.commitId, commit.id))
      .limit(100);
    const tagsChanged = JSON.stringify(before.map((t) => t.name).sort()) !== JSON.stringify([...input.tags].sort());
    if (tagsChanged) {
      await tx.delete(commitTags).where(eq(commitTags.commitId, commit.id));
      if (input.tags.length > 0) {
        await tx.insert(tags).values(input.tags.map((name) => ({ workspaceId: commit.workspaceId, name }))).onConflictDoNothing({ target: [tags.workspaceId, tags.name] });
        const ids = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.workspaceId, commit.workspaceId), inArray(tags.name, input.tags)));
        await tx.insert(commitTags).values(ids.map((t) => ({ commitId: commit.id, tagId: t.id })));
      }
    }

    const changed = [
      ...(input.message !== commit.message ? ["message"] : []),
      ...(input.projectId !== commit.projectId ? ["project"] : []),
      ...(tagsChanged ? ["tags"] : []),
    ];
    if (changed.length === 0) return { message: commit.message };
    await tx.update(commits).set({ message: input.message, projectId: input.projectId }).where(eq(commits.id, commit.id));
    await tx.insert(auditEvents).values({
      workspaceId: commit.workspaceId,
      actorId: actor.id,
      action: "commit.edited",
      targetType: "commit",
      targetId: commit.id,
      metadata: { changed, fromProjectId: commit.projectId, toProjectId: input.projectId },
    });
    return { message: input.message };
  });
}

const LIVE_OBJECTIVES_MAX = 50;

/**
 * New objective in the actor's personal workspace.
 * It starts now; the deadline is the end of that day in the actor's timezone and must not
 * be in the past. An optional project (live, same workspace) narrows what it measures.
 */
export async function createObjective(actor: Actor, input: z.infer<typeof createObjectiveSchema>): Promise<{ id: string }> {
  const workspaceId = actor.personalWorkspaceId;
  assertWritable(actor, workspaceId);

  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
      .limit(1);
    if (!project) throw new MutationError("not_found", "That project no longer exists.");
  }
  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  if (input.deadline && input.deadline < dayKey(new Date(), tz)) throw new MutationError("invalid", "Pick a deadline from today on.");

  return db.transaction(async (tx) => {
    // Serialise per workspace so the cap holds under concurrent creates
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`objectives:${workspaceId}`}))`);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(objectives).where(and(eq(objectives.workspaceId, workspaceId), isNull(objectives.archivedAt)));
    if (n >= LIVE_OBJECTIVES_MAX) throw new MutationError("invalid", `Up to ${LIVE_OBJECTIVES_MAX} objectives at once. Archive some first.`);
    const [row] = await tx
      .insert(objectives)
      .values({
        workspaceId,
        ownerId: actor.id,
        name: input.name,
        measure: input.measure,
        unit: input.measure === "execution" ? "execution" : input.unit,
        targetValue: input.targetValue,
        deadlineAt: input.deadline ? sql<Date>`((${input.deadline})::date + time '23:59') at time zone ${tz}` : null,
      })
      .returning({ id: objectives.id });
    if (input.projectId) await tx.insert(objectiveProjects).values({ objectiveId: row.id, projectId: input.projectId });
    return row;
  });
}

async function writableObjective(actor: Actor, objectiveId: string) {
  const [objective] = await db
    .select({ id: objectives.id, workspaceId: objectives.workspaceId, name: objectives.name, measure: objectives.measure, targetValue: objectives.targetValue, archivedAt: objectives.archivedAt })
    .from(objectives)
    .where(eq(objectives.id, objectiveId))
    .limit(1);
  if (!objective) throw new MutationError("not_found", "That objective no longer exists.");
  assertWritable(actor, objective.workspaceId);
  return objective;
}

/**
 * Edits an objective's name, unit (hand-counted only), target, deadline and project. A
 * new deadline is the end of that day in the actor's zone and cannot be in the past
 * (an unchanged one may be). Completion follows the new target.
 */
export async function updateObjective(actor: Actor, input: z.infer<typeof updateObjectiveSchema>): Promise<{ name: string }> {
  const objective = await writableObjective(actor, input.objectiveId);
  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  const [current] = await db.select({ deadlineAt: objectives.deadlineAt, currentValue: objectives.currentValue }).from(objectives).where(eq(objectives.id, objective.id)).limit(1);
  const currentDay = current.deadlineAt ? dayKey(current.deadlineAt, tz) : null;
  if (input.deadline && input.deadline !== currentDay && input.deadline < dayKey(new Date(), tz)) throw new MutationError("invalid", "Pick a deadline from today on.");
  if (objective.measure === "manual" && !input.unit) throw new MutationError("invalid", "Name what you count, like modules.");
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, objective.workspaceId), isNull(projects.archivedAt)))
      .limit(1);
    if (!project) throw new MutationError("not_found", "That project no longer exists.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(objectives)
      .set({
        name: input.name,
        unit: objective.measure === "execution" ? "execution" : input.unit,
        targetValue: input.targetValue,
        deadlineAt: input.deadline === null ? null : sql<Date>`((${input.deadline})::date + time '23:59') at time zone ${tz}`,
        // Hand-counted: completion follows the new target. Execution: re-settled on next read.
        completedAt:
          objective.measure === "manual"
            ? current.currentValue >= input.targetValue
              ? sql`coalesce(${objectives.completedAt}, now())`
              : null
            : null,
      })
      .where(eq(objectives.id, objective.id));
    await tx.delete(objectiveProjects).where(eq(objectiveProjects.objectiveId, objective.id));
    if (input.projectId) await tx.insert(objectiveProjects).values({ objectiveId: objective.id, projectId: input.projectId });
  });
  return { name: input.name };
}

/** Sets a hand-counted objective's current value; reaching the target marks it completed. */
export async function setObjectiveProgress(actor: Actor, input: z.infer<typeof setObjectiveProgressSchema>): Promise<{ currentValue: number; completed: boolean }> {
  const objective = await writableObjective(actor, input.objectiveId);
  if (objective.archivedAt) throw new MutationError("invalid", "Unarchive this objective to update it.");
  if (objective.measure !== "manual") throw new MutationError("invalid", "This objective counts execution from commits; log a commit instead.");
  const completed = input.currentValue >= objective.targetValue;
  await db
    .update(objectives)
    .set({ currentValue: input.currentValue, completedAt: completed ? sql`coalesce(${objectives.completedAt}, now())` : null })
    .where(eq(objectives.id, objective.id));
  return { currentValue: input.currentValue, completed };
}

/** Archives or restores an objective. Archived objectives leave the Metrics page. */
export async function setObjectiveArchived(actor: Actor, input: z.infer<typeof setObjectiveArchivedSchema>): Promise<{ name: string; archived: boolean }> {
  const objective = await writableObjective(actor, input.objectiveId);
  await db
    .update(objectives)
    .set({ archivedAt: input.archived ? sql`coalesce(${objectives.archivedAt}, now())` : null })
    .where(eq(objectives.id, objective.id));
  return { name: objective.name, archived: input.archived };
}

export interface ImportResult {
  projects: number;
  tasks: number;
  commits: number;
  /** Rows already present (same title or message at the same time) and left alone. */
  skipped: number;
}

// Fixed-width suffix digits without "0": lib/position.ts treats trailing zeros as
// insignificant, so appended keys must not end in one
const KEY_DIGITS = "123456789abcdefghijklmnopqrstuvwxyz";
const appendKey = (prefix: string, i: number) => {
  let suffix = "";
  for (let n = i, w = 0; w < 3; w++, n = Math.floor(n / KEY_DIGITS.length)) suffix = KEY_DIGITS[n % KEY_DIGITS.length] + suffix;
  return prefix + suffix;
};

const chunk = <T>(rows: T[], size = 500): T[][] => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

const msKey = (date: Date, text: string) => `${date.getTime()}|${text}`;

/**
 * Imports projects, tags, tasks and commits into the actor's personal workspace, in one
 * transaction (all or nothing). Tasks land on the personal board in the column matching
 * their status (Inbox when "inbox"); commits are recorded as source "imported" with the
 * time they originally happened, linked to their task when it is in the same file.
 *
 * Importing the same file twice adds nothing the second time: a task with the same
 * title and creation time, or a commit with the same message and time, is skipped.
 * Completed tasks do not create commits here; the commits in the file carry the execution.
 */
export async function importData(actor: Actor, input: ImportData): Promise<ImportResult> {
  const workspaceId = actor.personalWorkspaceId;
  assertWritable(actor, workspaceId);
  const now = new Date();

  return db.transaction(async (tx) => {
    // Serialise imports per workspace so two uploads cannot both miss each other's rows
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`import:${workspaceId}`}))`);

    // ---- projects: listed ones keep their details; ones only referenced get their slug as name
    const listed = new Map(input.projects.map((p) => [p.slug, p]));
    const referenced = new Set([...input.tasks.map((t) => t.project), ...input.commits.map((c) => c.project)].filter((s): s is string => Boolean(s)));
    const slugs = new Set([...listed.keys(), ...referenced]);
    if (slugs.size > IMPORT_LIMITS.projects) throw new MutationError("invalid", `Up to ${IMPORT_LIMITS.projects} projects per import.`);
    const projectRows = [...slugs].map((slug) => {
      const p = listed.get(slug);
      return {
        workspaceId,
        slug,
        name: p?.name ?? slug,
        description: p?.description ?? null,
        status: p?.status ?? "active",
        createdAt: p?.createdAt ?? now,
        archivedAt: p?.archivedAt ?? (p?.status === "archived" ? now : null),
      };
    });
    let projectsCreated = 0;
    const projectIds = new Map<string, string>();
    for (const rows of chunk(projectRows)) {
      projectsCreated += (await tx.insert(projects).values(rows).onConflictDoNothing({ target: [projects.workspaceId, projects.slug] }).returning({ id: projects.id })).length;
      const found = await tx
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.slug, rows.map((r) => r.slug))));
      for (const p of found) projectIds.set(p.slug, p.id);
    }
    const projectOf = (slug: string | null | undefined) => (slug ? projectIds.get(slug) ?? null : null);

    // ---- tags by name
    const tagNames = new Set([...input.tasks.flatMap((t) => t.tags), ...input.commits.flatMap((c) => c.tags)]);
    if (tagNames.size > IMPORT_LIMITS.tags) throw new MutationError("invalid", `Up to ${IMPORT_LIMITS.tags} distinct tags per import.`);
    const tagIds = new Map<string, string>();
    for (const names of chunk([...tagNames])) {
      await tx.insert(tags).values(names.map((name) => ({ workspaceId, name }))).onConflictDoNothing({ target: [tags.workspaceId, tags.name] });
      const found = await tx.select({ id: tags.id, name: tags.name }).from(tags).where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, names)));
      for (const t of found) tagIds.set(t.name, t.id);
    }

    // ---- tasks onto the personal board
    const [board] = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.workspaceId, workspaceId), eq(boards.type, "personal")))
      .limit(1);
    const boardColumns = board
      ? await tx.select({ id: columns.id, stateType: columns.stateType }).from(columns).where(eq(columns.boardId, board.id)).orderBy(asc(columns.position)).limit(50)
      : [];
    const columnOf = (state: string) => boardColumns.find((c) => c.stateType === state);
    const columnFor = (status: (typeof input.tasks)[number]["status"]) => {
      if (status === "inbox") return undefined;
      if (status === "queued") return columnOf("backlog");
      return columnOf(status) ?? (status === "review" ? columnOf("active") : undefined) ?? columnOf("backlog");
    };

    const existingTasks = await existingKeys(
      input.tasks.flatMap((t) => (t.createdAt ? [t.createdAt] : [])),
      (from, to) =>
        tx
          .select({ id: tasks.id, at: tasks.createdAt, text: tasks.title })
          .from(tasks)
          .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt), gte(tasks.createdAt, from), lte(tasks.createdAt, to)))
          .limit(200_000)
    );

    // Each column's new cards go after its current last card, in file order
    const tails = new Map<string, { prefix: string; next: number }>();
    const nextPosition = async (columnId: string) => {
      let tail = tails.get(columnId);
      if (!tail) {
        const [last] = await tx
          .select({ position: tasks.position })
          .from(tasks)
          .where(and(eq(tasks.columnId, columnId), isNull(tasks.deletedAt)))
          .orderBy(desc(byPosition))
          .limit(1);
        tail = { prefix: keyBetween(last?.position ?? null, null), next: 0 };
        tails.set(columnId, tail);
      }
      return appendKey(tail.prefix, tail.next++);
    };

    const taskIdByRef = new Map<string, string>();
    const taskRows: (typeof tasks.$inferInsert)[] = [];
    const taskTagRows: { taskId: string; tagId: string }[] = [];
    let skipped = 0;
    for (const t of input.tasks) {
      const duplicate = t.createdAt ? existingTasks.get(msKey(t.createdAt, t.title)) : undefined;
      if (duplicate) {
        if (t.id) taskIdByRef.set(t.id, duplicate);
        skipped++;
        continue;
      }
      const id = crypto.randomUUID();
      if (t.id) taskIdByRef.set(t.id, id);
      if (t.createdAt) existingTasks.set(msKey(t.createdAt, t.title), id);
      const column = columnFor(t.status);
      const done = column?.stateType === "done";
      const createdAt = t.createdAt ?? now;
      taskRows.push({
        id,
        workspaceId,
        projectId: projectOf(t.project),
        boardId: column ? board!.id : null,
        columnId: column?.id ?? null,
        position: column ? await nextPosition(column.id) : "a0",
        creatorId: actor.id,
        assigneeId: actor.id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        weight: t.weight,
        recurrenceRule: t.recurrenceRule ?? null,
        dueAt: done ? null : t.dueAt ?? null,
        startedAt: t.startedAt ?? (column && column.stateType !== "backlog" ? createdAt : null),
        completedAt: done ? t.completedAt ?? createdAt : null,
        createdAt,
        archivedAt: t.archivedAt ?? null,
      });
      for (const name of t.tags) taskTagRows.push({ taskId: id, tagId: tagIds.get(name)! });
    }
    for (const rows of chunk(taskRows)) await tx.insert(tasks).values(rows);
    for (const rows of chunk(taskTagRows)) await tx.insert(taskTags).values(rows).onConflictDoNothing();

    // ---- commits
    const existingCommits = await existingKeys(
      input.commits.map((c) => c.createdAt),
      (from, to) =>
        tx
          .select({ id: commits.id, at: commits.createdAt, text: commits.message })
          .from(commits)
          .where(and(eq(commits.workspaceId, workspaceId), isNull(commits.deletedAt), gte(commits.createdAt, from), lte(commits.createdAt, to)))
          .limit(200_000)
    );
    const commitRows: (typeof commits.$inferInsert & { id: string })[] = [];
    const commitTagNames = new Map<string, string[]>();
    for (const c of input.commits) {
      const key = msKey(c.createdAt, c.message);
      if (existingCommits.has(key)) {
        skipped++;
        continue;
      }
      existingCommits.set(key, "");
      const id = crypto.randomUUID();
      commitRows.push({
        id,
        workspaceId,
        projectId: projectOf(c.project),
        taskId: c.taskId ? taskIdByRef.get(c.taskId) ?? null : null,
        userId: actor.id,
        message: c.message,
        executionValue: c.executionValue,
        source: "imported",
        createdAt: c.createdAt,
      });
      commitTagNames.set(id, c.tags);
    }
    let commitsCreated = 0;
    const commitTagRows: { commitId: string; tagId: string }[] = [];
    for (const rows of chunk(commitRows)) {
      // At most one live commit per task (unique index): a second one for the same task is dropped
      const inserted = await tx.insert(commits).values(rows).onConflictDoNothing().returning({ id: commits.id });
      commitsCreated += inserted.length;
      skipped += rows.length - inserted.length;
      for (const { id } of inserted) for (const name of commitTagNames.get(id) ?? []) commitTagRows.push({ commitId: id, tagId: tagIds.get(name)! });
    }
    for (const rows of chunk(commitTagRows)) await tx.insert(commitTags).values(rows).onConflictDoNothing();

    const result = { projects: projectsCreated, tasks: taskRows.length, commits: commitsCreated, skipped };
    await tx.insert(auditEvents).values({ workspaceId, actorId: actor.id, action: "data.imported", targetType: "workspace", targetId: workspaceId, metadata: result });
    return result;
  });
}

/**
 * Rows already in the workspace between the earliest and latest timestamp of an import,
 * keyed by millisecond time and text. Stored times have microseconds and exports carry
 * milliseconds, so keys are compared at millisecond precision.
 */
async function existingKeys(
  dates: Date[],
  load: (from: Date, to: Date) => Promise<{ id: string; at: Date; text: string }[]>
): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  if (dates.length === 0) return keys;
  let min = Infinity;
  let max = -Infinity;
  for (const d of dates) {
    min = Math.min(min, d.getTime());
    max = Math.max(max, d.getTime());
  }
  const rows = await load(new Date(min - 1), new Date(max + 1));
  for (const r of rows) keys.set(msKey(r.at, r.text), r.id);
  return keys;
}

// ------------------------------------------------------------------ board columns

async function writableColumn(tx: Tx, actor: Actor, columnId: string) {
  const [column] = await tx
    .select({ id: columns.id, boardId: columns.boardId, name: columns.name, position: columns.position, stateType: columns.stateType, workspaceId: boards.workspaceId })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .where(eq(columns.id, columnId))
    .limit(1);
  if (!column) throw new MutationError("not_found", "That column no longer exists.");
  assertWritable(actor, column.workspaceId);
  // Serialise column edits per board so positions stay distinct
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`columns:${column.boardId}`}))`);
  return column;
}

const boardColumnsOf = (tx: Tx, boardId: string) =>
  tx
    .select({ id: columns.id, position: columns.position, stateType: columns.stateType })
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(asc(columns.position), asc(columns.id))
    .limit(50);

export async function renameColumn(actor: Actor, input: z.infer<typeof renameColumnSchema>): Promise<{ name: string }> {
  return db.transaction(async (tx) => {
    const column = await writableColumn(tx, actor, input.columnId);
    await tx.update(columns).set({ name: input.name }).where(eq(columns.id, column.id));
    return { name: input.name };
  });
}

export async function setColumnLimit(actor: Actor, input: z.infer<typeof setColumnLimitSchema>): Promise<{ limit: number | null }> {
  return db.transaction(async (tx) => {
    const column = await writableColumn(tx, actor, input.columnId);
    if (column.stateType === "done" && input.limit !== null) throw new MutationError("invalid", "Done has no limit: finished work is never too much.");
    await tx.update(columns).set({ wipLimit: input.limit }).where(eq(columns.id, column.id));
    return { limit: input.limit };
  });
}

const COLUMNS_MAX = 12;

/** Adds a column to the right of another. Never after Done, which stays last. */
export async function addColumn(actor: Actor, input: z.infer<typeof addColumnSchema>): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const after = await writableColumn(tx, actor, input.afterColumnId);
    if (after.stateType === "done") throw new MutationError("invalid", "Done stays the last column. Add the new one to the left of it.");
    const list = await boardColumnsOf(tx, after.boardId);
    if (list.length >= COLUMNS_MAX) throw new MutationError("invalid", `Up to ${COLUMNS_MAX} columns per board.`);
    // Renumber 0..n with a gap after the anchor
    const order = list.map((c) => c.id);
    const at = order.indexOf(after.id) + 1;
    const id = crypto.randomUUID();
    order.splice(at, 0, id);
    await tx.insert(columns).values({ id, boardId: after.boardId, name: input.name, stateType: input.stateType, position: at });
    for (const [i, cid] of order.entries()) await tx.update(columns).set({ position: i }).where(eq(columns.id, cid));
    return { id };
  });
}

/** Swaps a column with its neighbour. Done does not move, and nothing moves past it. */
export async function moveColumn(actor: Actor, input: z.infer<typeof moveColumnSchema>): Promise<{ moved: boolean }> {
  return db.transaction(async (tx) => {
    const column = await writableColumn(tx, actor, input.columnId);
    if (column.stateType === "done") throw new MutationError("invalid", "Done stays the last column.");
    const list = await boardColumnsOf(tx, column.boardId);
    const i = list.findIndex((c) => c.id === column.id);
    const j = input.direction === "left" ? i - 1 : i + 1;
    const other = list[j];
    if (!other || other.stateType === "done") return { moved: false };
    [list[i], list[j]] = [list[j], list[i]];
    for (const [k, c] of list.entries()) await tx.update(columns).set({ position: k }).where(eq(columns.id, c.id));
    return { moved: true };
  });
}

/** Deletes an empty column. Done, and the board's last queued column, are kept. */
export async function deleteColumn(actor: Actor, input: z.infer<typeof columnRefSchema>): Promise<{ name: string }> {
  return db.transaction(async (tx) => {
    const column = await writableColumn(tx, actor, input.columnId);
    if (column.stateType === "done") throw new MutationError("invalid", "A board always has one Done column.");
    const list = await boardColumnsOf(tx, column.boardId);
    if (column.stateType === "backlog" && list.filter((c) => c.stateType === "backlog").length <= 1) {
      throw new MutationError("invalid", "Keep one queued column: new tasks and reopened ones land there.");
    }
    const [card] = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.columnId, column.id), isNull(tasks.deletedAt))).limit(1);
    if (card) throw new MutationError("conflict", "Move its tasks out first. Only empty columns can be deleted.");
    await tx.delete(columns).where(eq(columns.id, column.id));
    return { name: column.name };
  });
}

// ------------------------------------------------------------------ bulk

export interface BulkResult {
  changed: number;
  /** Execution recorded by tasks reaching Done. */
  committed: number;
  /** Tasks left alone (done tasks cannot be deleted; missing ids). */
  skipped: number;
}

/**
 * Applies one change to up to 100 tasks in one transaction. Every id is checked against
 * the actor's workspace; foreign or missing ids are skipped, never changed. Moving to
 * Done records each task's commit, as single moves do.
 */
export async function bulkUpdateTasks(actor: Actor, input: z.infer<typeof bulkUpdateSchema>): Promise<BulkResult> {
  assertWritable(actor, actor.personalWorkspaceId);
  const workspaceId = actor.personalWorkspaceId;
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tasks.id, boardId: tasks.boardId, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(inArray(tasks.id, input.taskIds), eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)))
      .orderBy(byPosition)
      .limit(input.taskIds.length)
      .for("update");
    const change = input.change;
    let changed = 0;
    let committed = 0;
    if (change.type === "move") {
      const [column] = await tx
        .select({ id: columns.id, boardId: boards.id })
        .from(columns)
        .innerJoin(boards, eq(boards.id, columns.boardId))
        .where(and(eq(columns.id, change.columnId), eq(boards.workspaceId, workspaceId)))
        .limit(1);
      if (!column) throw new MutationError("not_found", "That column no longer exists.");
      let after: string | null = null;
      for (const row of rows) {
        if (row.boardId !== column.boardId) await tx.update(tasks).set({ boardId: column.boardId, columnId: null }).where(eq(tasks.id, row.id));
        const result = await moveInTx(tx, actor, { taskId: row.id, columnId: column.id, afterTaskId: after });
        committed += result.committed;
        after = row.id;
        changed++;
      }
    } else if (change.type === "priority") {
      const ids = rows.map((r) => r.id);
      if (ids.length) changed = (await tx.update(tasks).set({ priority: change.priority }).where(inArray(tasks.id, ids)).returning({ id: tasks.id })).length;
    } else if (change.type === "project") {
      if (change.projectId) {
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, change.projectId), eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
          .limit(1);
        if (!project) throw new MutationError("not_found", "That project no longer exists.");
      }
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        changed = (await tx.update(tasks).set({ projectId: change.projectId }).where(inArray(tasks.id, ids)).returning({ id: tasks.id })).length;
        // Done tasks' commits follow their task, as setTaskProject does
        await tx
          .update(commits)
          .set({ projectId: change.projectId })
          .where(and(inArray(commits.taskId, ids), eq(commits.workspaceId, workspaceId), eq(commits.userId, actor.id), isNull(commits.deletedAt)));
      }
    } else {
      const open = rows.filter((r) => !r.completedAt).map((r) => r.id);
      if (open.length) {
        const now = new Date();
        changed = (await tx.update(tasks).set({ deletedAt: now }).where(inArray(tasks.id, open)).returning({ id: tasks.id })).length;
        await tx.insert(auditEvents).values(open.map((id) => ({ workspaceId, actorId: actor.id, action: "task.deleted", targetType: "task", targetId: id })));
      }
    }
    return { changed, committed, skipped: input.taskIds.length - changed };
  });
}

/** Undo for a bulk delete: restores the given tasks deleted in the last minute. */
export async function bulkRestoreTasks(actor: Actor, input: { taskIds: string[] }): Promise<{ restored: number }> {
  assertWritable(actor, actor.personalWorkspaceId);
  const rows = await db
    .update(tasks)
    .set({ deletedAt: null })
    .where(and(inArray(tasks.id, input.taskIds), eq(tasks.workspaceId, actor.personalWorkspaceId), isNotNull(tasks.deletedAt), gte(tasks.deletedAt, sql`now() - interval '10 minutes'`)))
    .returning({ id: tasks.id });
  return { restored: rows.length };
}

// ------------------------------------------------------------------ tags

/** Ids of the named tags in a workspace, creating the missing ones. */
async function tagIds(tx: Tx, workspaceId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  await tx.insert(tags).values(names.map((name) => ({ workspaceId, name }))).onConflictDoNothing({ target: [tags.workspaceId, tags.name] });
  const rows = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, names))).limit(names.length);
  return rows.map((r) => r.id);
}

/** Replaces a task's tags (max 10; created by name in the task's workspace). */
export async function setTaskTags(actor: Actor, input: z.infer<typeof setTaskTagsSchema>): Promise<{ tags: string[] }> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
      .limit(1)
      .for("update");
    if (!task) throw new MutationError("not_found", "That task no longer exists.");
    assertWritable(actor, task.workspaceId);
    await tx.delete(taskTags).where(eq(taskTags.taskId, task.id));
    const ids = await tagIds(tx, task.workspaceId, input.tags);
    if (ids.length) await tx.insert(taskTags).values(ids.map((tagId) => ({ taskId: task.id, tagId })));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.tagged", { tags: input.tags });
    return { tags: input.tags };
  });
}

/** One audit row per task change (C21): shown as the task's history in its panel. */
async function auditTask(tx: Tx | typeof db, actor: Actor, workspaceId: string, taskId: string, action: string, metadata?: Record<string, unknown>) {
  await tx.insert(auditEvents).values({ workspaceId, actorId: actor.id, action, targetType: "task", targetId: taskId, metadata: metadata ?? null });
}

// ------------------------------------------------------------------ withdrawing a manual commit

/** How long after logging a manual commit can still be withdrawn. */
export const WITHDRAW_WINDOW_HOURS = 24;

/**
 * Withdraws a mistaken manual commit: a soft delete with an audit record, never an edit of
 * its time or value. Only the author, only manual commits, only within 24 hours. Task
 * commits are withdrawn by reopening their task.
 */
export async function withdrawCommit(actor: Actor, input: z.infer<typeof commitRefSchema>): Promise<{ message: string; executionValue: number }> {
  return db.transaction(async (tx) => {
    const [commit] = await tx
      .select({ id: commits.id, workspaceId: commits.workspaceId, userId: commits.userId, source: commits.source, createdAt: commits.createdAt, message: commits.message, executionValue: commits.executionValue })
      .from(commits)
      .where(and(eq(commits.id, input.commitId), isNull(commits.deletedAt)))
      .limit(1)
      .for("update");
    if (!commit) throw new MutationError("not_found", "That commit no longer exists.");
    assertWritable(actor, commit.workspaceId);
    if (commit.userId !== actor.id) throw new MutationError("forbidden", "Only its author can withdraw this commit.");
    if (commit.source !== "manual") throw new MutationError("invalid", "Task commits are withdrawn by reopening their task.");
    if (Date.now() - commit.createdAt.getTime() > WITHDRAW_WINDOW_HOURS * 3_600_000) {
      throw new MutationError("invalid", `Manual commits can be withdrawn for ${WITHDRAW_WINDOW_HOURS} hours. This one is part of your record now.`);
    }
    await tx.update(commits).set({ deletedAt: new Date() }).where(eq(commits.id, commit.id));
    await tx.insert(auditEvents).values({ workspaceId: commit.workspaceId, actorId: actor.id, action: "commit.withdrawn", targetType: "commit", targetId: commit.id });
    return { message: commit.message, executionValue: commit.executionValue };
  });
}

/** Undo for withdrawCommit, within 10 minutes of withdrawing. */
export async function restoreCommit(actor: Actor, input: z.infer<typeof commitRefSchema>): Promise<{ message: string }> {
  return db.transaction(async (tx) => {
    const [commit] = await tx
      .select({ id: commits.id, workspaceId: commits.workspaceId, userId: commits.userId, source: commits.source, message: commits.message, deletedAt: commits.deletedAt })
      .from(commits)
      .where(and(eq(commits.id, input.commitId), isNotNull(commits.deletedAt)))
      .limit(1)
      .for("update");
    if (!commit) throw new MutationError("not_found", "That commit can no longer be restored.");
    assertWritable(actor, commit.workspaceId);
    if (commit.userId !== actor.id || commit.source !== "manual" || Date.now() - commit.deletedAt!.getTime() > 10 * 60_000) {
      throw new MutationError("not_found", "That commit can no longer be restored.");
    }
    await tx.update(commits).set({ deletedAt: null }).where(eq(commits.id, commit.id));
    await tx.insert(auditEvents).values({ workspaceId: commit.workspaceId, actorId: actor.id, action: "commit.restored", targetType: "commit", targetId: commit.id });
    return { message: commit.message };
  });
}

// ------------------------------------------------------------------ maintenance

/** Permanently removes tasks deleted more than 30 days ago (run on owner sign-in). */
export async function purgeDeleted(workspaceId: string): Promise<number> {
  const gone = await db
    .delete(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), isNotNull(tasks.deletedAt), sql`${tasks.deletedAt} < now() - interval '30 days'`))
    .returning({ id: tasks.id });
  return gone.length;
}

// ------------------------------------------------------------------ task depth

/** A live task the actor may write, row-locked inside `tx`. */
async function lockedTask(tx: Tx, actor: Actor, taskId: string) {
  const [task] = await tx
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
      boardId: tasks.boardId,
      columnId: tasks.columnId,
      title: tasks.title,
      completedAt: tasks.completedAt,
      dueAt: tasks.dueAt,
      recurrenceRule: tasks.recurrenceRule,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)
    .for("update");
  if (!task) throw new MutationError("not_found", "That task no longer exists.");
  assertWritable(actor, task.workspaceId);
  return task;
}

const actorZone = async (q: Tx | typeof db, actor: Actor) => (await q.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1))[0]?.tz ?? "UTC";

export async function setTaskDescription(actor: Actor, input: z.infer<typeof setTaskDescriptionSchema>): Promise<{ description: string | null }> {
  return db.transaction(async (tx) => {
    const task = await lockedTask(tx, actor, input.taskId);
    await tx.update(tasks).set({ description: input.description }).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.described");
    return { description: input.description };
  });
}

/**
 * Defers an open task until a day (start of that day in the actor's zone): it leaves
 * Today's Queued list and waits greyed at the bottom of its column until then.
 */
export async function setTaskDefer(actor: Actor, input: z.infer<typeof setTaskDeferSchema>): Promise<{ until: string | null }> {
  return db.transaction(async (tx) => {
    const task = await lockedTask(tx, actor, input.taskId);
    if (task.completedAt) throw new MutationError("invalid", "This task is done.");
    const tz = await actorZone(tx, actor);
    if (input.until && input.until <= dayKey(new Date(), tz)) throw new MutationError("invalid", "Pick a day after today.");
    await tx
      .update(tasks)
      .set({ deferUntil: input.until === null ? null : sql<Date>`((${input.until})::date)::timestamp at time zone ${tz}` })
      .where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.deferred", { until: input.until });
    return { until: input.until };
  });
}

/** Plans an open task for today (a plain list on Today, no target), or clears it. */
export async function setTaskPlanned(actor: Actor, input: z.infer<typeof setTaskPlannedSchema>): Promise<{ plannedFor: string | null }> {
  return db.transaction(async (tx) => {
    const task = await lockedTask(tx, actor, input.taskId);
    if (task.completedAt && input.planned) throw new MutationError("invalid", "This task is done.");
    const plannedFor = input.planned ? dayKey(new Date(), await actorZone(tx, actor)) : null;
    await tx.update(tasks).set({ plannedFor }).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, input.planned ? "task.planned" : "task.unplanned");
    return { plannedFor };
  });
}

/**
 * Queues or starts a task in one step: an Inbox task is placed on the personal board, a
 * board task moves, to the top of the board's first queued or in-progress column.
 */
export async function setTaskStage(actor: Actor, input: z.infer<typeof setTaskStageSchema>): Promise<{ columnId: string; columnName: string; previousColumnId: string | null }> {
  return db.transaction(async (tx) => {
    const task = await lockedTask(tx, actor, input.taskId);
    if (task.completedAt) throw new MutationError("invalid", "This task is done. Reopen it from the board.");
    let boardId = task.boardId;
    if (!boardId) {
      const [board] = await tx.select({ id: boards.id }).from(boards).where(and(eq(boards.workspaceId, task.workspaceId), eq(boards.type, "personal"))).limit(1);
      if (!board) throw new MutationError("not_found", "Your board is still being set up. Try again in a moment.");
      boardId = board.id;
      await tx.update(tasks).set({ boardId }).where(eq(tasks.id, task.id));
    }
    const [column] = await tx
      .select({ id: columns.id, name: columns.name })
      .from(columns)
      .where(and(eq(columns.boardId, boardId), input.stage === "queued" ? eq(columns.stateType, "backlog") : inArray(columns.stateType, ["active", "review"])))
      .orderBy(sql`${columns.stateType} = 'active' desc`, asc(columns.position))
      .limit(1);
    if (!column) throw new MutationError("not_found", "That column no longer exists.");
    if (task.columnId !== column.id) await moveInTx(tx, actor, { taskId: task.id, columnId: column.id, afterTaskId: null });
    return { columnId: column.id, columnName: column.name, previousColumnId: task.columnId };
  });
}

/** A recurring task's due date moves one step (no commit): "Skip next". */
export async function skipRecurrence(actor: Actor, input: z.infer<typeof taskRefSchema>): Promise<{ dueDay: string }> {
  return db.transaction(async (tx) => {
    const task = await lockedTask(tx, actor, input.taskId);
    if (!task.recurrenceRule) throw new MutationError("invalid", "This task does not repeat.");
    if (task.completedAt) throw new MutationError("invalid", "This task is done.");
    const tz = await actorZone(tx, actor);
    const dueDay = recurrenceStep(task.dueAt ? dayKey(task.dueAt, tz) : dayKey(new Date(), tz), task.recurrenceRule);
    await tx.update(tasks).set({ dueAt: sql<Date>`((${dueDay})::date + time '23:59') at time zone ${tz}` }).where(eq(tasks.id, task.id));
    await auditTask(tx, actor, task.workspaceId, task.id, "task.skipped", { due: dueDay });
    return { dueDay };
  });
}

/** A copy of a task (title, fields, tags) in the same column, just below it; never done. */
export async function duplicateTask(actor: Actor, input: z.infer<typeof taskRefSchema>): Promise<{ id: string; title: string }> {
  return db.transaction(async (tx) => {
    await lockedTask(tx, actor, input.taskId);
    const [src] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1);
    // A copy of a done task goes back to the board's first queued column
    let columnId = src.columnId;
    if (src.completedAt && src.boardId) {
      const [queued] = await tx.select({ id: columns.id }).from(columns).where(and(eq(columns.boardId, src.boardId), eq(columns.stateType, "backlog"))).orderBy(asc(columns.position)).limit(1);
      columnId = queued?.id ?? null;
    }
    let position = "a0";
    if (src.boardId && columnId) {
      const [after] = await tx
        .select({ position: tasks.position })
        .from(tasks)
        .where(and(eq(tasks.boardId, src.boardId), eq(tasks.columnId, columnId), isNull(tasks.deletedAt), sql`${tasks.position} collate "C" > ${src.position} collate "C"`))
        .orderBy(asc(byPosition))
        .limit(1);
      position = columnId === src.columnId ? keyBetween(src.position, after?.position ?? null) : keyBetween(null, null);
    }
    const title = `${src.title}`.slice(0, 500);
    const [row] = await tx
      .insert(tasks)
      .values({
        workspaceId: src.workspaceId,
        projectId: src.projectId,
        boardId: src.boardId,
        columnId,
        position,
        creatorId: actor.id,
        assigneeId: actor.id,
        title,
        description: src.description,
        priority: src.priority,
        weight: src.weight,
        recurrenceRule: src.recurrenceRule,
        dueAt: src.completedAt ? null : src.dueAt,
      })
      .returning({ id: tasks.id });
    const labels = await tx.select({ tagId: taskTags.tagId }).from(taskTags).where(eq(taskTags.taskId, src.id)).limit(50);
    if (labels.length) await tx.insert(taskTags).values(labels.map((l) => ({ taskId: row.id, tagId: l.tagId })));
    await auditTask(tx, actor, src.workspaceId, row.id, "task.duplicated", { from: src.id });
    return { id: row.id, title };
  });
}

// ------------------------------------------------------------------ tags (Settings → Tags)

async function writableTag(q: Tx | typeof db, actor: Actor, tagId: string) {
  const [tag] = await q.select({ id: tags.id, workspaceId: tags.workspaceId, name: tags.name }).from(tags).where(eq(tags.id, tagId)).limit(1);
  if (!tag) throw new MutationError("not_found", "That tag no longer exists.");
  assertWritable(actor, tag.workspaceId);
  return tag;
}

export async function renameTag(actor: Actor, input: z.infer<typeof renameTagSchema>): Promise<{ name: string }> {
  return db.transaction(async (tx) => {
    const tag = await writableTag(tx, actor, input.tagId);
    const [clash] = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.workspaceId, tag.workspaceId), eq(tags.name, input.name), ne(tags.id, tag.id))).limit(1);
    if (clash) throw new MutationError("conflict", `“${input.name}” already exists. Merge into it instead.`);
    await tx.update(tags).set({ name: input.name }).where(eq(tags.id, tag.id));
    return { name: input.name };
  });
}

/** Moves every task and commit from one tag to another, then deletes the first. */
export async function mergeTags(actor: Actor, input: z.infer<typeof mergeTagsSchema>): Promise<{ into: string }> {
  if (input.fromTagId === input.intoTagId) throw new MutationError("invalid", "Pick two different tags.");
  return db.transaction(async (tx) => {
    const from = await writableTag(tx, actor, input.fromTagId);
    const into = await writableTag(tx, actor, input.intoTagId);
    if (from.workspaceId !== into.workspaceId) throw new MutationError("not_found", "That tag no longer exists.");
    await tx.execute(sql`insert into ${taskTags} (task_id, tag_id) select task_id, ${into.id} from ${taskTags} where tag_id = ${from.id} on conflict do nothing`);
    await tx.execute(sql`insert into ${commitTags} (commit_id, tag_id) select commit_id, ${into.id} from ${commitTags} where tag_id = ${from.id} on conflict do nothing`);
    await tx.delete(tags).where(eq(tags.id, from.id));
    return { into: into.name };
  });
}

/** Deletes a tag; tasks and commits simply lose it. */
export async function deleteTag(actor: Actor, input: z.infer<typeof tagRefSchema>): Promise<{ name: string }> {
  const tag = await writableTag(db, actor, input.tagId);
  await db.delete(tags).where(eq(tags.id, tag.id));
  return { name: tag.name };
}

export async function setProjectNotes(actor: Actor, input: z.infer<typeof setProjectNotesSchema>): Promise<{ notes: string | null }> {
  const [project] = await db.select({ id: projects.id, workspaceId: projects.workspaceId }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
  if (!project) throw new MutationError("not_found", "That project no longer exists.");
  assertWritable(actor, project.workspaceId);
  await db.update(projects).set({ notes: input.notes }).where(eq(projects.id, project.id));
  return { notes: input.notes };
}

// ------------------------------------------------------------------ preferences (C44)

/** Merges the given fields into the actor's preferences. */
export async function setPreferences(actor: Actor, input: z.infer<typeof setPreferencesSchema>): Promise<Preferences> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, actor.id)).limit(1).for("update");
    if (!row) throw new MutationError("not_found", "That account no longer exists.");
    const next = parsePreferences({ ...parsePreferences(row.preferences), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) });
    await tx.update(users).set({ preferences: next, updatedAt: new Date() }).where(eq(users.id, actor.id));
    return next;
  });
}

/** The actor's default weight for new tasks without a +N token. */
async function defaultWeightOf(q: Tx | typeof db, actor: Actor): Promise<1 | 2 | 4 | 8> {
  const [row] = await q.select({ preferences: users.preferences }).from(users).where(eq(users.id, actor.id)).limit(1);
  return parsePreferences(row?.preferences).defaultWeight;
}
