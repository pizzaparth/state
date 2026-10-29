/**
 * Object-level authorization (BOLA / IDOR) regression suite for the product's read
 * queries and write mutations. Runs the real query and mutation code against a
 * disposable, seeded database with several tenants:
 *
 *   createdb state_security_test   # once
 *   DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run db:migrate
 *   DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npx tsx scripts/seed.ts
 *   DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run authz:check
 *
 * Refuses to run unless the database name ends in `_test`: it changes roles and data.
 * Exits non-zero if any check fails.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import * as s from "../db/schema";
import { getBoard, getCommitDetail, getCommits, getInbox, getProjects, getTaskDetail } from "../db/queries";
import { loadActor, MutationError, type Actor } from "../lib/authz";
import { captureTask, createManualCommit, deleteTask, moveTask, placeTask, renameTask, restoreTask, setTaskPriority, setTaskWeight } from "../lib/mutations";
import { captureTaskSchema, manualCommitSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "../lib/validation";

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

async function main() {
  const [parthId, aaravId, ishitaId] = ["demo-parth", "demo-aarav", "demo-ishita"];
  const parth = await personal(parthId);
  const aarav = await personal(aaravId);
  // The seed gives Aarav an empty personal space; add the objects other tenants will target
  aarav.project ??= (
    await db.insert(s.projects).values({ workspaceId: aarav.ws.id, name: "Private", slug: "private" }).returning()
  )[0];
  aarav.task ??= (
    await db
      .insert(s.tasks)
      .values({ workspaceId: aarav.ws.id, boardId: aarav.board.id, columnId: aarav.col("backlog").id, creatorId: aaravId, title: "Private task" })
      .returning()
  )[0];
  const org = await one(db.select().from(s.organisations).where(eq(s.organisations.slug, "ksan-relay")));
  const orgBoard = await one(db.select().from(s.boards).where(eq(s.boards.workspaceId, org.workspaceId)));
  const orgCols = await db.select().from(s.columns).where(eq(s.columns.boardId, orgBoard.id));
  const orgTask = await one(db.select().from(s.tasks).where(and(eq(s.tasks.boardId, orgBoard.id), isNull(s.tasks.completedAt))));
  const orgProject = await one(db.select().from(s.projects).where(eq(s.projects.workspaceId, org.workspaceId)));

  // An outsider tenant with no shared organisation
  const outsiderId = `authz-outsider-${Date.now()}`;
  await db.insert(s.users).values({ id: outsiderId, name: "Outsider", email: `${outsiderId}@example.test` });
  const [outWs] = await db.insert(s.workspaces).values({ name: "Outsider", slug: outsiderId, type: "personal", ownerId: outsiderId }).returning();

  const A: Actor = await loadActor(parthId);
  const B: Actor = await loadActor(aaravId);
  const X: Actor = await loadActor(outsiderId);
  const readable = (a: Actor) => [...a.readable];

  // ------------------------------------------------------------ reads (BOLA)
  record("R1", "Read another user's personal task by id", (await getTaskDetail(parth.task.id, readable(B))) === null);
  record("R2", "Read another user's commit by id", (await getCommitDetail(parth.commit.id, readable(B))) === null);
  record("R3", "Read another user's personal board by id", (await getBoard(parth.board.id, readable(B))) === null);
  record("R4", "Outsider reads organisation board by id", (await getBoard(orgBoard.id, readable(X))) === null);
  record("R5", "Outsider reads organisation task by id", (await getTaskDetail(orgTask.id, readable(X))) === null);
  const xProjects = await getProjects(readable(X));
  record("R6", "Project list leaks no foreign projects", xProjects.length === 0, `${xProjects.length} rows`);
  const xCommits = await getCommits({ workspaceIds: readable(X) });
  record("R7", "Commit ledger leaks no foreign commits", xCommits.length === 0, `${xCommits.length} rows`);
  record("R8", "Inbox of a foreign workspace id is empty for its query scope", (await getInbox(outWs.id)).length === 0);
  record("R9", "Member reads organisation task", (await getTaskDetail(orgTask.id, readable(B))) !== null);

  // ------------------------------------------------------------ writes (IDOR)
  let before = await snapshot(parth.task.id);
  let [ok, detail] = await expectError(() => moveTask(B, { taskId: parth.task.id, columnId: parth.col("done").id, afterTaskId: null }), "not_found");
  record("W1", "Move another user's task to Done", ok && JSON.stringify(await snapshot(parth.task.id)) === JSON.stringify(before), detail);

  before = await snapshot(orgTask.id);
  [ok, detail] = await expectError(() => moveTask(X, { taskId: orgTask.id, columnId: orgCols[0].id, afterTaskId: null }), "not_found");
  record("W2", "Outsider moves organisation task", ok && JSON.stringify(await snapshot(orgTask.id)) === JSON.stringify(before), detail);

  [ok, detail] = await expectError(() => moveTask(A, { taskId: parth.task.id, columnId: aarav.col("active").id, afterTaskId: null }), "not_found");
  record("W3", "Move own task into a column on someone else's board", ok, detail);

  [ok, detail] = await expectError(() => moveTask(A, { taskId: parth.task.id, columnId: orgCols[0].id, afterTaskId: null }), "not_found");
  record("W4", "Move personal task onto the organisation board (cross-workspace)", ok, detail);

  const foreignBefore = await snapshot(aarav.task.id);
  await moveTask(A, { taskId: parth.task.id, columnId: parth.col("backlog").id, afterTaskId: aarav.task.id });
  record("W5", "Foreign afterTaskId is ignored, foreign task untouched", JSON.stringify(await snapshot(aarav.task.id)) === JSON.stringify(foreignBefore));

  await db.update(s.organisationMembers).set({ role: "viewer" }).where(eq(s.organisationMembers.userId, ishitaId));
  const viewer = await loadActor(ishitaId);
  [ok, detail] = await expectError(() => moveTask(viewer, { taskId: orgTask.id, columnId: orgCols[1].id, afterTaskId: null }), "forbidden");
  record("W6", "Organisation viewer moves a task", ok, detail);
  [ok, detail] = await expectError(() => createManualCommit(viewer, { message: "x", projectId: orgProject.id, weight: 2 }), "forbidden");
  record("W7", "Organisation viewer records a commit in the organisation", ok, detail);
  [ok, detail] = await expectError(() => deleteTask(viewer, { taskId: orgTask.id }), "forbidden");
  record("W12", "Organisation viewer deletes a task", ok && (await snapshot(orgTask.id)).x === null, detail);
  [ok, detail] = await expectError(() => renameTask(viewer, { taskId: orgTask.id, title: "viewer edit" }), "forbidden");
  record("W21", "Organisation viewer renames a task", ok && (await titleOf(orgTask.id)) === orgTask.title, detail);
  [ok, detail] = await expectError(() => setTaskPriority(viewer, { taskId: orgTask.id, priority: "critical" }), "forbidden");
  record("W26", "Organisation viewer changes a task's priority", ok && (await priorityOf(orgTask.id)) === orgTask.priority, detail);
  [ok, detail] = await expectError(() => setTaskWeight(viewer, { taskId: orgTask.id, weight: 8 }), "forbidden");
  record("W30", "Organisation viewer changes a task's weight", ok && (await weightOf(orgTask.id)) === orgTask.weight, detail);
  await db.update(s.organisationMembers).set({ role: "member" }).where(eq(s.organisationMembers.userId, ishitaId));

  const commitsBefore = await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits));
  [ok, detail] = await expectError(() => createManualCommit(A, { message: "forged", projectId: aarav.project.id, weight: 8 }), "not_found");
  const commitsAfter = await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits));
  record("W8", "Manual commit into another user's project", ok && commitsBefore.n === commitsAfter.n, detail);

  const own = await createManualCommit(B, { message: "Reviewed PR", projectId: orgProject.id, weight: 2 });
  const ownRow = await one(db.select().from(s.commits).where(eq(s.commits.id, own.id)));
  record("W9", "Manual commit lands in the project's workspace, authored by the session user", ownRow.workspaceId === org.workspaceId && ownRow.userId === aaravId && ownRow.source === "manual");

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
  [ok, detail] = await expectError(() => placeTask(A, { taskId: inboxTask.id, columnId: orgCols[0].id }), "not_found");
  record("W15", "Place personal Inbox task onto the organisation board (cross-workspace)", ok && (await snapshot(inboxTask.id)).b === null, detail);
  [ok, detail] = await expectError(() => deleteTask(B, { taskId: parth.task.id }), "not_found");
  record("W16", "Delete another user's task", ok && (await snapshot(parth.task.id)).x === null, detail);
  [ok, detail] = await expectError(() => deleteTask(X, { taskId: orgTask.id }), "not_found");
  record("W17", "Outsider deletes organisation task", ok && (await snapshot(orgTask.id)).x === null, detail);
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
  [ok, detail] = await expectError(() => renameTask(X, { taskId: orgTask.id, title: "hijacked" }), "not_found");
  record("W24", "Outsider renames organisation task", ok && (await titleOf(orgTask.id)) === orgTask.title, detail);
  await renameTask(B, { taskId: orgTask.id, title: `${orgTask.title} (edited)` });
  record("W25", "Member renames organisation task", (await titleOf(orgTask.id)) === `${orgTask.title} (edited)`);
  await db.update(s.tasks).set({ title: orgTask.title }).where(eq(s.tasks.id, orgTask.id));
  [ok, detail] = await expectError(() => setTaskPriority(B, { taskId: parth.task.id, priority: "critical" }), "not_found");
  record("W27", "Change another user's task priority", ok && (await priorityOf(parth.task.id)) === parth.task.priority, detail);
  [ok, detail] = await expectError(() => setTaskPriority(X, { taskId: orgTask.id, priority: "critical" }), "not_found");
  record("W28", "Outsider changes organisation task priority", ok && (await priorityOf(orgTask.id)) === orgTask.priority, detail);
  await setTaskPriority(A, { taskId: inboxTask.id, priority: "high" });
  record("W29", "Owner changes own task priority", (await priorityOf(inboxTask.id)) === "high");
  [ok, detail] = await expectError(() => setTaskWeight(B, { taskId: parth.task.id, weight: 8 }), "not_found");
  record("W31", "Change another user's task weight", ok && (await weightOf(parth.task.id)) === parth.task.weight, detail);
  [ok, detail] = await expectError(() => setTaskWeight(X, { taskId: orgTask.id, weight: 8 }), "not_found");
  record("W32", "Outsider changes organisation task weight", ok && (await weightOf(orgTask.id)) === orgTask.weight, detail);
  await setTaskWeight(A, { taskId: inboxTask.id, weight: 4 });
  record("W33", "Owner changes own open task weight", (await weightOf(inboxTask.id)) === 4);

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
  record("M12", "Unknown fields (weight, workspaceId) rejected on priority", !setTaskPrioritySchema.safeParse({ taskId: "a", priority: "low", weight: 8, workspaceId: parth.ws.id }).success);
  const taskWeights = [0, 3, 16, "4", 2.5].map((weight) => setTaskWeightSchema.safeParse({ taskId: "a", weight }).success);
  record("M13", "Task weight outside 1/2/4/8 rejected", taskWeights.every((w) => !w), JSON.stringify(taskWeights));
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

  // Membership removal takes effect on the next request (actor is rebuilt per call)
  await db.delete(s.organisationMembers).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));
  [ok, detail] = await expectError(async () => moveTask(await loadActor(ishitaId), { taskId: orgTask.id, columnId: orgCols[1].id, afterTaskId: null }), "not_found");
  record("L10", "Removed member loses write access immediately", ok, detail);
  await db.insert(s.organisationMembers).values({ organisationId: org.id, userId: ishitaId, role: "member" });

  await db.delete(s.users).where(eq(s.users.id, outsiderId));

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
