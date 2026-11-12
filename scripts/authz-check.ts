/**
 * Object-level authorization (BOLA / IDOR) regression suite for the product's read
 * queries and write mutations. Every account (the owner and each demo visitor) is its
 * own tenant, so this runs the real query and mutation code against a disposable
 * database holding three tenants it creates itself: A (with demo data), B and an
 * outsider X.
 *
 *   createdb state_security_test   # once
 *   DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run db:migrate
 *   DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run authz:check
 *
 * Refuses to run unless the database name ends in `_test`: it changes roles and data.
 * Exits non-zero if any check fails.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import * as s from "../db/schema";
import { getBoard, getCommitDetail, getEligibleDays, getDeletedTasks, getCommitTotals, getCommits, getInbox, getObjectives, getProjects, getTaskDetail, getTicker, searchWork } from "../db/queries";
import { loadActor, MutationError, type Actor } from "../lib/authz";
import { addBoardTask, finishOnboarding, createObjective, setObjectiveArchived, setObjectiveProgress, editCommit, setTaskRecurrence, captureTask, createManualCommit, createProject, setProjectArchived, updateProject, deleteTask, importData, moveTask, placeTask, renameTask, restoreTask, setTaskDue, setTaskPriority, setTaskProject, setTaskWeight, setTimezone, completeTask, addColumn, bulkRestoreTasks, bulkUpdateTasks, deleteColumn, moveColumn, renameColumn, setColumnLimit, withdrawCommit, restoreCommit } from "../lib/mutations";
import { addBoardTaskSchema, finishOnboardingSchema, createObjectiveSchema, setObjectiveProgressSchema, parseQuickCapture, editCommitSchema, setTaskRecurrenceSchema, captureTaskSchema, createProjectSchema, importSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskProjectSchema, setTaskWeightSchema, setTimezoneSchema, taskRefSchema, bulkUpdateSchema } from "../lib/validation";
import { buildExport } from "../lib/data/export";
import { parseImport } from "../lib/data/import";
import { parseCsv, toCsv } from "../lib/data/csv";
import { deleteAccount } from "../lib/accounts/delete";
import { DEMO_TTL_MS, endDemo, pruneDemos } from "../lib/demo/session";
import { isOwnerCode } from "../lib/auth/owner";
import { nextDueDay } from "../lib/recurrence";
import { provisionAccount } from "../lib/accounts/provision";
import { seedDemoData } from "../lib/demo/seed";

const dbName = new URL(process.env.DATABASE_URL ?? "postgres://x/none").pathname.slice(1);
if (!dbName.endsWith("_test")) {
  console.error(`Refusing to run against "${dbName}". Point DATABASE_URL at a *_test database.`);
  process.exit(2);
}

const results: { id: string; name: string; pass: boolean; detail: string }[] = [];
const record = (id: string, name: string, pass: boolean, detail = "") => results.push({ id, name, pass, detail });

async function expectError(fn: () => Promise<unknown>, code: MutationError["code"]): Promise<[boolean, string]> {
  try {
    await fn();
    return [false, "succeeded"];
  } catch (e) {
    if (e instanceof MutationError) return [e.code === code, `${e.code}: ${e.message}`];
    return [false, String(e)];
  }
}

const one = async <T>(p: Promise<T[]>) => (await p)[0];

async function personal(userId: string) {
  const ws = await one(db.select().from(s.workspaces).where(and(eq(s.workspaces.ownerId, userId), eq(s.workspaces.type, "personal"))));
  const board = await one(db.select().from(s.boards).where(eq(s.boards.workspaceId, ws.id)));
  const cols = await db.select().from(s.columns).where(eq(s.columns.boardId, board.id));
  const col = (state: string) => cols.find((c) => c.stateType === state)!;
  const task = await one(
    db.select().from(s.tasks).where(and(eq(s.tasks.boardId, board.id), isNull(s.tasks.completedAt), isNull(s.tasks.deletedAt)))
  );
  const commit = await one(db.select().from(s.commits).where(and(eq(s.commits.workspaceId, ws.id), isNull(s.commits.deletedAt))));
  const project = await one(db.select().from(s.projects).where(eq(s.projects.workspaceId, ws.id)));
  return { ws, board, col, task, commit, project };
}

async function snapshot(taskId: string) {
  return one(
    db
      .select({ b: s.tasks.boardId, c: s.tasks.columnId, p: s.tasks.position, d: s.tasks.completedAt, x: s.tasks.deletedAt })
      .from(s.tasks)
      .where(eq(s.tasks.id, taskId))
  );
}

async function titleOf(taskId: string) {
  return (await one(db.select({ t: s.tasks.title }).from(s.tasks).where(eq(s.tasks.id, taskId)))).t;
}

async function priorityOf(taskId: string) {
  return (await one(db.select({ p: s.tasks.priority }).from(s.tasks).where(eq(s.tasks.id, taskId)))).p;
}

async function weightOf(taskId: string) {
  return (await one(db.select({ w: s.tasks.weight }).from(s.tasks).where(eq(s.tasks.id, taskId)))).w;
}

async function projectCount(workspaceId: string, slug: string) {
  return (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.projects).where(and(eq(s.projects.workspaceId, workspaceId), eq(s.projects.slug, slug))))).n;
}

async function projectRow(id: string) {
  return one(db.select().from(s.projects).where(eq(s.projects.id, id)));
}

async function dueOf(taskId: string) {
  return (await one(db.select({ d: s.tasks.dueAt }).from(s.tasks).where(eq(s.tasks.id, taskId)))).d?.getTime() ?? null;
}

async function main() {
  const stamp = Date.now();
  const [parthId, aaravId, outsiderId] = [`authz-a-${stamp}`, `authz-b-${stamp}`, `authz-x-${stamp}`];
  await db.insert(s.users).values([
    { id: parthId, name: "Tenant A", email: `${parthId}@example.test`, emailVerified: true },
    { id: aaravId, name: "Tenant B", email: `${aaravId}@example.test`, emailVerified: true },
    { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.test` },
  ]);
  for (const id of [parthId, aaravId, outsiderId]) await provisionAccount(id);
  await seedDemoData(parthId);
  const parth = await personal(parthId);
  const aarav = await personal(aaravId);
  // B starts empty; add the objects other tenants will target
  aarav.project ??= (await db.insert(s.projects).values({ workspaceId: aarav.ws.id, name: "Private", slug: "private" }).returning())[0];
  aarav.task ??= (
    await db
      .insert(s.tasks)
      .values({ workspaceId: aarav.ws.id, boardId: aarav.board.id, columnId: aarav.col("backlog").id, creatorId: aaravId, title: "Private task" })
      .returning()
  )[0];
  const outWs = (await personal(outsiderId)).ws;

  const A: Actor = await loadActor(parthId);
  const B: Actor = await loadActor(aaravId);
  const X: Actor = await loadActor(outsiderId);
  const readable = (a: Actor) => [...a.readable];

  // ------------------------------------------------------------ reads (BOLA)
  record("R1", "Read another user's personal task by id", (await getTaskDetail(parth.task.id, readable(B))) === null);
  record("R2", "Read another user's commit by id", (await getCommitDetail(parth.commit.id, readable(B))) === null);
  record("R3", "Read another user's personal board by id", (await getBoard(parth.board.id, readable(B))) === null);
  const xProjects = await getProjects(readable(X), "UTC");
  record("R6", "Project list leaks no foreign projects", xProjects.length === 0, `${xProjects.length} rows`);
  const xCommits = await getCommits({ workspaceIds: readable(X) });
  record("R7", "Commit ledger leaks no foreign commits", xCommits.length === 0, `${xCommits.length} rows`);
  record("R8", "Inbox of a foreign workspace id is empty for its query scope", (await getInbox(outWs.id)).length === 0);
  // Ticker: scoped by workspace and user, so another user's id inside a foreign scope sums nothing
  const xTicker = await getTicker({ workspaceIds: readable(X), userId: parthId }, "UTC");
  record("R10", "Top-bar ticker sums no foreign commits", xTicker.last7 + xTicker.prev7 + xTicker.today === 0, JSON.stringify(xTicker));
  const eligible = [await getEligibleDays({ workspaceIds: readable(X), userId: outsiderId }, "UTC", 30), await getEligibleDays({ workspaceIds: readable(A), userId: parthId }, "UTC", 30)];
  record("Q1", "Consistency counts only days since the account began (new: 1, seeded history: 30)", JSON.stringify(eligible) === "[1,30]", JSON.stringify(eligible));

  // ------------------------------------------------------------ writes (IDOR)
  let before = await snapshot(parth.task.id);
  let [ok, detail] = await expectError(() => moveTask(B, { taskId: parth.task.id, columnId: parth.col("done").id, afterTaskId: null }), "not_found");
  record("W1", "Move another user's task to Done", ok && JSON.stringify(await snapshot(parth.task.id)) === JSON.stringify(before), detail);

  [ok, detail] = await expectError(() => moveTask(A, { taskId: parth.task.id, columnId: aarav.col("active").id, afterTaskId: null }), "not_found");
  record("W3", "Move own task into a column on someone else's board", ok, detail);

  const foreignBefore = await snapshot(aarav.task.id);
  await moveTask(A, { taskId: parth.task.id, columnId: parth.col("backlog").id, afterTaskId: aarav.task.id });
  record("W5", "Foreign afterTaskId is ignored, foreign task untouched", JSON.stringify(await snapshot(aarav.task.id)) === JSON.stringify(foreignBefore));

  const commitsBefore = await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits));
  [ok, detail] = await expectError(() => createManualCommit(A, { message: "forged", projectId: aarav.project.id, weight: 8 }), "not_found");
  const commitsAfter = await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits));
  record("W8", "Manual commit into another user's project", ok && commitsBefore.n === commitsAfter.n, detail);

  const own = await createManualCommit(B, { message: "Reviewed notes", projectId: aarav.project.id, weight: 2 });
  const ownRow = await one(db.select().from(s.commits).where(eq(s.commits.id, own.id)));
  record("W9", "Manual commit lands in the project's workspace, authored by the session user", ownRow.workspaceId === aarav.ws.id && ownRow.userId === aaravId && ownRow.source === "manual");
  await db.delete(s.commits).where(eq(s.commits.id, own.id));

  const cap = await captureTask(A, { text: `Probe #${aarav.project.slug} !high` });
  const capRow = await one(db.select().from(s.tasks).where(eq(s.tasks.id, cap.id)));
  record(
    "W10",
    "Capture with another workspace's #project stays in own Inbox, no foreign project",
    capRow.workspaceId === parth.ws.id && capRow.boardId === null && (capRow.projectId === null || capRow.projectId !== aarav.project.id)
  );

  // Defence in depth: even a mis-built actor cannot write outside its own writable set
  [ok, detail] = await expectError(() => captureTask({ ...X, personalWorkspaceId: parth.ws.id }, { text: "inject" }), "not_found");
  record("W11", "Capture into a workspace the session cannot write to", ok, detail);

  // Inbox triage and delete / undo across tenants
  const inboxTask = await captureTask(A, { text: "Inbox probe" });
  before = await snapshot(inboxTask.id);
  [ok, detail] = await expectError(() => placeTask(B, { taskId: inboxTask.id, columnId: aarav.col("backlog").id }), "not_found");
  record("W13", "Place another user's Inbox task onto own board", ok && JSON.stringify(await snapshot(inboxTask.id)) === JSON.stringify(before), detail);
  [ok, detail] = await expectError(() => placeTask(A, { taskId: inboxTask.id, columnId: aarav.col("backlog").id }), "not_found");
  record("W14", "Place own Inbox task onto someone else's board", ok && (await snapshot(inboxTask.id)).b === null, detail);
  [ok, detail] = await expectError(() => deleteTask(B, { taskId: parth.task.id }), "not_found");
  record("W16", "Delete another user's task", ok && (await snapshot(parth.task.id)).x === null, detail);
  await deleteTask(A, { taskId: inboxTask.id });
  [ok, detail] = await expectError(() => restoreTask(B, { taskId: inboxTask.id }), "not_found");
  record("W18", "Restore another user's deleted task", ok && (await snapshot(inboxTask.id)).x !== null, detail);
  [ok, detail] = await expectError(() => placeTask(A, { taskId: inboxTask.id, columnId: parth.col("backlog").id }), "not_found");
  record("W19", "Deleted Inbox task cannot be placed", ok, detail);
  [ok, detail] = await expectError(() => renameTask(A, { taskId: inboxTask.id, title: "Renamed while deleted" }), "not_found");
  record("W22", "Deleted task cannot be renamed", ok && (await titleOf(inboxTask.id)) === "Inbox probe", detail);
  await restoreTask(A, { taskId: inboxTask.id });
  record("W20", "Owner restores own deleted task", (await snapshot(inboxTask.id)).x === null);
  [ok, detail] = await expectError(() => renameTask(B, { taskId: parth.task.id, title: "hijacked" }), "not_found");
  record("W23", "Rename another user's task", ok && (await titleOf(parth.task.id)) === parth.task.title, detail);
  [ok, detail] = await expectError(() => setTaskPriority(B, { taskId: parth.task.id, priority: "critical" }), "not_found");
  record("W27", "Change another user's task priority", ok && (await priorityOf(parth.task.id)) === parth.task.priority, detail);
  await setTaskPriority(A, { taskId: inboxTask.id, priority: "high" });
  record("W29", "Owner changes own task priority", (await priorityOf(inboxTask.id)) === "high");
  const projectOf = async (id: string) => (await one(db.select({ p: s.tasks.projectId }).from(s.tasks).where(eq(s.tasks.id, id)))).p;
  const parthTaskProject = await projectOf(parth.task.id);
  [ok, detail] = await expectError(() => setTaskProject(B, { taskId: parth.task.id, projectId: aarav.project.id }), "not_found");
  record("W55", "File another user's task under own project", ok && (await projectOf(parth.task.id)) === parthTaskProject, detail);
  [ok, detail] = await expectError(() => setTaskProject(A, { taskId: inboxTask.id, projectId: aarav.project.id }), "not_found");
  record("W56", "File own task under another user's project", ok && (await projectOf(inboxTask.id)) === null, detail);
  [ok, detail] = await expectError(() => setTaskProject(X, { taskId: parth.task.id, projectId: null }), "not_found");
  record("W57", "Outsider unfiles a task", ok && (await projectOf(parth.task.id)) === parthTaskProject, detail);
  await setTaskProject(A, { taskId: inboxTask.id, projectId: parth.project.id });
  const filed = await projectOf(inboxTask.id);
  await setTaskProject(A, { taskId: inboxTask.id, projectId: null });
  record("W58", "Owner files own task under own project and unfiles it", filed === parth.project.id && (await projectOf(inboxTask.id)) === null);
  [ok, detail] = await expectError(() => setTaskWeight(B, { taskId: parth.task.id, weight: 8 }), "not_found");
  record("W31", "Change another user's task weight", ok && (await weightOf(parth.task.id)) === parth.task.weight, detail);
  await setTaskWeight(A, { taskId: inboxTask.id, weight: 4 });
  record("W33", "Owner changes own open task weight", (await weightOf(inboxTask.id)) === 4);
  [ok, detail] = await expectError(() => setTaskDue(B, { taskId: parth.task.id, dueDate: "2030-01-01" }), "not_found");
  record("W51", "Set a due date on another user's task", ok && (await dueOf(parth.task.id)) === (parth.task.dueAt?.getTime() ?? null), detail);
  // Due day is read in the actor's timezone and stored as 23:59 local
  await db.update(s.users).set({ timezone: "Asia/Kolkata" }).where(eq(s.users.id, parthId));
  await setTaskDue(A, { taskId: inboxTask.id, dueDate: "2030-03-15" });
  const dueIso = new Date((await dueOf(inboxTask.id))!).toISOString();
  await setTaskDue(A, { taskId: inboxTask.id, dueDate: null });
  record("W53", "Owner sets a due date (end of day, own timezone) and clears it", dueIso === "2030-03-15T18:29:00.000Z" && (await dueOf(inboxTask.id)) === null, dueIso);

  const mine = await createProject(A, { name: "Authz probe", slug: "authz-probe", description: null });
  const mineRow = await one(db.select().from(s.projects).where(eq(s.projects.id, mine.id)));
  record("W37", "Personal project lands in the actor's own workspace", mineRow.workspaceId === parth.ws.id && mine.href === "/platform/projects/authz-probe");
  const theirs = await createProject(B, { name: "Authz probe", slug: "authz-probe", description: null });
  record("W38", "Same slug in another user's workspace is independent", theirs.id !== mine.id && (await projectCount(aarav.ws.id, "authz-probe")) === 1);
  [ok, detail] = await expectError(() => createProject(A, { name: "Again", slug: "authz-probe", description: null }), "conflict");
  record("W39", "Duplicate slug in the same workspace is refused", ok && (await projectCount(parth.ws.id, "authz-probe")) === 1, detail);
  // Project edit and archive
  const parthProjectBefore = JSON.stringify(await projectRow(parth.project.id));
  [ok, detail] = await expectError(() => updateProject(B, { projectId: parth.project.id, name: "Hijacked", slug: "hijacked", description: null, status: "paused" }), "not_found");
  record("W43", "Edit another user's project", ok && JSON.stringify(await projectRow(parth.project.id)) === parthProjectBefore, detail);
  [ok, detail] = await expectError(() => setProjectArchived(B, { projectId: parth.project.id, archived: true }), "not_found");
  record("W45", "Archive another user's project", ok && (await projectRow(parth.project.id)).archivedAt === null, detail);
  [ok, detail] = await expectError(() => updateProject(A, { projectId: mine.id, name: "Authz probe", slug: parth.project.slug, description: null, status: "active" }), "conflict");
  record("W46", "Renaming to a slug used in the same workspace is refused", ok && (await projectRow(mine.id)).slug === "authz-probe", detail);
  const edited = await updateProject(A, { projectId: mine.id, name: "Authz probe 2", slug: "authz-probe-2", description: "Edited", status: "paused" });
  const editedRow = await projectRow(mine.id);
  const recaptured = await captureTask(A, { text: "After rename #authz-probe-2" });
  record(
    "W47",
    "Owner edits own project; #capture follows the new slug",
    edited.href === "/platform/projects/authz-probe-2" && editedRow.name === "Authz probe 2" && editedRow.status === "paused" && recaptured.projectName === "Authz probe 2"
  );
  await setProjectArchived(A, { projectId: mine.id, archived: true });
  const archivedCapture = await captureTask(A, { text: "After archive #authz-probe-2" });
  [ok, detail] = await expectError(() => createManualCommit(A, { message: "x", projectId: mine.id, weight: 1 }), "not_found");
  const listed = (await getProjects([parth.ws.id], "UTC")).some((p) => p.id === mine.id);
  record("W48", "Archived project leaves lists, #capture and commits", ok && archivedCapture.projectName === null && !listed && (await projectRow(mine.id)).archivedAt !== null, detail);
  await setProjectArchived(A, { projectId: mine.id, archived: false });
  record("W49", "Unarchive restores the project", (await projectRow(mine.id)).archivedAt === null && (await getProjects([parth.ws.id], "UTC")).some((p) => p.id === mine.id));
  await db.update(s.tasks).set({ deletedAt: new Date() }).where(inArray(s.tasks.id, [recaptured.id, archivedCapture.id]));

  // ------------------------------------------------------------ mass assignment / tampering
  const extra = moveTaskSchema.safeParse({ taskId: "a", columnId: "b", afterTaskId: null, workspaceId: parth.ws.id, userId: parthId });
  record("M1", "Unknown fields (workspaceId, userId) rejected on move", !extra.success);
  const forged = manualCommitSchema.safeParse({ message: "x", projectId: null, weight: 2, userId: aaravId, source: "imported", createdAt: "2020-01-01" });
  record("M2", "Unknown fields (userId, source, createdAt) rejected on commit", !forged.success);
  const weights = [0, -4, 3, 1000, "8", 2.5].map((weight) => manualCommitSchema.safeParse({ message: "x", projectId: null, weight }).success);
  record("M3", "Commit weight outside 1/2/4/8 rejected", weights.every((w) => !w), JSON.stringify(weights));
  record("M4", "Oversized commit message rejected", !manualCommitSchema.safeParse({ message: "x".repeat(501), projectId: null, weight: 2 }).success);
  record("M5", "Oversized capture rejected", !captureTaskSchema.safeParse({ text: "x".repeat(501) }).success);
  const injected = moveTaskSchema.safeParse({ taskId: "' or 1=1 --", columnId: "x", afterTaskId: null });
  record("M6", "Id with SQL metacharacters rejected", !injected.success);
  record("M7", "Unknown fields (boardId, workspaceId) rejected on place", !placeTaskSchema.safeParse({ taskId: "a", columnId: "b", boardId: "c", workspaceId: parth.ws.id }).success);
  record("M9", "Unknown fields (completedAt, weight) rejected on rename", !renameTaskSchema.safeParse({ taskId: "a", title: "x", completedAt: null, weight: 8 }).success);
  const titles = ["", "   ", "x".repeat(501)].map((title) => renameTaskSchema.safeParse({ taskId: "a", title }).success);
  record("M10", "Blank or oversized title rejected on rename", titles.every((t) => !t), JSON.stringify(titles));
  const priorities = ["urgent", "", "HIGH", 1].map((priority) => setTaskPrioritySchema.safeParse({ taskId: "a", priority }).success);
  record("M11", "Priority outside none/low/medium/high/critical rejected", priorities.every((p) => !p), JSON.stringify(priorities));
  record("M22", "Unknown fields (workspaceId) rejected on task project", !setTaskProjectSchema.safeParse({ taskId: "a", projectId: null, workspaceId: parth.ws.id }).success);
  record("M12", "Unknown fields (weight, workspaceId) rejected on priority", !setTaskPrioritySchema.safeParse({ taskId: "a", priority: "low", weight: 8, workspaceId: parth.ws.id }).success);
  const taskWeights = [0, 3, 16, "4", 2.5].map((weight) => setTaskWeightSchema.safeParse({ taskId: "a", weight }).success);
  record("M13", "Task weight outside 1/2/4/8 rejected", taskWeights.every((w) => !w), JSON.stringify(taskWeights));
  record("M14", "Unknown fields (workspaceId, status, organisationId) rejected on project create", !createProjectSchema.safeParse({ name: "x", slug: "x", description: null, workspaceId: aarav.ws.id, status: "archived" }).success && !createProjectSchema.safeParse({ organisationId: null, name: "x", slug: "x", description: null }).success);
  const slugs = ["Relay DB", "-x", "x-", "a--b", "a_b", "", "x".repeat(101)].map((slug) => createProjectSchema.safeParse({ name: "x", slug, description: null }).success);
  record("M15", "Malformed project slugs rejected", slugs.every((v) => !v), JSON.stringify(slugs));
  const projectEdit = { projectId: "a", name: "x", slug: "x", description: null, status: "active" };
  record("M16", "Unknown fields (workspaceId, archivedAt) rejected on project edit", !updateProjectSchema.safeParse({ ...projectEdit, workspaceId: aarav.ws.id, archivedAt: null }).success);
  record("M17", "Status 'archived' is not set through edit", !updateProjectSchema.safeParse({ ...projectEdit, status: "archived" }).success);
  const archivedFlags = ["true", 1, null].map((archived) => setProjectArchivedSchema.safeParse({ projectId: "a", archived }).success);
  record("M18", "Non-boolean archive flag rejected", archivedFlags.every((v) => !v), JSON.stringify(archivedFlags));
  const dueDates = ["2030-02-30", "30-01-2030", "2030-1-5", "2030-01-01T00:00", "1999-12-31", "2101-01-01", "' or 1=1"].map(
    (dueDate) => setTaskDueSchema.safeParse({ taskId: "a", dueDate }).success
  );
  record("M19", "Malformed or out-of-range due dates rejected", dueDates.every((v) => !v), JSON.stringify(dueDates));
  record("M20", "Unknown fields (dueAt, tz) rejected on due date", !setTaskDueSchema.safeParse({ taskId: "a", dueDate: null, dueAt: new Date(), tz: "UTC" }).success);
  const descriptions = ["x".repeat(128), "x".repeat(129)].map((description) => createProjectSchema.safeParse({ name: "x", slug: "x", description }).success);
  record("M21", "Project description capped at 128 characters", descriptions[0] && !descriptions[1], JSON.stringify(descriptions));
  record("M8", "Unknown fields (deletedAt, userId) rejected on delete", !taskRefSchema.safeParse({ taskId: "a", deletedAt: null, userId: aaravId }).success);

  // ------------------------------------------------------------ lifecycle, races, replay
  const liveFor = async (taskId: string) =>
    (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits).where(and(eq(s.commits.taskId, taskId), isNull(s.commits.deletedAt))))).n;
  const raceTask = parth.task.id;
  const race = await Promise.allSettled(
    Array.from({ length: 10 }, () => moveTask(A, { taskId: raceTask, columnId: parth.col("done").id, afterTaskId: null }))
  );
  const committedTotal = race.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.committed : 0), 0);
  record("L1", "10 parallel Done moves record exactly one commit", (await liveFor(raceTask)) === 1 && committedTotal === parth.task.weight, `live=${await liveFor(raceTask)} committed=${committedTotal}`);
  const replay = await moveTask(A, { taskId: raceTask, columnId: parth.col("done").id, afterTaskId: null });
  record("L2", "Replayed Done move records nothing", replay.committed === 0 && (await liveFor(raceTask)) === 1);
  const reopen = await moveTask(A, { taskId: raceTask, columnId: parth.col("active").id, afterTaskId: null });
  record("L3", "Reopening retires the commit", reopen.reopened && (await liveFor(raceTask)) === 0);
  const redo = await moveTask(A, { taskId: raceTask, columnId: parth.col("done").id, afterTaskId: null });
  record("L4", "Completing again records one new commit", redo.committed === parth.task.weight && (await liveFor(raceTask)) === 1);

  [ok, detail] = await expectError(() => setTaskDue(A, { taskId: raceTask, dueDate: "2030-01-01" }), "invalid");
  record("L12", "Completed task's due date cannot be changed", ok, detail);

  [ok, detail] = await expectError(() => setTaskWeight(A, { taskId: raceTask, weight: 8 }), "invalid");
  const raceCommit = await one(db.select({ v: s.commits.executionValue }).from(s.commits).where(and(eq(s.commits.taskId, raceTask), isNull(s.commits.deletedAt))));
  record("L11", "Completed task weight is fixed; its commit keeps its execution", ok && (await weightOf(raceTask)) === parth.task.weight && raceCommit.v === parth.task.weight, detail);

  [ok, detail] = await expectError(() => deleteTask(A, { taskId: raceTask }), "invalid");
  record("L5", "Completed task cannot be deleted", ok && (await snapshot(raceTask)).x === null && (await liveFor(raceTask)) === 1, detail);

  [ok, detail] = await expectError(() => placeTask(A, { taskId: inboxTask.id, columnId: parth.col("done").id }), "invalid");
  record("L6", "Inbox task cannot be placed straight into Done", ok && (await snapshot(inboxTask.id)).b === null, detail);
  await placeTask(A, { taskId: inboxTask.id, columnId: parth.col("active").id });
  const placed = await one(db.select().from(s.tasks).where(eq(s.tasks.id, inboxTask.id)));
  record("L7", "Placing on an active column puts it on the board and starts it", placed.boardId === parth.board.id && placed.columnId === parth.col("active").id && placed.startedAt !== null && placed.completedAt === null);
  [ok, detail] = await expectError(() => placeTask(A, { taskId: inboxTask.id, columnId: parth.col("backlog").id }), "conflict");
  record("L8", "Task already on a board cannot be placed again", ok, detail);

  await db.update(s.tasks).set({ deletedAt: new Date() }).where(eq(s.tasks.id, cap.id));
  await db.update(s.tasks).set({ boardId: parth.board.id, columnId: parth.col("backlog").id }).where(eq(s.tasks.id, cap.id));
  [ok, detail] = await expectError(() => moveTask(A, { taskId: cap.id, columnId: parth.col("active").id, afterTaskId: null }), "not_found");
  record("L9", "Deleted task cannot be moved", ok, detail);

  await db.delete(s.projects).where(inArray(s.projects.id, [mine.id, theirs.id]));

  // ------------------------------------------------------------ recurring tasks
  const [{ tz: parthTz }] = await db.select({ tz: s.users.timezone }).from(s.users).where(eq(s.users.id, parthId));
  const [tag] = await db.insert(s.tags).values({ workspaceId: parth.ws.id, name: `authz-repeat-${Date.now()}` }).returning();
  const [repeat] = await db
    .insert(s.tasks)
    .values({ workspaceId: parth.ws.id, boardId: parth.board.id, columnId: parth.col("active").id, projectId: parth.project.id, creatorId: parthId, assigneeId: parthId, title: "Weekly review", weight: 4, priority: "high", startedAt: new Date() })
    .returning();
  await db.insert(s.taskTags).values({ taskId: repeat.id, tagId: tag.id });
  const ruleOf = async (taskId: string) => (await one(db.select({ r: s.tasks.recurrenceRule }).from(s.tasks).where(eq(s.tasks.id, taskId)))).r;
  const occurrences = (parentId: string) => db.select().from(s.tasks).where(and(eq(s.tasks.recurrenceParentId, parentId), isNull(s.tasks.deletedAt)));

  [ok, detail] = await expectError(() => setTaskRecurrence(B, { taskId: repeat.id, rule: "daily" }), "not_found");
  record("RC1", "Another user sets a repeat on someone's task", ok && (await ruleOf(repeat.id)) === null, detail);
  const badRules = [
    { taskId: repeat.id, rule: "hourly" },
    { taskId: repeat.id, rule: "interval:0" },
    { taskId: repeat.id, rule: "interval:1000" },
    { taskId: repeat.id, rule: "daily; drop table tasks" },
    { taskId: repeat.id, rule: "weekly", recurrenceParentId: aarav.task.id },
  ].map((v) => setTaskRecurrenceSchema.safeParse(v).success);
  record("RC3", "Repeat input rejects unknown rules, out-of-range intervals and extra keys", badRules.every((v) => !v), JSON.stringify(badRules));

  await setTaskRecurrence(A, { taskId: repeat.id, rule: "weekly" });
  await setTaskDue(A, { taskId: repeat.id, dueDate: "2020-01-06" }); // long overdue Monday
  const done1 = await moveTask(A, { taskId: repeat.id, columnId: parth.col("done").id, afterTaskId: null });
  const [next1] = await occurrences(repeat.id);
  const nextTags = next1 ? await db.select().from(s.taskTags).where(eq(s.taskTags.taskId, next1.id)) : [];
  const todayThere = new Intl.DateTimeFormat("en-CA", { timeZone: parthTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const nextDay = next1?.dueAt ? new Intl.DateTimeFormat("en-CA", { timeZone: parthTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(next1.dueAt) : null;
  record(
    "RC4",
    "Completing a recurring task records one commit and queues one next occurrence like it",
    done1.committed === 4 && done1.recurred && (await liveFor(repeat.id)) === 1 && Boolean(next1) && next1.workspaceId === parth.ws.id && next1.boardId === parth.board.id && next1.columnId === parth.col("backlog").id && next1.completedAt === null && next1.weight === 4 && next1.priority === "high" && next1.projectId === parth.project.id && next1.recurrenceRule === "weekly" && nextTags.length === 1 && nextDay !== null && nextDay > todayThere && new Date(`${nextDay}T00:00:00Z`).getUTCDay() === 1,
    `next due ${nextDay}, today ${todayThere}`
  );
  [ok, detail] = await expectError(() => setTaskRecurrence(A, { taskId: repeat.id, rule: "daily" }), "invalid");
  record("RC5", "A completed task's repeat cannot be changed", ok && (await ruleOf(repeat.id)) === "weekly", detail);

  await moveTask(A, { taskId: repeat.id, columnId: parth.col("active").id, afterTaskId: null });
  const done2 = await moveTask(A, { taskId: repeat.id, columnId: parth.col("done").id, afterTaskId: null });
  record("RC6", "Reopening and completing again adds no second occurrence", done2.committed === 4 && !done2.recurred && (await occurrences(repeat.id)).length === 1 && (await liveFor(repeat.id)) === 1);

  await setTaskRecurrence(A, { taskId: next1.id, rule: "daily" });
  await moveTask(A, { taskId: next1.id, columnId: parth.col("active").id, afterTaskId: null });
  const raced = await Promise.allSettled(Array.from({ length: 10 }, () => moveTask(A, { taskId: next1.id, columnId: parth.col("done").id, afterTaskId: null })));
  record("RC7", "10 parallel Done moves of a recurring task queue exactly one next occurrence", raced.every((r) => r.status === "fulfilled") && (await occurrences(next1.id)).length === 1 && (await liveFor(next1.id)) === 1);

  const days = [
    nextDueDay("weekdays", "2026-10-30", "2026-10-29"), // Friday -> Monday
    nextDueDay("monthly", "2026-01-31", "2026-01-20"), // clamps to February's last day
    nextDueDay("daily", "2026-10-01", "2026-10-29"), // overdue: tomorrow, never in the past
    nextDueDay("interval:14", null, "2026-10-29"),
    nextDueDay("weekly", "2026-12-28", "2026-12-20"), // across the year end
    nextDueDay("daily", "2000-01-01", "2026-10-29"), // decades overdue
  ];
  record("RC8", "Next due days: weekdays skip weekends, months clamp, late finishes never land in the past", JSON.stringify(days) === JSON.stringify(["2026-11-02", "2026-02-28", "2026-10-30", "2026-11-12", "2027-01-04", "2026-10-30"]), JSON.stringify(days));
  await db.delete(s.tasks).where(inArray(s.tasks.id, [repeat.id, next1.id, ...(await occurrences(next1.id)).map((t) => t.id)]));
  await db.delete(s.tags).where(eq(s.tags.id, tag.id));

  // ------------------------------------------------------------ commit corrections
  const commitRow = (id: string) => one(db.select().from(s.commits).where(eq(s.commits.id, id)));
  const tagsOf = async (commitId: string) =>
    (await db.select({ n: s.tags.name, w: s.tags.workspaceId }).from(s.commitTags).innerJoin(s.tags, eq(s.tags.id, s.commitTags.tagId)).where(eq(s.commitTags.commitId, commitId))).sort((a, b) => a.n.localeCompare(b.n));
  const frozen = (c: typeof s.commits.$inferSelect) => JSON.stringify([c.createdAt, c.executionValue, c.source, c.userId, c.taskId, c.workspaceId, c.deletedAt]);
  const myCommit = await commitRow(parth.commit.id);
  const [otherCommit] = await db.insert(s.commits).values({ workspaceId: aarav.ws.id, userId: aaravId, message: "B's own commit", executionValue: 2 }).returning();
  const edit = (commitId: string, extra: Partial<{ message: string; projectId: string | null; tags: string[] }> = {}) => ({ commitId, message: "Corrected", projectId: null, tags: [], ...extra });

  [ok, detail] = await expectError(() => editCommit(B, edit(myCommit.id)), "not_found");
  record("CE1", "Another user edits someone's personal commit", ok && (await commitRow(myCommit.id)).message === myCommit.message, detail);

  [ok, detail] = await expectError(() => editCommit(X, edit(otherCommit.id)), "not_found");
  record("CE2", "Outsider edits another tenant's commit", ok && (await commitRow(otherCommit.id)).message === otherCommit.message, detail);
  // A commit authored by someone else inside the actor's own workspace (defence in depth)
  const [foreignAuthored] = await db.insert(s.commits).values({ workspaceId: parth.ws.id, userId: aaravId, message: "Planted", executionValue: 1 }).returning();
  [ok, detail] = await expectError(() => editCommit(A, edit(foreignAuthored.id)), "forbidden");
  record("CE3", "Only the author can edit a commit", ok && (await commitRow(foreignAuthored.id)).message === "Planted", detail);
  await db.delete(s.commits).where(eq(s.commits.id, foreignAuthored.id));

  [ok, detail] = await expectError(() => editCommit(A, edit(myCommit.id, { projectId: aarav.project.id })), "not_found");
  const [crossOk, crossDetail] = await expectError(() => editCommit(B, edit(otherCommit.id, { projectId: parth.project.id })), "not_found");
  const [archived] = await db.insert(s.projects).values({ workspaceId: parth.ws.id, name: "Old", slug: `authz-old-${Date.now()}`, archivedAt: new Date() }).returning();
  const [archivedOk] = await expectError(() => editCommit(A, edit(myCommit.id, { projectId: archived.id })), "not_found");
  record("CE5", "Project must be live and in the commit's own workspace (no foreign, cross-workspace or archived)", ok && crossOk && archivedOk && (await commitRow(myCommit.id)).projectId === myCommit.projectId, `${detail} | ${crossDetail}`);
  await db.delete(s.projects).where(eq(s.projects.id, archived.id));

  const badEdits = [
    { ...edit(myCommit.id), executionValue: 8 },
    { ...edit(myCommit.id), createdAt: "2020-01-01T00:00:00Z" },
    { ...edit(myCommit.id), userId: aaravId },
    { ...edit(myCommit.id), workspaceId: aarav.ws.id },
    { ...edit(myCommit.id), taskId: aarav.task.id },
    { ...edit(myCommit.id), source: "imported" },
    edit(myCommit.id, { message: "   " }),
    edit(myCommit.id, { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
    edit(myCommit.id, { tags: ["a,b"] }),
  ].map((v) => editCommitSchema.safeParse(v).success);
  record("CE6", "Commit edits reject time, value, author, workspace, task and source fields, blank messages and bad tags", badEdits.every((v) => !v), JSON.stringify(badEdits));

  const editTarget = myCommit.projectId === parth.project.id ? null : parth.project.id;
  await editCommit(A, editCommitSchema.parse(edit(myCommit.id, { message: "  Corrected message  ", projectId: editTarget, tags: ["Deep Work", "deep work", "review"] })));
  const corrected = await commitRow(myCommit.id);
  const editedTags = await tagsOf(myCommit.id);
  const audit = await one(db.select().from(s.auditEvents).where(and(eq(s.auditEvents.action, "commit.edited"), eq(s.auditEvents.targetId, myCommit.id))));
  record(
    "CE7",
    "Author corrects message, project and tags; time, execution, author, source and task are unchanged",
    corrected.message === "Corrected message" && corrected.projectId === editTarget && frozen(corrected) === frozen(myCommit) && JSON.stringify(editedTags.map((t) => t.n)) === JSON.stringify(["deep work", "review"]) && editedTags.every((t) => t.w === parth.ws.id) && Boolean(audit) && audit.actorId === parthId,
    JSON.stringify(editedTags.map((t) => t.n))
  );

  await db.update(s.commits).set({ deletedAt: new Date() }).where(eq(s.commits.id, otherCommit.id));
  [ok, detail] = await expectError(() => editCommit(B, edit(otherCommit.id)), "not_found");
  record("CE9", "A retired commit cannot be edited", ok, detail);
  await db.delete(s.commits).where(eq(s.commits.id, otherCommit.id));

  // ------------------------------------------------------------ search
  const secret = `zz-private-${Date.now()}`;
  const [secretTask] = await db.insert(s.tasks).values({ workspaceId: parth.ws.id, boardId: parth.board.id, columnId: parth.col("backlog").id, creatorId: parthId, title: `${secret} task` }).returning();
  const [secretCommit] = await db.insert(s.commits).values({ workspaceId: parth.ws.id, userId: parthId, message: `${secret} commit`, executionValue: 1 }).returning();
  const ownHits = await searchWork(secret, readable(A));
  record("S1", "Search finds the owner's own tasks and commits", ownHits.some((h) => h.id === secretTask.id) && ownHits.some((h) => h.id === secretCommit.id), `${ownHits.length} hits`);
  const [bHits, xHits] = [await searchWork(secret, readable(B)), await searchWork(secret, readable(X))];
  record("S2", "Another user and an outsider find none of them", bHits.length === 0 && xHits.length === 0, `${bHits.length}/${xHits.length}`);
  const wild = await Promise.all(["%", "_", "%%", "\\", "' or 1=1 --"].map((q) => searchWork(q, readable(A))));
  record("S4", "Wildcards and quotes match literally, never everything", wild.every((hits) => hits.length === 0 || hits.every((h) => /[%_\\']/.test(h.title))), wild.map((w) => w.length).join(","));
  await db.update(s.tasks).set({ deletedAt: new Date() }).where(eq(s.tasks.id, secretTask.id));
  await db.update(s.commits).set({ deletedAt: new Date() }).where(eq(s.commits.id, secretCommit.id));
  record("S5", "Deleted tasks and retired commits are not found", (await searchWork(secret, readable(A))).length === 0);
  const capped = await searchWork("e", readable(A));
  record("S6", "Results are bounded", capped.filter((h) => h.kind === "task").length <= 8 && capped.filter((h) => h.kind === "commit").length <= 8, `${capped.length}`);
  await db.delete(s.tasks).where(eq(s.tasks.id, secretTask.id));
  await db.delete(s.commits).where(eq(s.commits.id, secretCommit.id));

  // ------------------------------------------------------------ capture tokens (#project @person dates)
  const taskRow = (id: string) => one(db.select().from(s.tasks).where(eq(s.tasks.id, id)));
  const localDay = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: parthTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null);
  const todayLocal = localDay(new Date())!;
  const tomorrowLocal = new Date(Date.parse(`${todayLocal}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const dated = await captureTask(A, { text: "Draft outline tomorrow !low" });
  const datedRow = await taskRow(dated.id);
  record("CP1", "Personal capture reads a due day in the person's timezone and keeps it in the Inbox", datedRow.title === "Draft outline" && localDay(datedRow.dueAt) === tomorrowLocal && datedRow.workspaceId === parth.ws.id && datedRow.boardId === null && datedRow.priority === "low", `${localDay(datedRow.dueAt)} vs ${tomorrowLocal}`);

  const atTask = await captureTask(A, { text: "Personal chore @aarav" });
  record("CP4", "@ is not a token: it stays in the title", (await taskRow(atTask.id)).title === "Personal chore @aarav");
  record("CP5", "Captured tasks belong to their author", (await taskRow(atTask.id)).assigneeId === parthId);

  const t = "2026-10-29"; // a Thursday
  const parses = [
    parseQuickCapture("call thu", t).dueDate === "2026-11-05",
    parseQuickCapture("ship 2026-02-30", t).dueDate === undefined && parseQuickCapture("ship 2026-02-30", t).title === "ship 2026-02-30",
    parseQuickCapture("email bob@x.com today", t).title === "email bob@x.com",
    parseQuickCapture("Sundays matter", t).dueDate === undefined,
    parseQuickCapture("plan monday @Ana.K #relay !HIGH", t).title === "plan @Ana.K" && parseQuickCapture("plan monday @Ana.K #relay !HIGH", t).dueDate === "2026-11-02",
    parseQuickCapture("x 1999-12-31", t).dueDate === undefined,
  ];
  const escaped = parseQuickCapture("Fix \\#12 \\!high on \\fri #relay !low", t);
  const plainHash = parseQuickCapture("Learn C# basics", t);
  record(
    "CP7",
    "Parser: backslash keeps #, ! and date words in the title; unescaped tokens still parse",
    escaped.title === "Fix #12 !high on fri" && escaped.projectSlug === "relay" && escaped.priority === "low" && escaped.dueDate === undefined && plainHash.title === "Learn C# basics",
    JSON.stringify({ escaped, plainHash })
  );
  record("CP6", "Parser: weekdays are the next one, impossible or out-of-range dates stay in the title, emails are not @people", parses.every(Boolean), JSON.stringify(parses));
  await db.delete(s.tasks).where(inArray(s.tasks.id, [dated.id, atTask.id]));

  // ------------------------------------------------------------ objectives
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const goal = (extra: Partial<Parameters<typeof createObjective>[1]> = {}) => ({ name: "Read 12 papers", measure: "manual" as const, unit: "papers", targetValue: 12, deadline: null, projectId: null, ...extra });
  const objectiveCount = async (workspaceId: string) => (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.objectives).where(eq(s.objectives.workspaceId, workspaceId)))).n;
  const aGoalsBefore = await objectiveCount(parth.ws.id);
  [ok, detail] = await expectError(() => createObjective({ ...X, personalWorkspaceId: parth.ws.id }, goal()), "not_found");
  const [foreignProject, foreignDetail] = await expectError(() => createObjective(A, goal({ projectId: aarav.project.id })), "not_found");
  record("OB1", "Objectives cannot be created in a foreign workspace or on a foreign project", ok && foreignProject && (await objectiveCount(parth.ws.id)) === aGoalsBefore && !createObjectiveSchema.safeParse({ ...goal(), organisationId: null }).success, `${detail} | ${foreignDetail}`);

  const badGoals = [
    { ...goal(), ownerId: aaravId },
    { ...goal(), workspaceId: aarav.ws.id },
    { ...goal(), currentValue: 12 },
    { ...goal(), startAt: "2020-01-01" },
    goal({ targetValue: -1 }),
    goal({ targetValue: 1.5 }),
    goal({ targetValue: 2_000_000 }),
    goal({ unit: "" }),
    goal({ deadline: "2026-02-30" }),
  ].map((v) => createObjectiveSchema.safeParse(v).success);
  const [pastDeadline, pastDetail] = await expectError(() => createObjective(A, goal({ deadline: "2020-01-01" })), "invalid");
  record("OB2", "Objective input rejects owner, workspace, current value, start, bad numbers, a missing unit and past deadlines", badGoals.every((v) => !v) && pastDeadline && !setObjectiveProgressSchema.safeParse({ objectiveId: "x", currentValue: 3, targetValue: 1 }).success, `${JSON.stringify(badGoals)} ${pastDetail}`);

  const manual = await createObjective(A, goal());
  [ok, detail] = await expectError(() => setObjectiveProgress(B, { objectiveId: manual.id, currentValue: 12 }), "not_found");
  const [archiveForeign] = await expectError(() => setObjectiveArchived(X, { objectiveId: manual.id, archived: true }), "not_found");
  const manualRow = async () => one(db.select().from(s.objectives).where(eq(s.objectives.id, manual.id)));
  record("OB3", "Another user and an outsider cannot update or archive an objective", ok && archiveForeign && (await manualRow()).currentValue === 0 && (await manualRow()).archivedAt === null, detail);

  const reached = await setObjectiveProgress(A, { objectiveId: manual.id, currentValue: 12 });
  const goalBack = await setObjectiveProgress(A, { objectiveId: manual.id, currentValue: 5 });
  record("OB4", "Reaching the target completes a counted objective; going back reopens it", reached.completed && !goalBack.completed && (await manualRow()).completedAt === null && (await manualRow()).currentValue === 5);

  // Execution objective: sums commits since it started, in its linked project only
  const execGoal = await createObjective(A, goal({ measure: "execution", unit: "", targetValue: 10, projectId: parth.project.id, name: "Execution goal" }));
  const [otherProject] = await db.insert(s.projects).values({ workspaceId: parth.ws.id, name: "Elsewhere", slug: `authz-elsewhere-${Date.now()}` }).returning();
  const commitsMade = await db
    .insert(s.commits)
    .values([
      { workspaceId: parth.ws.id, userId: parthId, projectId: parth.project.id, message: "counts 4", executionValue: 4 },
      { workspaceId: parth.ws.id, userId: parthId, projectId: parth.project.id, message: "counts 2", executionValue: 2 },
      { workspaceId: parth.ws.id, userId: parthId, projectId: otherProject.id, message: "other project", executionValue: 8 },
      { workspaceId: parth.ws.id, userId: parthId, projectId: parth.project.id, message: "before start", executionValue: 8, createdAt: daysAgo(30) },
      { workspaceId: parth.ws.id, userId: parthId, projectId: parth.project.id, message: "retired", executionValue: 8, deletedAt: new Date() },
    ])
    .returning({ id: s.commits.id });
  const execListed = (await getObjectives([parth.ws.id])).find((o) => o.id === execGoal.id);
  const [execProgress, execDetail] = await expectError(() => setObjectiveProgress(A, { objectiveId: execGoal.id, currentValue: 10 }), "invalid");
  record("OB5", "Execution objective = Σ live commit execution since it started, in its project; it cannot be set by hand", execListed?.currentValue === 6 && execListed.unit === "execution" && execProgress, `${execListed?.currentValue} ${execDetail}`);

  await setObjectiveArchived(A, { objectiveId: manual.id, archived: true });
  const hidden = !(await getObjectives([parth.ws.id])).some((o) => o.id === manual.id);
  const [archivedUpdate] = await expectError(() => setObjectiveProgress(A, { objectiveId: manual.id, currentValue: 6 }), "invalid");
  await setObjectiveArchived(A, { objectiveId: manual.id, archived: false });
  record("OB6", "Archived objectives leave the list, cannot be updated, and restore", hidden && archivedUpdate && (await getObjectives([parth.ws.id])).some((o) => o.id === manual.id) && !(await getObjectives(readable(B))).some((o) => o.id === manual.id));

  const fillerGoals = await db
    .insert(s.objectives)
    .values(Array.from({ length: 50 }, (_, i) => ({ workspaceId: aarav.ws.id, ownerId: aaravId, name: `Filler ${i}`, targetValue: 1, unit: "x" })))
    .returning({ id: s.objectives.id });
  [ok, detail] = await expectError(() => createObjective(B, goal()), "invalid");
  record("OB7", "At most 50 live objectives per workspace", ok, detail);
  await db.delete(s.objectives).where(inArray(s.objectives.id, [...fillerGoals.map((g) => g.id), manual.id, execGoal.id]));
  await db.delete(s.commits).where(inArray(s.commits.id, commitsMade.map((c) => c.id)));
  await db.delete(s.projects).where(eq(s.projects.id, otherProject.id));

  // ------------------------------------------------------------ first-run setup
  const firstTask = await addBoardTask(A, { title: "First task", weight: 4 });
  const firstRow = await one(db.select().from(s.tasks).where(eq(s.tasks.id, firstTask.id)));
  const [topOfQueued] = await db
    .select({ id: s.tasks.id })
    .from(s.tasks)
    .where(and(eq(s.tasks.columnId, parth.col("backlog").id), isNull(s.tasks.deletedAt)))
    .orderBy(sql`${s.tasks.position} collate "C"`)
    .limit(1);
  record("ON1", "Setup task lands at the top of the person's own Queued column", firstRow.workspaceId === parth.ws.id && firstRow.boardId === parth.board.id && firstRow.columnId === parth.col("backlog").id && firstRow.creatorId === parthId && firstRow.weight === 4 && topOfQueued.id === firstTask.id);
  [ok, detail] = await expectError(() => addBoardTask({ id: outsiderId, personalWorkspaceId: parth.ws.id, readable: new Set(), writable: new Set() }, { title: "x", weight: 2 }), "not_found");
  const badFirst = [
    { title: "x", weight: 2, boardId: aarav.board.id },
    // A foreign columnId passes the schema and is refused by the mutation (AB1)
    { title: "x", weight: 2, columnId: "not an id!" },
    { title: "x", weight: 2, workspaceId: aarav.ws.id },
    { title: "x", weight: 3 },
    { title: " ", weight: 2 },
  ].map((v) => addBoardTaskSchema.safeParse(v).success);
  record("ON2", "Setup task cannot target another board, column or workspace", ok && badFirst.every((v) => !v) && !finishOnboardingSchema.safeParse({ userId: aaravId }).success, `${detail} ${JSON.stringify(badFirst)}`);
  await db.delete(s.tasks).where(eq(s.tasks.id, firstTask.id));

  await db.update(s.users).set({ onboardedAt: null }).where(inArray(s.users.id, [parthId, aaravId]));
  await finishOnboarding(A);
  const [stampA] = await db.select({ t: s.users.onboardedAt }).from(s.users).where(eq(s.users.id, parthId));
  await finishOnboarding(A);
  const [stampA2] = await db.select({ t: s.users.onboardedAt }).from(s.users).where(eq(s.users.id, parthId));
  const [stampB] = await db.select({ t: s.users.onboardedAt }).from(s.users).where(eq(s.users.id, aaravId));
  record("ON3", "Finishing setup marks only the session user, once", stampA.t !== null && stampA2.t?.getTime() === stampA.t.getTime() && stampB.t === null);
  await db.update(s.users).set({ onboardedAt: new Date() }).where(eq(s.users.id, aaravId));

  // ------------------------------------------------------------ export, import, account deletion
  const execution = async (workspaceId: string) =>
    (await one(db.select({ n: sql<number>`coalesce(sum(${s.commits.executionValue}), 0)::int` }).from(s.commits).where(and(eq(s.commits.workspaceId, workspaceId), isNull(s.commits.deletedAt))))).n;
  const rowCount = async (workspaceId: string) => ({
    tasks: (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.tasks).where(eq(s.tasks.workspaceId, workspaceId)))).n,
    commits: (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits).where(eq(s.commits.workspaceId, workspaceId)))).n,
  });

  // ------------------------------------------------------------ complete, add on board, columns, bulk
  const probe = await addBoardTask(A, { title: "probe card" });
  [ok, detail] = await expectError(() => completeTask(B, { taskId: probe.id }), "not_found");
  record("CT1", "Complete another user's task", ok && (await snapshot(probe.id)).d === null, detail);
  const inboxProbe = await captureTask(A, { text: "inbox probe +4" });
  const completed = await completeTask(A, { taskId: inboxProbe.id });
  const inboxRow = await snapshot(inboxProbe.id);
  record("CT2", "Completing an Inbox task places it on the board's Done and records its commit", completed.committed === 4 && inboxRow.c === parth.col("done").id && inboxRow.d !== null, JSON.stringify(completed));
  [ok, detail] = await expectError(() => completeTask(A, { taskId: inboxProbe.id }), "conflict");
  record("CT3", "Completing a done task twice is refused", ok, detail);

  [ok, detail] = await expectError(() => addBoardTask(A, { title: "x", columnId: aarav.col("backlog").id }), "not_found");
  record("AB1", "Add a card to another user's column", ok, detail);
  [ok, detail] = await expectError(() => addBoardTask(A, { title: "x", columnId: parth.col("done").id }), "invalid");
  record("AB2", "Adding straight to Done is refused (no commit without a move)", ok, detail);
  const tokens = await addBoardTask(A, { title: `tokens #${parth.project.slug} !high +8 ~weekly`, columnId: parth.col("active").id });
  const tokensRow = await one(db.select().from(s.tasks).where(eq(s.tasks.id, tokens.id)));
  record("AB3", "Board add reads capture tokens and starts tasks added to Active", tokensRow.projectId === parth.project.id && tokensRow.priority === "high" && tokensRow.weight === 8 && tokensRow.recurrenceRule === "weekly" && tokensRow.startedAt !== null && tokensRow.title === "tokens");

  const colChecks = await Promise.all([
    expectError(() => renameColumn(B, { columnId: parth.col("backlog").id, name: "Pwned" }), "not_found"),
    expectError(() => setColumnLimit(B, { columnId: parth.col("active").id, limit: 1 }), "not_found"),
    expectError(() => addColumn(B, { afterColumnId: parth.col("backlog").id, name: "Pwned", stateType: "active" }), "not_found"),
    expectError(() => moveColumn(B, { columnId: parth.col("active").id, direction: "left" }), "not_found"),
    expectError(() => deleteColumn(B, { columnId: parth.col("active").id }), "not_found"),
  ]);
  const parthCols = await db.select({ name: s.columns.name, wip: s.columns.wipLimit }).from(s.columns).where(eq(s.columns.boardId, parth.board.id));
  record("COL1", "Rename, limit, add, move or delete another user's columns", colChecks.every(([pass]) => pass) && parthCols.length === 3 && !parthCols.some((c) => c.name === "Pwned" || c.wip !== null), JSON.stringify(colChecks.map(([, d]) => d)));
  [ok, detail] = await expectError(() => deleteColumn(A, { columnId: parth.col("done").id }), "invalid");
  record("COL2", "The Done column cannot be deleted", ok, detail);
  [ok, detail] = await expectError(() => addColumn(A, { afterColumnId: parth.col("done").id, name: "After", stateType: "active" }), "invalid");
  record("COL3", "No column goes after Done", ok, detail);
  const review = await addColumn(A, { afterColumnId: parth.col("active").id, name: "Review", stateType: "review" });
  await setColumnLimit(A, { columnId: review.id, limit: 2 });
  await deleteColumn(A, { columnId: review.id });
  record("COL4", "Own empty column: add, limit and delete", !(await one(db.select({ id: s.columns.id }).from(s.columns).where(eq(s.columns.id, review.id)))));
  [ok, detail] = await expectError(() => deleteColumn(A, { columnId: parth.col("active").id }), "conflict");
  record("COL5", "A column with tasks cannot be deleted", ok, detail);

  const priorityBefore = await priorityOf(probe.id);
  const foreignBulk = await bulkUpdateTasks(B, { taskIds: [probe.id], change: { type: "priority", priority: "critical" } });
  record("BU1", "Bulk change skips another user's task ids", foreignBulk.changed === 0 && (await priorityOf(probe.id)) === priorityBefore, JSON.stringify(foreignBulk));
  [ok, detail] = await expectError(() => bulkUpdateTasks(B, { taskIds: [aarav.task.id], change: { type: "move", columnId: parth.col("active").id } }), "not_found");
  record("BU2", "Bulk move into another user's column is refused", ok, detail);
  await bulkUpdateTasks(A, { taskIds: [probe.id], change: { type: "delete" } });
  const foreignRestore = await bulkRestoreTasks(B, { taskIds: [probe.id] });
  record("BU3", "Bulk restore of another user's deleted tasks does nothing", foreignRestore.restored === 0 && (await snapshot(probe.id)).x !== null, JSON.stringify(foreignRestore));
  const bulkParse = [
    bulkUpdateSchema.safeParse({ taskIds: Array.from({ length: 101 }, (_, i) => `t${i}`), change: { type: "delete" } }).success,
    bulkUpdateSchema.safeParse({ taskIds: ["a"], change: { type: "complete" } }).success,
    bulkUpdateSchema.safeParse({ taskIds: ["a"], change: { type: "delete" }, workspaceId: "x" }).success,
  ];
  record("BU4", "Bulk schema: at most 100 ids, known changes only, no extra keys", bulkParse.every((v) => !v), JSON.stringify(bulkParse));
  await bulkRestoreTasks(A, { taskIds: [probe.id] });
  const moved = await bulkUpdateTasks(A, { taskIds: [probe.id, tokens.id], change: { type: "move", columnId: parth.col("done").id } });
  record("BU5", "Bulk move to Done records each commit", moved.changed === 2 && moved.committed === 2 + 8, JSON.stringify(moved));
  await db.delete(s.commits).where(inArray(s.commits.taskId, [probe.id, tokens.id, inboxProbe.id]));
  await db.delete(s.tasks).where(inArray(s.tasks.id, [probe.id, tokens.id, inboxProbe.id]));

  // ------------------------------------------------------------ withdraw, trash, history totals
  const parthTaskIdsAll = new Set((await db.select({ id: s.tasks.id }).from(s.tasks).where(eq(s.tasks.workspaceId, parth.ws.id))).map((t) => t.id));
  const oops = await createManualCommit(A, { message: "oops +8", projectId: null, weight: 8 });
  [ok, detail] = await expectError(() => withdrawCommit(B, { commitId: oops.id }), "not_found");
  record("WD1", "Withdraw another user's commit", ok, detail);
  const taskCommit = await one(db.select({ id: s.commits.id }).from(s.commits).where(and(eq(s.commits.workspaceId, parth.ws.id), eq(s.commits.source, "task_completion"), isNull(s.commits.deletedAt))));
  [ok, detail] = await expectError(() => withdrawCommit(A, { commitId: taskCommit.id }), "invalid");
  record("WD2", "Task commits cannot be withdrawn directly", ok, detail);
  const oldManual = (await db.insert(s.commits).values({ workspaceId: parth.ws.id, userId: parthId, message: "old", executionValue: 2, source: "manual", createdAt: new Date(Date.now() - 25 * 3_600_000) }).returning())[0];
  [ok, detail] = await expectError(() => withdrawCommit(A, { commitId: oldManual.id }), "invalid");
  record("WD3", "Manual commits older than 24 hours stay", ok, detail);
  await withdrawCommit(A, { commitId: oops.id });
  [ok, detail] = await expectError(() => restoreCommit(B, { commitId: oops.id }), "not_found");
  record("WD4", "Restore another user's withdrawn commit", ok, detail);
  const restored = await restoreCommit(A, { commitId: oops.id });
  record("WD5", "Own withdrawal can be undone", restored.message === "oops +8");
  await db.delete(s.commits).where(inArray(s.commits.id, [oops.id, oldManual.id]));
  record("TR1", "Deleted-task list leaks no foreign tasks", (await getDeletedTasks(readable(X))).every((t) => !parthTaskIdsAll.has(t.id)));
  const xTotals = await getCommitTotals({ workspaceIds: readable(X), userId: parthId });
  record("TR2", "History totals sum no foreign commits", xTotals.count === 0, JSON.stringify(xTotals));

  // ------------------------------------------------------------ time zone
  const tzParse = [
    setTimezoneSchema.safeParse({ timezone: "Mars/Olympus" }).success,
    setTimezoneSchema.safeParse({ timezone: "Asia/Kolkata" }).success,
    setTimezoneSchema.safeParse({ timezone: "Asia/Kolkata", userId: aaravId }).success,
  ];
  record("TZ1", "Time zone schema accepts only known zones and no extra keys", JSON.stringify(tzParse) === "[false,true,false]", JSON.stringify(tzParse));
  const tzProbeA = await captureTask(A, { text: "tz probe 2030-03-15" });
  const tzProbeB = await captureTask(B, { text: "tz probe 2030-03-15" });
  const bDueBefore = await dueOf(tzProbeB.id);
  await setTimezone(A, { timezone: "Asia/Kolkata" });
  const localDue = await one(
    db.select({ d: sql<string>`to_char(${s.tasks.dueAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI')` }).from(s.tasks).where(eq(s.tasks.id, tzProbeA.id))
  );
  record("TZ2", "Changing time zone keeps open due days, only in the actor's workspace", localDue.d === "2030-03-15 23:59" && (await dueOf(tzProbeB.id)) === bDueBefore, localDue.d);
  [ok, detail] = await expectError(() => setTimezone({ ...X, personalWorkspaceId: aarav.ws.id }, { timezone: "UTC" }), "not_found");
  record("TZ3", "Time zone change for a workspace the actor cannot write is refused", ok, detail);
  await setTimezone(A, { timezone: "UTC" });

  const aaravExport = await buildExport(aaravId);
  const parthTaskIds = new Set((await db.select({ id: s.tasks.id }).from(s.tasks).where(eq(s.tasks.workspaceId, parth.ws.id))).map((t) => t.id));
  const parthCommitIds = new Set((await db.select({ id: s.commits.id }).from(s.commits).where(eq(s.commits.workspaceId, parth.ws.id))).map((c) => c.id));
  const leaked = [...aaravExport.tasks.filter((t) => parthTaskIds.has(t.id)), ...aaravExport.commits.filter((c) => parthCommitIds.has(c.id))];
  record("D1", "Export holds no other tenant's tasks and commits", leaked.length === 0, `${leaked.length} leaked`);

  const stripped = importSchema.parse({ tasks: [{ title: "x", workspaceId: parth.ws.id, creatorId: parthId }], commits: [{ message: "x", executionValue: 2, createdAt: "2026-01-01T00:00:00Z", userId: parthId, workspaceId: parth.ws.id, source: "task_completion" }] });
  record("D2", "Import rows drop workspaceId, userId, creatorId and source", !("workspaceId" in stripped.tasks[0]) && !("creatorId" in stripped.tasks[0]) && !("userId" in stripped.commits[0]) && !("source" in stripped.commits[0]));
  const badRows = [
    { commits: [{ message: "x", executionValue: 3, createdAt: "2026-01-01T00:00:00Z" }] },
    { commits: [{ message: "x", executionValue: 2, createdAt: "2999-01-01T00:00:00Z" }] },
    { tasks: [{ title: "" }] },
    { tasks: [{ title: "x", status: "archived" }] },
    { tasks: Array.from({ length: 10_001 }, () => ({ title: "x" })) },
  ].map((rows) => importSchema.safeParse(rows).success);
  record("D3", "Import rejects bad weights, future commits, blank titles, unknown statuses, oversized files", badRows.every((v) => !v), JSON.stringify(badRows));

  const parthBefore = await rowCount(parth.ws.id);
  const parthExport = await buildExport(parthId);
  const parsedExport = parseImport(JSON.stringify(parthExport));
  if (!parsedExport.ok) throw new Error(`export did not parse: ${parsedExport.error}`);
  const first = await importData(X, parsedExport.data);
  record("D4", "Import writes only into the importer's personal workspace", JSON.stringify(await rowCount(parth.ws.id)) === JSON.stringify(parthBefore) && first.tasks > 0, JSON.stringify(first));
  record("D5", "JSON export round-trips: imported execution equals the source", (await execution(outWs.id)) === (await execution(parth.ws.id)), `${await execution(outWs.id)} vs ${await execution(parth.ws.id)}`);
  const second = await importData(X, parsedExport.data);
  record("D6", "Re-importing the same file adds nothing", second.tasks + second.commits === 0 && second.skipped > 0, JSON.stringify(second));
  const forgedActor: Actor = { id: outsiderId, personalWorkspaceId: aarav.ws.id, readable: new Set(), writable: new Set() };
  [ok, detail] = await expectError(() => importData(forgedActor, parsedExport.data), "not_found");
  record("D7", "Import into a workspace the actor cannot write is refused", ok, detail);

  const csv = toCsv(["a", "b"] as const, [{ a: '=HYPERLINK("x")', b: "line\nbreak, \"quoted\"" }]);
  const back = parseCsv(csv)?.[0];
  record("D8", "CSV neutralises formulas and round-trips quotes and newlines", csv.includes(`"'=HYPERLINK(""x"")"`) && back?.a === '=HYPERLINK("x")' && back?.b === 'line\nbreak, "quoted"', JSON.stringify(back));


  await deleteAccount(outsiderId);
  const gone = await rowCount(outWs.id);
  const userGone = !(await one(db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, outsiderId))));
  record("D11", "Account deletion removes the user, workspace, tasks and commits", userGone && gone.tasks === 0 && gone.commits === 0, JSON.stringify(gone));

  // ------------------------------------------------------------ owner code and demo lifetime
  const savedCode = process.env.OWNER_CODE;
  delete process.env.OWNER_CODE;
  const unset = isOwnerCode("anything");
  process.env.OWNER_CODE = "correct horse";
  const codes = [isOwnerCode("correct horse"), isOwnerCode("correct hors"), isOwnerCode("Correct horse"), isOwnerCode("")];
  if (savedCode === undefined) delete process.env.OWNER_CODE;
  else process.env.OWNER_CODE = savedCode;
  record("SE1", "Owner code: refused when OWNER_CODE is unset; only the exact code matches", !unset && JSON.stringify(codes) === JSON.stringify([true, false, false, false]), JSON.stringify(codes));

  await endDemo(parthId);
  record("SE2", "Ending a demo never deletes a non-demo account", Boolean(await one(db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, parthId)))));

  const [oldDemo, freshDemo] = [`demo-old-${stamp}`, `demo-fresh-${stamp}`];
  await db.insert(s.users).values([
    { id: oldDemo, name: "Demo visitor", email: `${oldDemo}@example.test`, isDemo: true, createdAt: new Date(Date.now() - DEMO_TTL_MS - 60_000) },
    { id: freshDemo, name: "Demo visitor", email: `${freshDemo}@example.test`, isDemo: true },
  ]);
  await provisionAccount(oldDemo);
  await db.update(s.users).set({ createdAt: new Date(Date.now() - DEMO_TTL_MS - 60_000) }).where(eq(s.users.id, aaravId)); // old, but not a demo
  await pruneDemos();
  const left = (await db.select({ id: s.users.id }).from(s.users).where(inArray(s.users.id, [oldDemo, freshDemo, aaravId]))).map((u) => u.id).sort();
  const oldWorkspaces = await db.select({ id: s.workspaces.id }).from(s.workspaces).where(eq(s.workspaces.ownerId, oldDemo));
  record("SE3", "Expired demos are deleted with their workspace; fresh demos and the owner stay", JSON.stringify(left) === JSON.stringify([aaravId, freshDemo].sort()) && oldWorkspaces.length === 0, JSON.stringify(left));
  const [activeDemo] = [`demo-active-${stamp}`];
  await db.insert(s.users).values({ id: activeDemo, name: "Demo visitor", email: `${activeDemo}@example.test`, isDemo: true, createdAt: new Date(Date.now() - DEMO_TTL_MS - 60_000) });
  await db.insert(s.sessions).values({ id: `sess-${stamp}`, userId: activeDemo, token: `tok-${stamp}`, expiresAt: new Date(Date.now() + 3_600_000), updatedAt: new Date() });
  await pruneDemos();
  record("SE5", "An old demo still in use (recent session activity) is not pruned", Boolean(await one(db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, activeDemo)))));
  await endDemo(activeDemo);
  await endDemo(freshDemo);
  record("SE4", "Ending a demo deletes it", !(await one(db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, freshDemo)))));
  await db.delete(s.users).where(inArray(s.users.id, [parthId, aaravId]));

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
