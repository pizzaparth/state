import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { createHash, randomBytes } from "node:crypto";
import { auditEvents, objectiveProjects, objectives, boards, columns, commitTags, commits, organisationInvitations, organisationMembers, organisations, projects, tags, taskTags, tasks, users, workspaces } from "@/db/schema";
import { actionEmail, sendEmail } from "@/lib/email";
import { hasOrganisationPlan } from "@/lib/billing/access";
import { assertWritable, MutationError, type Actor } from "@/lib/authz";
import { keyBetween } from "@/lib/position";
import { dayIn, nextDueDay } from "@/lib/recurrence";
import { IMPORT_LIMITS, parseQuickCapture, type ImportData } from "@/lib/validation";
import type { z } from "zod";
import type { addBoardTaskSchema, createObjectiveSchema, setObjectiveArchivedSchema, setObjectiveProgressSchema, editCommitSchema, acceptInvitationSchema, setTaskRecurrenceSchema, captureTaskSchema, createOrganisationSchema, createProjectSchema, invitationRefSchema, inviteMemberSchema, memberRefSchema, organisationRefSchema, setMemberRoleSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "@/lib/validation";

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
}

/**
 * Moves a board card to a column and position. Reaching a Done column completes the task
 * and records its commit (at most one live commit per task, enforced by a unique index);
 * leaving Done reopens it and retires that commit. Completing a recurring task also creates
 * its next occurrence, once: reopening and completing again does not add another.
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
        const dueDay = nextDueDay(task.recurrenceRule, task.dueAt ? dayIn(task.dueAt, tz) : null, dayIn(now, tz));
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
    return { committed, reopened, recurred };
  });
}

export interface CaptureResult {
  id: string;
  title: string;
  projectName: string | null;
  /** Organisation the task went to (straight onto its board), or null for the personal Inbox. */
  organisationName: string | null;
  dueAt: Date | null;
  assigneeName: string | null;
}

/**
 * Quick capture (parseQuickCapture). Without a project, or with one of the actor's
 * personal projects, the task lands in the personal Inbox. A `#project` from an
 * organisation the actor can write to puts it at the top of that organisation's board
 * (organisations have no Inbox), where `@person` can name its owner among the members.
 * Personal projects win when a slug exists in both. Due days are read in the actor's
 * timezone and stored as the end of that day.
 */
export async function captureTask(actor: Actor, input: z.infer<typeof captureTaskSchema>): Promise<CaptureResult> {
  assertWritable(actor, actor.personalWorkspaceId);
  const personalWorkspaceId = actor.personalWorkspaceId;
  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  const parsed = parseQuickCapture(input.text, dayIn(new Date(), tz));
  const title = parsed.title.trim();
  if (!title) throw new MutationError("invalid", "Add a title as well as the #project, !priority, @person or date.");

  let project: { id: string; name: string; workspaceId: string; organisationId: string | null; organisationName: string | null } | undefined;
  if (parsed.projectSlug) {
    [project] = await db
      .select({ id: projects.id, name: projects.name, workspaceId: projects.workspaceId, organisationId: organisations.id, organisationName: organisations.name })
      .from(projects)
      .leftJoin(organisations, eq(organisations.workspaceId, projects.workspaceId))
      .where(and(inArray(projects.workspaceId, [...actor.writable]), eq(projects.slug, parsed.projectSlug.toLowerCase()), isNull(projects.archivedAt)))
      .orderBy(sql`${projects.workspaceId} = ${personalWorkspaceId} desc`, asc(organisations.name))
      .limit(1);
  }
  const organisationId = project?.organisationId ?? null;
  const workspaceId = project?.workspaceId ?? personalWorkspaceId;
  assertWritable(actor, workspaceId);

  // @person: yourself anywhere; other people only on organisation tasks, among its members
  let assignee = { id: actor.id, name: null as string | null };
  if (parsed.assignee && parsed.assignee !== "me") {
    if (!organisationId) throw new MutationError("invalid", `@${parsed.assignee} needs an organisation #project, so the task has someone to go to.`);
    const people = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(organisationMembers)
      .innerJoin(users, eq(users.id, organisationMembers.userId))
      .where(eq(organisationMembers.organisationId, organisationId))
      .limit(500);
    const handle = parsed.assignee;
    const matches = people.filter(
      (u) => u.email.toLowerCase().split("@")[0] === handle || u.name.toLowerCase().split(/\s+/)[0] === handle || u.name.toLowerCase().replace(/\s+/g, "") === handle
    );
    if (matches.length === 0) throw new MutationError("invalid", `No one called @${handle} in ${project!.organisationName}.`);
    if (matches.length > 1) throw new MutationError("invalid", `@${handle} matches ${matches.length} people. Use their email name instead.`);
    assignee = matches[0];
  }

  // Organisation tasks go straight to the top of the board's first queued column
  let place: { boardId: string; columnId: string; position: string } | null = null;
  if (organisationId) {
    const [column] = await db
      .select({ id: columns.id, boardId: boards.id })
      .from(columns)
      .innerJoin(boards, eq(boards.id, columns.boardId))
      .where(and(eq(boards.workspaceId, workspaceId), eq(columns.stateType, "backlog")))
      .orderBy(asc(boards.createdAt), asc(columns.position))
      .limit(1);
    if (!column) throw new MutationError("invalid", `${project!.organisationName} has no board to capture to.`);
    const [first] = await db
      .select({ position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.boardId, column.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt)))
      .orderBy(asc(byPosition))
      .limit(1);
    place = { boardId: column.boardId, columnId: column.id, position: keyBetween(null, first?.position ?? null) };
  }

  const [row] = await db
    .insert(tasks)
    .values({
      workspaceId,
      creatorId: actor.id,
      assigneeId: assignee.id,
      projectId: project?.id ?? null,
      title,
      priority: parsed.priority ?? "none",
      dueAt: parsed.dueDate ? sql<Date>`((${parsed.dueDate})::date + time '23:59') at time zone ${tz}` : null,
      ...(place ?? {}),
    })
    .returning({ id: tasks.id, dueAt: tasks.dueAt });
  return { id: row.id, title, projectName: project?.name ?? null, organisationName: project?.organisationName ?? null, dueAt: row.dueAt, assigneeName: assignee.name };
}

/** New task at the top of the actor's personal board's Queued column. */
export async function addBoardTask(actor: Actor, input: z.infer<typeof addBoardTaskSchema>): Promise<{ id: string; columnId: string }> {
  assertWritable(actor, actor.personalWorkspaceId);
  const [column] = await db
    .select({ id: columns.id, boardId: boards.id })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .where(and(eq(boards.workspaceId, actor.personalWorkspaceId), eq(boards.type, "personal"), eq(columns.stateType, "backlog")))
    .orderBy(asc(columns.position))
    .limit(1);
  if (!column) throw new MutationError("not_found", "Your board is still being set up. Try again in a moment.");
  const [first] = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.boardId, column.boardId), eq(tasks.columnId, column.id), isNull(tasks.deletedAt)))
    .orderBy(asc(byPosition))
    .limit(1);
  const [row] = await db
    .insert(tasks)
    .values({
      workspaceId: actor.personalWorkspaceId,
      boardId: column.boardId,
      columnId: column.id,
      position: keyBetween(null, first?.position ?? null),
      creatorId: actor.id,
      assigneeId: actor.id,
      title: input.title,
      weight: input.weight,
    })
    .returning({ id: tasks.id });
  return { id: row.id, columnId: column.id };
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
  return { ...row, href: orgSlug ? `/platform/org/${orgSlug}/projects/${row.slug}` : `/platform/projects/${row.slug}` };
}

/** Where a project lives in the app: /platform/projects/<slug> or /platform/org/<org>/projects/<slug>. */
async function projectHref(workspaceId: string, slug: string): Promise<string> {
  const [org] = await db.select({ slug: organisations.slug }).from(organisations).where(eq(organisations.workspaceId, workspaceId)).limit(1);
  return org ? `/platform/org/${org.slug}/projects/${slug}` : `/platform/projects/${slug}`;
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

// An organisation board's columns; "Queued" keeps the backlog state type
const ORGANISATION_COLUMNS = [
  { name: "Queued", stateType: "backlog" },
  { name: "Active", stateType: "active" },
  { name: "Review", stateType: "review" },
  { name: "Done", stateType: "done" },
] as const;

/** Bounds how many organisations one person can own, so a script cannot mint them without limit. */
const OWNED_ORGANISATIONS_MAX = 20;

/**
 * New organisation owned by the actor: its workspace, board with default columns, and the
 * actor as owner, in one transaction. Needs the Organisation plan. Slugs are unique
 * across State; a taken slug is reported on the slug field.
 */
export async function createOrganisation(actor: Actor, input: z.infer<typeof createOrganisationSchema>): Promise<{ slug: string; href: string }> {
  assertWritable(actor, actor.personalWorkspaceId);
  if (!(await hasOrganisationPlan(actor.id))) throw new MutationError("forbidden", "Organisations need the Organisation plan.");

  const [{ owned }] = await db
    .select({ owned: sql<number>`count(*)::int` })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, actor.id), eq(workspaces.type, "organisation")));
  if (owned >= OWNED_ORGANISATIONS_MAX) throw new MutationError("invalid", `You can own up to ${OWNED_ORGANISATIONS_MAX} organisations.`);

  const taken = new MutationError("conflict", `${input.slug} is taken. Choose another address.`);
  const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, actor.id)).limit(1);
  try {
    await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: input.name, slug: `org-${crypto.randomUUID()}`, type: "organisation", ownerId: actor.id })
        .returning({ id: workspaces.id });
      const [org] = await tx
        .insert(organisations)
        .values({ workspaceId: workspace.id, name: input.name, slug: input.slug, timezone: tz })
        .onConflictDoNothing({ target: organisations.slug })
        .returning({ id: organisations.id });
      // Rolls back the workspace too
      if (!org) throw taken;
      const [board] = await tx.insert(boards).values({ workspaceId: workspace.id, name: input.name, type: "organisation" }).returning({ id: boards.id });
      await tx.insert(columns).values(ORGANISATION_COLUMNS.map((column, position) => ({ boardId: board.id, position, ...column })));
      await tx.insert(organisationMembers).values({ organisationId: org.id, userId: actor.id, role: "owner" });
      await tx.insert(auditEvents).values({
        workspaceId: workspace.id,
        organisationId: org.id,
        actorId: actor.id,
        action: "organisation.created",
        targetType: "organisation",
        targetId: org.id,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw taken;
    throw error;
  }
  return { slug: input.slug, href: `/platform/org/${input.slug}` };
}

const MANAGER_ROLES = ["owner", "admin"];
const INVITATION_DAYS = 7;
const PENDING_INVITATIONS_MAX = 100;

export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The actor's membership of an organisation, re-read on every call. Organisations they do
 * not belong to are reported as missing. `manage` requires owner or admin.
 */
async function membershipOf(actor: Actor, organisationId: string, manage: boolean) {
  const [row] = await db
    .select({ id: organisations.id, name: organisations.name, slug: organisations.slug, workspaceId: organisations.workspaceId, role: organisationMembers.role })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
    .where(and(eq(organisationMembers.organisationId, organisationId), eq(organisationMembers.userId, actor.id)))
    .limit(1);
  if (!row) throw new MutationError("not_found", "That organisation no longer exists.");
  if (manage && !MANAGER_ROLES.includes(row.role)) throw new MutationError("forbidden", "Only owners and admins manage members.");
  return row;
}

/**
 * Invites an email address to an organisation and emails a single-use link. Owners invite
 * any role; admins invite members and viewers. Inviting the same address again replaces
 * the earlier link. The row and the email go together: if sending fails, nothing is saved.
 */
export async function inviteMember(actor: Actor, invite: z.infer<typeof inviteMemberSchema>): Promise<{ email: string }> {
  // The schema lowercases too; addresses are compared and stored in one case
  const input = { ...invite, email: invite.email.trim().toLowerCase() };
  const org = await membershipOf(actor, input.organisationId, true);
  if (input.role === "admin" && org.role !== "owner") throw new MutationError("forbidden", "Only the owner can invite admins.");

  const [member] = await db
    .select({ id: users.id })
    .from(organisationMembers)
    .innerJoin(users, eq(users.id, organisationMembers.userId))
    .where(and(eq(organisationMembers.organisationId, org.id), sql`lower(${users.email}) = ${input.email}`))
    .limit(1);
  if (member) throw new MutationError("conflict", "That person is already a member.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
  const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, actor.id)).limit(1);

  await db.transaction(async (tx) => {
    // Serialise invitations per organisation so the pending cap holds under concurrency
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invite:${org.id}`}))`);
    const pending = and(eq(organisationInvitations.organisationId, org.id), eq(organisationInvitations.status, "pending"));
    const [existing] = await tx
      .select({ id: organisationInvitations.id })
      .from(organisationInvitations)
      .where(and(pending, eq(organisationInvitations.email, input.email)))
      .limit(1);
    let invitationId = existing?.id;
    if (existing) {
      await tx
        .update(organisationInvitations)
        .set({ role: input.role, token: hashInvitationToken(token), invitedById: actor.id, expiresAt })
        .where(eq(organisationInvitations.id, existing.id));
    } else {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(organisationInvitations).where(pending);
      if (n >= PENDING_INVITATIONS_MAX) throw new MutationError("invalid", `Up to ${PENDING_INVITATIONS_MAX} pending invitations. Revoke some first.`);
      [{ id: invitationId }] = await tx
        .insert(organisationInvitations)
        .values({ organisationId: org.id, email: input.email, role: input.role, invitedById: actor.id, token: hashInvitationToken(token), expiresAt })
        .returning({ id: organisationInvitations.id });
    }
    await tx.insert(auditEvents).values({
      workspaceId: org.workspaceId,
      organisationId: org.id,
      actorId: actor.id,
      action: "organisation.member_invited",
      targetType: "invitation",
      targetId: invitationId,
      metadata: { role: input.role },
    });
    await sendEmail(
      actionEmail({
        to: input.email,
        name: "",
        subject: `Join ${org.name} on State`,
        intro: `${inviter?.name || "Someone"} invited you to ${org.name} as ${input.role === "admin" ? "an admin" : `a ${input.role}`}.`,
        action: "Accept invitation",
        url: `${process.env.BETTER_AUTH_URL}/invite/${token}`,
        note: `The link works once and expires in ${INVITATION_DAYS} days. Sign in with this email address to accept.`,
      })
    );
  });
  return { email: input.email };
}

/** Withdraws a pending invitation; its link stops working at once. */
export async function revokeInvitation(actor: Actor, input: z.infer<typeof invitationRefSchema>): Promise<{ email: string }> {
  const [invitation] = await db
    .select({ id: organisationInvitations.id, organisationId: organisationInvitations.organisationId, email: organisationInvitations.email })
    .from(organisationInvitations)
    .where(and(eq(organisationInvitations.id, input.invitationId), eq(organisationInvitations.status, "pending")))
    .limit(1);
  if (!invitation) throw new MutationError("not_found", "That invitation no longer exists.");
  const org = await membershipOf(actor, invitation.organisationId, true);

  await db.transaction(async (tx) => {
    await tx.update(organisationInvitations).set({ status: "revoked" }).where(and(eq(organisationInvitations.id, invitation.id), eq(organisationInvitations.status, "pending")));
    await tx.insert(auditEvents).values({ workspaceId: org.workspaceId, organisationId: org.id, actorId: actor.id, action: "organisation.invitation_revoked", targetType: "invitation", targetId: invitation.id });
  });
  return { email: invitation.email };
}

/**
 * Pending, unexpired invitation for a link token, with what the invite page shows.
 * Unknown, used, revoked and expired tokens all return null.
 */
export async function findInvitation(token: string) {
  const [row] = await db
    .select({
      id: organisationInvitations.id,
      email: organisationInvitations.email,
      role: organisationInvitations.role,
      organisationName: organisations.name,
      inviterName: users.name,
    })
    .from(organisationInvitations)
    .innerJoin(organisations, eq(organisations.id, organisationInvitations.organisationId))
    .innerJoin(users, eq(users.id, organisationInvitations.invitedById))
    .where(
      and(
        eq(organisationInvitations.token, hashInvitationToken(token)),
        eq(organisationInvitations.status, "pending"),
        gte(organisationInvitations.expiresAt, sql`now()`)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Accepts an invitation for the signed-in person. The account's verified email must be
 * the invited address. The link works once: the row is locked and marked accepted in the
 * same transaction as the membership is added.
 */
export async function acceptInvitation(
  user: { id: string; email: string; emailVerified: boolean },
  input: z.infer<typeof acceptInvitationSchema>
): Promise<{ slug: string }> {
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(organisationInvitations)
      .where(eq(organisationInvitations.token, hashInvitationToken(input.token)))
      .limit(1)
      .for("update");
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt.getTime() < Date.now()) {
      throw new MutationError("not_found", "This invitation is no longer valid. Ask for a new one.");
    }
    if (!user.emailVerified || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new MutationError("forbidden", "This invitation is for a different email address.");
    }
    const [org] = await tx.select({ slug: organisations.slug, workspaceId: organisations.workspaceId }).from(organisations).where(eq(organisations.id, invitation.organisationId)).limit(1);
    if (!org) throw new MutationError("not_found", "This invitation is no longer valid. Ask for a new one.");

    // Someone already in the organisation keeps their current role
    await tx.insert(organisationMembers).values({ organisationId: invitation.organisationId, userId: user.id, role: invitation.role }).onConflictDoNothing();
    await tx.update(organisationInvitations).set({ status: "accepted" }).where(eq(organisationInvitations.id, invitation.id));
    await tx.insert(auditEvents).values({
      workspaceId: org.workspaceId,
      organisationId: invitation.organisationId,
      actorId: user.id,
      action: "organisation.member_joined",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { role: invitation.role },
    });
    return { slug: org.slug };
  });
}

/**
 * Loads the actor's and the target's memberships with the target row locked, and applies
 * the rules shared by role changes and removal: the owner is never changed or removed,
 * nobody changes themselves here, and only the owner touches admins.
 */
async function lockTarget(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, organisationId: string, userId: string, nextRole?: string) {
  const org = await membershipOf(actor, organisationId, true);
  const [target] = await tx
    .select({ role: organisationMembers.role })
    .from(organisationMembers)
    .where(and(eq(organisationMembers.organisationId, org.id), eq(organisationMembers.userId, userId)))
    .limit(1)
    .for("update");
  if (!target) throw new MutationError("not_found", "That person is not a member.");
  if (userId === actor.id) throw new MutationError("invalid", "You can't change your own membership here.");
  if (target.role === "owner") throw new MutationError("forbidden", "The owner can't be changed or removed.");
  if ((target.role === "admin" || nextRole === "admin") && org.role !== "owner") throw new MutationError("forbidden", "Only the owner can change admins.");
  return { org, target };
}

/** Changes a member's role (admin, member, viewer). Takes effect on their next request. */
export async function setMemberRole(actor: Actor, input: z.infer<typeof setMemberRoleSchema>): Promise<{ role: string }> {
  return db.transaction(async (tx) => {
    const { org, target } = await lockTarget(tx, actor, input.organisationId, input.userId, input.role);
    if (target.role === input.role) return { role: input.role };
    await tx.update(organisationMembers).set({ role: input.role }).where(and(eq(organisationMembers.organisationId, org.id), eq(organisationMembers.userId, input.userId)));
    await tx.insert(auditEvents).values({
      workspaceId: org.workspaceId,
      organisationId: org.id,
      actorId: actor.id,
      action: "organisation.member_role_changed",
      targetType: "user",
      targetId: input.userId,
      metadata: { from: target.role, to: input.role },
    });
    return { role: input.role };
  });
}

/**
 * Takes a person out of an organisation: their membership goes, and the organisation's
 * open tasks assigned to them become unassigned. Their commits stay in its history.
 */
async function leave(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], org: { id: string; workspaceId: string }, userId: string) {
  await tx.delete(organisationMembers).where(and(eq(organisationMembers.organisationId, org.id), eq(organisationMembers.userId, userId)));
  await tx
    .update(tasks)
    .set({ assigneeId: null })
    .where(and(eq(tasks.workspaceId, org.workspaceId), eq(tasks.assigneeId, userId), isNull(tasks.completedAt)));
}

/** Removes another member. Owners remove anyone but themselves; admins remove members and viewers. */
export async function removeMember(actor: Actor, input: z.infer<typeof memberRefSchema>): Promise<{ removed: true }> {
  return db.transaction(async (tx) => {
    const { org } = await lockTarget(tx, actor, input.organisationId, input.userId);
    await leave(tx, org, input.userId);
    await tx.insert(auditEvents).values({ workspaceId: org.workspaceId, organisationId: org.id, actorId: actor.id, action: "organisation.member_removed", targetType: "user", targetId: input.userId });
    return { removed: true };
  });
}

/** Leaves an organisation. The owner cannot leave the organisation they own. */
export async function leaveOrganisation(actor: Actor, input: z.infer<typeof organisationRefSchema>): Promise<{ name: string }> {
  const org = await membershipOf(actor, input.organisationId, false);
  if (org.role === "owner") throw new MutationError("invalid", "Owners can't leave their own organisation.");
  await db.transaction(async (tx) => {
    await leave(tx, org, actor.id);
    await tx.insert(auditEvents).values({ workspaceId: org.workspaceId, organisationId: org.id, actorId: actor.id, action: "organisation.member_left", targetType: "user", targetId: actor.id });
  });
  return { name: org.name };
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

/**
 * Corrects a commit's message, project and tags. Its time, execution value, author,
 * source and task stay as recorded. The author can edit their own commits; in an
 * organisation, owners and admins can edit anyone's. The project must be a live project
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
    if (commit.userId !== actor.id) {
      const [membership] = await tx
        .select({ role: organisationMembers.role })
        .from(organisationMembers)
        .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
        .where(and(eq(organisations.workspaceId, commit.workspaceId), eq(organisationMembers.userId, actor.id)))
        .limit(1);
      if (!membership || !MANAGER_ROLES.includes(membership.role)) throw new MutationError("forbidden", "Only its author, an owner or an admin can edit this commit.");
    }

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
 * New objective in the actor's personal workspace or an organisation they can write to.
 * It starts now; the deadline is the end of that day in the actor's timezone and must not
 * be in the past. An optional project (live, same workspace) narrows what it measures.
 */
export async function createObjective(actor: Actor, input: z.infer<typeof createObjectiveSchema>): Promise<{ id: string }> {
  let workspaceId = actor.personalWorkspaceId;
  if (input.organisationId) {
    const [org] = await db.select({ workspaceId: organisations.workspaceId }).from(organisations).where(eq(organisations.id, input.organisationId)).limit(1);
    workspaceId = org?.workspaceId ?? null;
  }
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
  if (input.deadline && input.deadline < dayIn(new Date(), tz)) throw new MutationError("invalid", "Pick a deadline from today on.");

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
