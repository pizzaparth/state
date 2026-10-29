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
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import * as s from "../db/schema";
import { getBoard, getCommitDetail, getCommits, getInbox, getProjects, getTaskDetail, getTicker } from "../db/queries";
import { loadActor, MutationError, type Actor } from "../lib/authz";
import { editCommit, acceptInvitation, setTaskRecurrence, captureTask, createManualCommit, createOrganisation, createProject, hashInvitationToken, inviteMember, leaveOrganisation, removeMember, revokeInvitation, setMemberRole, setProjectArchived, updateProject, deleteTask, importData, moveTask, placeTask, renameTask, restoreTask, setTaskDue, setTaskPriority, setTaskWeight } from "../lib/mutations";
import { editCommitSchema, acceptInvitationSchema, setTaskRecurrenceSchema, captureTaskSchema, createOrganisationSchema, createProjectSchema, inviteMemberSchema, setMemberRoleSchema, deleteAccountSchema, importSchema, manualCommitSchema, setAutoRenewSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "../lib/validation";
import { buildExport } from "../lib/data/export";
import { parseImport } from "../lib/data/import";
import { parseCsv, toCsv } from "../lib/data/csv";
import { deleteAccount } from "../lib/accounts/delete";
import { nextDueDay } from "../lib/recurrence";
import { setAutoRenew } from "../lib/billing/manage";

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
  // Ticker: scoped by workspace and user, so another user's id inside a foreign scope sums nothing
  const xTicker = await getTicker({ workspaceIds: readable(X), userId: parthId }, "UTC");
  record("R10", "Top-bar ticker sums no foreign commits", xTicker.last7 + xTicker.prev7 + xTicker.today === 0, JSON.stringify(xTicker));

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
  [ok, detail] = await expectError(() => setTaskDue(viewer, { taskId: orgTask.id, dueDate: "2030-01-01" }), "forbidden");
  record("W50", "Organisation viewer sets a due date", ok && (await dueOf(orgTask.id)) === (orgTask.dueAt?.getTime() ?? null), detail);
  [ok, detail] = await expectError(() => createProject(viewer, { organisationId: org.id, name: "Viewer project", slug: "viewer-project", description: null }), "forbidden");
  const orgProjectBefore = JSON.stringify(await projectRow(orgProject.id));
  [ok, detail] = await expectError(() => updateProject(viewer, { projectId: orgProject.id, name: "x", slug: "viewer-edit", description: null, status: "paused" }), "forbidden");
  record("W41", "Organisation viewer edits a project", ok && JSON.stringify(await projectRow(orgProject.id)) === orgProjectBefore, detail);
  [ok, detail] = await expectError(() => setProjectArchived(viewer, { projectId: orgProject.id, archived: true }), "forbidden");
  record("W42", "Organisation viewer archives a project", ok && (await projectRow(orgProject.id)).archivedAt === null, detail);
  record("W34", "Organisation viewer creates a project in the organisation", ok && (await projectCount(org.workspaceId, "viewer-project")) === 0, detail);
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
  [ok, detail] = await expectError(() => setTaskDue(B, { taskId: parth.task.id, dueDate: "2030-01-01" }), "not_found");
  record("W51", "Set a due date on another user's task", ok && (await dueOf(parth.task.id)) === (parth.task.dueAt?.getTime() ?? null), detail);
  [ok, detail] = await expectError(() => setTaskDue(X, { taskId: orgTask.id, dueDate: null }), "not_found");
  record("W52", "Outsider clears an organisation task's due date", ok && (await dueOf(orgTask.id)) === (orgTask.dueAt?.getTime() ?? null), detail);
  // Due day is read in the actor's timezone and stored as 23:59 local
  await db.update(s.users).set({ timezone: "Asia/Kolkata" }).where(eq(s.users.id, parthId));
  await setTaskDue(A, { taskId: inboxTask.id, dueDate: "2030-03-15" });
  const dueIso = new Date((await dueOf(inboxTask.id))!).toISOString();
  await setTaskDue(A, { taskId: inboxTask.id, dueDate: null });
  record("W53", "Owner sets a due date (end of day, own timezone) and clears it", dueIso === "2030-03-15T18:29:00.000Z" && (await dueOf(inboxTask.id)) === null, dueIso);

  [ok, detail] = await expectError(() => createProject(X, { organisationId: org.id, name: "Probe", slug: "outsider-probe", description: null }), "not_found");
  record("W35", "Outsider creates a project in an organisation", ok && (await projectCount(org.workspaceId, "outsider-probe")) === 0, detail);
  [ok, detail] = await expectError(() => createProject(X, { organisationId: "no-such-org", name: "Probe", slug: "missing-org", description: null }), "not_found");
  const [, foreignDetail] = await expectError(() => createProject(X, { organisationId: org.id, name: "Probe", slug: "outsider-probe", description: null }), "not_found");
  record("W36", "Missing and foreign organisations give the same error", ok && detail === foreignDetail, detail);
  const mine = await createProject(A, { organisationId: null, name: "Authz probe", slug: "authz-probe", description: null });
  const mineRow = await one(db.select().from(s.projects).where(eq(s.projects.id, mine.id)));
  record("W37", "Personal project lands in the actor's own workspace", mineRow.workspaceId === parth.ws.id && mine.href === "/platform/projects/authz-probe");
  const theirs = await createProject(B, { organisationId: null, name: "Authz probe", slug: "authz-probe", description: null });
  record("W38", "Same slug in another user's workspace is independent", theirs.id !== mine.id && (await projectCount(aarav.ws.id, "authz-probe")) === 1);
  [ok, detail] = await expectError(() => createProject(A, { organisationId: null, name: "Again", slug: "authz-probe", description: null }), "conflict");
  record("W39", "Duplicate slug in the same workspace is refused", ok && (await projectCount(parth.ws.id, "authz-probe")) === 1, detail);
  // Project edit and archive
  const parthProjectBefore = JSON.stringify(await projectRow(parth.project.id));
  [ok, detail] = await expectError(() => updateProject(B, { projectId: parth.project.id, name: "Hijacked", slug: "hijacked", description: null, status: "paused" }), "not_found");
  record("W43", "Edit another user's project", ok && JSON.stringify(await projectRow(parth.project.id)) === parthProjectBefore, detail);
  [ok, detail] = await expectError(() => updateProject(X, { projectId: orgProject.id, name: "Hijacked", slug: "hijacked", description: null, status: "paused" }), "not_found");
  record("W44", "Outsider edits organisation project", ok && (await projectRow(orgProject.id)).slug === orgProject.slug, detail);
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
  const listed = (await getProjects([parth.ws.id])).some((p) => p.id === mine.id);
  record("W48", "Archived project leaves lists, #capture and commits", ok && archivedCapture.projectName === null && !listed && (await projectRow(mine.id)).archivedAt !== null, detail);
  await setProjectArchived(A, { projectId: mine.id, archived: false });
  record("W49", "Unarchive restores the project", (await projectRow(mine.id)).archivedAt === null && (await getProjects([parth.ws.id])).some((p) => p.id === mine.id));
  await db.update(s.tasks).set({ deletedAt: new Date() }).where(inArray(s.tasks.id, [recaptured.id, archivedCapture.id]));

  const orgMade = await createProject(B, { organisationId: org.id, name: "Member project", slug: "member-project", description: "From a member" });
  record("W40", "Member creates an organisation project", (await projectCount(org.workspaceId, "member-project")) === 1 && orgMade.href === `/platform/org/${org.slug}/projects/member-project`);

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
  record("M14", "Unknown fields (workspaceId, status) rejected on project create", !createProjectSchema.safeParse({ organisationId: null, name: "x", slug: "x", description: null, workspaceId: aarav.ws.id, status: "archived" }).success);
  const slugs = ["Relay DB", "-x", "x-", "a--b", "a_b", "", "x".repeat(101)].map((slug) => createProjectSchema.safeParse({ organisationId: null, name: "x", slug, description: null }).success);
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
  const descriptions = ["x".repeat(128), "x".repeat(129)].map((description) => createProjectSchema.safeParse({ organisationId: null, name: "x", slug: "x", description }).success);
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

  // Membership removal takes effect on the next request (actor is rebuilt per call)
  await db.delete(s.organisationMembers).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));
  [ok, detail] = await expectError(async () => moveTask(await loadActor(ishitaId), { taskId: orgTask.id, columnId: orgCols[1].id, afterTaskId: null }), "not_found");
  record("L10", "Removed member loses write access immediately", ok, detail);
  await db.insert(s.organisationMembers).values({ organisationId: org.id, userId: ishitaId, role: "member" });

  await db.delete(s.projects).where(inArray(s.projects.id, [mine.id, theirs.id, orgMade.id]));

  // ------------------------------------------------------------ organisations
  const orgsOwnedBy = async (userId: string) =>
    (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.workspaces).where(and(eq(s.workspaces.ownerId, userId), eq(s.workspaces.type, "organisation"))))).n;

  const outsiderOrgsBefore = await orgsOwnedBy(outsiderId);
  [ok, detail] = await expectError(() => createOrganisation(X, { name: "Outsider Co", slug: "outsider-co" }), "forbidden");
  record("O1", "Creating an organisation without the Organisation plan is refused", ok && (await orgsOwnedBy(outsiderId)) === outsiderOrgsBefore, detail);

  const slug = `authz-org-${Date.now()}`;
  const made = await createOrganisation(A, { name: "Authz Org", slug });
  const madeOrg = await one(db.select().from(s.organisations).where(eq(s.organisations.slug, slug)));
  const madeWs = await one(db.select().from(s.workspaces).where(eq(s.workspaces.id, madeOrg.workspaceId)));
  const madeMembers = await db.select().from(s.organisationMembers).where(eq(s.organisationMembers.organisationId, madeOrg.id));
  const madeBoard = await one(db.select().from(s.boards).where(eq(s.boards.workspaceId, madeWs.id)));
  const madeCols = await db.select().from(s.columns).where(eq(s.columns.boardId, madeBoard.id));
  const A2 = await loadActor(parthId);
  record(
    "O2",
    "New organisation: creator is its only member and owner, with a board and Done column",
    made.href === `/platform/org/${slug}` && madeWs.type === "organisation" && madeWs.ownerId === parthId && madeMembers.length === 1 && madeMembers[0].userId === parthId && madeMembers[0].role === "owner" && madeCols.some((c) => c.stateType === "done") && A2.writable.has(madeWs.id),
    `${madeMembers.length} members, ${madeCols.length} columns`
  );

  const parthOrgsBefore = await orgsOwnedBy(parthId);
  [ok, detail] = await expectError(() => createOrganisation(A, { name: "Clash", slug: org.slug }), "conflict");
  record("O3", "A taken address is refused and leaves no orphan workspace", ok && (await orgsOwnedBy(parthId)) === parthOrgsBefore, detail);

  const badOrgInputs = [
    { name: "x", slug: "fine", ownerId: aaravId },
    { name: "x", slug: "fine", workspaceId: org.workspaceId },
    { name: "x", slug: "Bad Slug" },
    { name: "x", slug: "a" },
    { name: "x", slug: "../admin" },
    { name: "", slug: "fine" },
  ].map((v) => createOrganisationSchema.safeParse(v).success);
  record("O4", "Organisation input rejects extra keys, bad addresses and blank names", badOrgInputs.every((v) => !v), JSON.stringify(badOrgInputs));

  [ok, detail] = await expectError(() => createProject(B, { organisationId: madeOrg.id, name: "Intruder", slug: "intruder", description: null }), "not_found");
  record("O5", "Another user cannot read or write the new organisation", ok && (await getBoard(madeBoard.id, readable(B))) === null, detail);

  // Cap on owned organisations
  const filler = await db
    .insert(s.workspaces)
    .values(Array.from({ length: 20 }, (_, i) => ({ name: "Filler", slug: `authz-filler-${Date.now()}-${i}`, type: "organisation", ownerId: aaravId })))
    .returning({ id: s.workspaces.id });
  [ok, detail] = await expectError(() => createOrganisation(B, { name: "One too many", slug: `authz-cap-${Date.now()}` }), "invalid");
  record("O6", "Owning more than 20 organisations is refused", ok, detail);
  await db.delete(s.workspaces).where(inArray(s.workspaces.id, [...filler.map((f) => f.id), madeWs.id]));

  // ------------------------------------------------------------ invitations and members
  // Invitation emails land here so the suite can read the link like the invitee would
  const outbox = mkdtempSync(path.join(tmpdir(), "state-authz-outbox-"));
  process.env.EMAIL_OUTBOX_DIR = outbox;
  const lastLinkTo = (email: string) => {
    const mails = readdirSync(outbox)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(path.join(outbox, f), "utf8")) as { to: string; text: string });
    return mails.filter((m) => m.to === email).at(-1)?.text.match(/\/invite\/([A-Za-z0-9_-]{43})/)?.[1] ?? null;
  };
  const pendingFor = (email: string) =>
    db.select().from(s.organisationInvitations).where(and(eq(s.organisationInvitations.organisationId, org.id), eq(s.organisationInvitations.email, email), eq(s.organisationInvitations.status, "pending")));
  const roleIn = async (userId: string) =>
    (await one(db.select({ r: s.organisationMembers.role }).from(s.organisationMembers).where(and(eq(s.organisationMembers.organisationId, org.id), eq(s.organisationMembers.userId, userId)))))?.r ?? null;

  const stamp = Date.now();
  const inviteeId = `authz-invitee-${stamp}`;
  const inviteeEmail = `${inviteeId}@example.test`;
  const strangerId = `authz-stranger-${stamp}`;
  await db.insert(s.users).values([
    { id: inviteeId, name: "Invitee", email: inviteeEmail, emailVerified: true },
    { id: strangerId, name: "Stranger", email: `${strangerId}@example.test`, emailVerified: true },
  ]);
  const invitee = { id: inviteeId, email: inviteeEmail, emailVerified: true };
  const stranger = { id: strangerId, email: `${strangerId}@example.test`, emailVerified: true };
  const M = await loadActor(ishitaId); // member of the organisation

  [ok, detail] = await expectError(() => inviteMember(X, { organisationId: org.id, email: inviteeEmail, role: "member" }), "not_found");
  record("I1", "Outsider invites to an organisation", ok && (await pendingFor(inviteeEmail)).length === 0, detail);
  [ok, detail] = await expectError(() => inviteMember(M, { organisationId: org.id, email: inviteeEmail, role: "member" }), "forbidden");
  record("I2", "Member (not owner or admin) invites", ok && (await pendingFor(inviteeEmail)).length === 0, detail);
  [ok, detail] = await expectError(() => inviteMember(B, { organisationId: org.id, email: inviteeEmail, role: "admin" }), "forbidden");
  record("I3", "Admin invites an admin (owner only)", ok && (await pendingFor(inviteeEmail)).length === 0, detail);

  await inviteMember(B, { organisationId: org.id, email: inviteeEmail, role: "member" });
  const firstToken = lastLinkTo(inviteeEmail);
  const [stored] = await pendingFor(inviteeEmail);
  record("I4", "Invitation stores only a hash of the emailed token", Boolean(firstToken) && stored?.token === hashInvitationToken(firstToken!) && /^[0-9a-f]{64}$/.test(stored.token) && stored.invitedById === aaravId);

  await inviteMember(A, { organisationId: org.id, email: inviteeEmail.toUpperCase(), role: "viewer" });
  const secondToken = lastLinkTo(inviteeEmail);
  [ok, detail] = await expectError(() => acceptInvitation(invitee, { token: firstToken! }), "not_found");
  const pendingAnyCase = await db.select({ id: s.organisationInvitations.id }).from(s.organisationInvitations).where(and(eq(s.organisationInvitations.organisationId, org.id), sql`lower(${s.organisationInvitations.email}) = ${inviteeEmail}`, eq(s.organisationInvitations.status, "pending")));
  record("I5", "Inviting again (any letter case) keeps one pending row and retires the old link", ok && pendingAnyCase.length === 1 && Boolean(secondToken) && secondToken !== firstToken, detail);

  [ok, detail] = await expectError(() => acceptInvitation(stranger, { token: secondToken! }), "forbidden");
  record("I6", "Accepting with a different account's email is refused", ok && (await roleIn(strangerId)) === null && (await pendingFor(inviteeEmail)).length === 1, detail);
  [ok, detail] = await expectError(() => acceptInvitation({ ...invitee, emailVerified: false }, { token: secondToken! }), "forbidden");
  record("I7", "Accepting with an unverified email is refused", ok && (await roleIn(inviteeId)) === null, detail);

  const joined = await acceptInvitation(invitee, { token: secondToken! });
  const inviteeActor = await loadActor(inviteeId);
  record("I8", "Invitee joins with the invited role", joined.slug === org.slug && (await roleIn(inviteeId)) === "viewer" && inviteeActor.readable.has(org.workspaceId) && !inviteeActor.writable.has(org.workspaceId));
  [ok, detail] = await expectError(() => acceptInvitation(invitee, { token: secondToken! }), "not_found");
  record("I9", "Replaying an accepted link does nothing", ok, detail);

  const expiredToken = "e".repeat(43);
  await db.insert(s.organisationInvitations).values({ organisationId: org.id, email: stranger.email, role: "admin", invitedById: parthId, token: hashInvitationToken(expiredToken), expiresAt: new Date(Date.now() - 1000) });
  [ok, detail] = await expectError(() => acceptInvitation(stranger, { token: expiredToken }), "not_found");
  record("I10", "Expired link is refused", ok && (await roleIn(strangerId)) === null, detail);
  await db.delete(s.organisationInvitations).where(eq(s.organisationInvitations.email, stranger.email));

  await inviteMember(A, { organisationId: org.id, email: stranger.email, role: "member" });
  const strangerToken = lastLinkTo(stranger.email);
  const [strangerInvite] = await pendingFor(stranger.email);
  const [revokeOutsider] = await expectError(() => revokeInvitation(X, { invitationId: strangerInvite.id }), "not_found");
  const [revokeMember] = await expectError(() => revokeInvitation(M, { invitationId: strangerInvite.id }), "forbidden");
  await revokeInvitation(B, { invitationId: strangerInvite.id });
  [ok, detail] = await expectError(() => acceptInvitation(stranger, { token: strangerToken! }), "not_found");
  record("I11", "Only owners and admins revoke; a revoked link is refused", revokeOutsider && revokeMember && ok && (await roleIn(strangerId)) === null, detail);

  [ok, detail] = await expectError(() => inviteMember(A, { organisationId: org.id, email: inviteeEmail, role: "member" }), "conflict");
  record("I12", "Inviting an existing member is refused", ok, detail);

  const badInvites = [
    inviteMemberSchema.safeParse({ organisationId: org.id, email: "a@b.co", role: "owner" }).success,
    inviteMemberSchema.safeParse({ organisationId: org.id, email: "a@b.co", role: "member", invitedById: aaravId }).success,
    inviteMemberSchema.safeParse({ organisationId: org.id, email: "not-an-email", role: "member" }).success,
    acceptInvitationSchema.safeParse({ token: secondToken, userId: strangerId }).success,
    acceptInvitationSchema.safeParse({ token: "' or 1=1 --" }).success,
    setMemberRoleSchema.safeParse({ organisationId: org.id, userId: aaravId, role: "owner" }).success,
  ];
  record("I13", "Member inputs reject the owner role, extra keys, bad emails and malformed tokens", badInvites.every((v) => !v), JSON.stringify(badInvites));

  // Roles: the owner is untouchable, nobody changes themselves, only the owner touches admins
  [ok, detail] = await expectError(() => setMemberRole(X, { organisationId: org.id, userId: inviteeId, role: "member" }), "not_found");
  record("MR1", "Outsider changes a member's role", ok && (await roleIn(inviteeId)) === "viewer", detail);
  [ok, detail] = await expectError(() => setMemberRole(M, { organisationId: org.id, userId: inviteeId, role: "member" }), "forbidden");
  record("MR2", "Member changes another member's role", ok && (await roleIn(inviteeId)) === "viewer", detail);
  [ok, detail] = await expectError(() => setMemberRole(B, { organisationId: org.id, userId: parthId, role: "viewer" }), "forbidden");
  record("MR3", "Admin demotes the owner", ok && (await roleIn(parthId)) === "owner", detail);
  [ok, detail] = await expectError(() => setMemberRole(B, { organisationId: org.id, userId: inviteeId, role: "admin" }), "forbidden");
  record("MR4", "Admin promotes someone to admin", ok && (await roleIn(inviteeId)) === "viewer", detail);
  [ok, detail] = await expectError(() => setMemberRole(B, { organisationId: org.id, userId: aaravId, role: "member" }), "invalid");
  record("MR5", "Changing your own role is refused", ok && (await roleIn(aaravId)) === "admin", detail);
  await setMemberRole(B, { organisationId: org.id, userId: inviteeId, role: "member" });
  const promoted = await loadActor(inviteeId);
  record("MR6", "Admin changes viewer to member; write access follows at once", (await roleIn(inviteeId)) === "member" && promoted.writable.has(org.workspaceId));

  // Removal and leaving
  const [assigned] = await db
    .insert(s.tasks)
    .values({ workspaceId: org.workspaceId, boardId: orgBoard.id, columnId: orgCols[0].id, creatorId: inviteeId, assigneeId: inviteeId, title: "Invitee's open task" })
    .returning();
  const [inviteeCommit] = await db.insert(s.commits).values({ workspaceId: org.workspaceId, userId: inviteeId, message: "Invitee's commit", executionValue: 2 }).returning();
  [ok, detail] = await expectError(() => removeMember(B, { organisationId: org.id, userId: parthId }), "forbidden");
  const [removeByMember] = await expectError(() => removeMember(M, { organisationId: org.id, userId: inviteeId }), "forbidden");
  const [removeByOutsider] = await expectError(() => removeMember(X, { organisationId: org.id, userId: inviteeId }), "not_found");
  record("MR7", "Admin cannot remove the owner; members and outsiders cannot remove anyone", ok && removeByMember && removeByOutsider && (await roleIn(parthId)) === "owner" && (await roleIn(inviteeId)) === "member", detail);
  await removeMember(B, { organisationId: org.id, userId: inviteeId });
  const afterRemoval = await one(db.select({ a: s.tasks.assigneeId }).from(s.tasks).where(eq(s.tasks.id, assigned.id)));
  const commitKept = await one(db.select({ id: s.commits.id }).from(s.commits).where(eq(s.commits.id, inviteeCommit.id)));
  [ok, detail] = await expectError(async () => moveTask(await loadActor(inviteeId), { taskId: orgTask.id, columnId: orgCols[1].id, afterTaskId: null }), "not_found");
  record("MR8", "Removed member loses access; their open tasks are unassigned and commits kept", ok && (await roleIn(inviteeId)) === null && afterRemoval.a === null && Boolean(commitKept), detail);
  await db.delete(s.tasks).where(eq(s.tasks.id, assigned.id));
  await db.delete(s.commits).where(eq(s.commits.id, inviteeCommit.id));

  [ok, detail] = await expectError(() => leaveOrganisation(A, { organisationId: org.id }), "invalid");
  record("MR9", "Owner cannot leave their own organisation", ok && (await roleIn(parthId)) === "owner", detail);
  await leaveOrganisation(M, { organisationId: org.id });
  [ok, detail] = await expectError(() => leaveOrganisation(X, { organisationId: org.id }), "not_found");
  record("MR10", "Member leaves; an outsider cannot 'leave' an organisation they are not in", ok && (await roleIn(ishitaId)) === null, detail);
  await db.insert(s.organisationMembers).values({ organisationId: org.id, userId: ishitaId, role: "member" });
  await db.delete(s.users).where(inArray(s.users.id, [inviteeId, strangerId]));

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
  await db.update(s.organisationMembers).set({ role: "viewer" }).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));
  [ok, detail] = await expectError(async () => setTaskRecurrence(await loadActor(ishitaId), { taskId: orgTask.id, rule: "daily" }), "forbidden");
  record("RC2", "Organisation viewer sets a repeat", ok && (await ruleOf(orgTask.id)) === null, detail);
  await db.update(s.organisationMembers).set({ role: "member" }).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));
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
  const ishitaCommit = await one(db.select().from(s.commits).where(and(eq(s.commits.workspaceId, org.workspaceId), eq(s.commits.userId, ishitaId), isNull(s.commits.deletedAt))));
  const parthOrgCommit = await one(db.select().from(s.commits).where(and(eq(s.commits.workspaceId, org.workspaceId), eq(s.commits.userId, parthId), isNull(s.commits.deletedAt))));
  const edit = (commitId: string, extra: Partial<{ message: string; projectId: string | null; tags: string[] }> = {}) => ({ commitId, message: "Corrected", projectId: null, tags: [], ...extra });

  [ok, detail] = await expectError(() => editCommit(B, edit(myCommit.id)), "not_found");
  record("CE1", "Another user edits someone's personal commit", ok && (await commitRow(myCommit.id)).message === myCommit.message, detail);
  [ok, detail] = await expectError(() => editCommit(X, edit(ishitaCommit.id)), "not_found");
  record("CE2", "Outsider edits an organisation commit", ok && (await commitRow(ishitaCommit.id)).message === ishitaCommit.message, detail);
  const [ishitaMember] = [await loadActor(ishitaId)];
  [ok, detail] = await expectError(() => editCommit(ishitaMember, edit(parthOrgCommit.id)), "forbidden");
  record("CE3", "Member edits another member's commit", ok && (await commitRow(parthOrgCommit.id)).message === parthOrgCommit.message, detail);
  await db.update(s.organisationMembers).set({ role: "viewer" }).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));
  [ok, detail] = await expectError(async () => editCommit(await loadActor(ishitaId), edit(ishitaCommit.id)), "forbidden");
  record("CE4", "Viewer edits even their own commit", ok && (await commitRow(ishitaCommit.id)).message === ishitaCommit.message, detail);
  await db.update(s.organisationMembers).set({ role: "member" }).where(and(eq(s.organisationMembers.userId, ishitaId), eq(s.organisationMembers.organisationId, org.id)));

  [ok, detail] = await expectError(() => editCommit(A, edit(myCommit.id, { projectId: aarav.project.id })), "not_found");
  const [crossOk, crossDetail] = await expectError(() => editCommit(A, edit(parthOrgCommit.id, { projectId: parth.project.id })), "not_found");
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
  await editCommit(A, edit(ishitaCommit.id, { message: "Owner fixed typo" }));
  const ownerEdited = await commitRow(ishitaCommit.id);
  record("CE8", "Organisation owner corrects a member's commit; author and value stay", ownerEdited.message === "Owner fixed typo" && frozen(ownerEdited) === frozen(ishitaCommit));

  await db.update(s.commits).set({ deletedAt: new Date() }).where(eq(s.commits.id, parthOrgCommit.id));
  [ok, detail] = await expectError(() => editCommit(A, edit(parthOrgCommit.id)), "not_found");
  record("CE9", "A retired commit cannot be edited", ok, detail);
  await db.update(s.commits).set({ deletedAt: null }).where(eq(s.commits.id, parthOrgCommit.id));

  // ------------------------------------------------------------ export, import, account deletion, billing
  const execution = async (workspaceId: string) =>
    (await one(db.select({ n: sql<number>`coalesce(sum(${s.commits.executionValue}), 0)::int` }).from(s.commits).where(and(eq(s.commits.workspaceId, workspaceId), isNull(s.commits.deletedAt))))).n;
  const rowCount = async (workspaceId: string) => ({
    tasks: (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.tasks).where(eq(s.tasks.workspaceId, workspaceId)))).n,
    commits: (await one(db.select({ n: sql<number>`count(*)::int` }).from(s.commits).where(eq(s.commits.workspaceId, workspaceId)))).n,
  });

  const aaravExport = await buildExport(aaravId);
  const parthTaskIds = new Set((await db.select({ id: s.tasks.id }).from(s.tasks).where(eq(s.tasks.workspaceId, parth.ws.id))).map((t) => t.id));
  const parthCommitIds = new Set((await db.select({ id: s.commits.id }).from(s.commits).where(eq(s.commits.workspaceId, parth.ws.id))).map((c) => c.id));
  const orgTaskIds = new Set((await db.select({ id: s.tasks.id }).from(s.tasks).where(eq(s.tasks.workspaceId, org.workspaceId))).map((t) => t.id));
  const leaked = [...aaravExport.tasks.filter((t) => parthTaskIds.has(t.id) || orgTaskIds.has(t.id)), ...aaravExport.commits.filter((c) => parthCommitIds.has(c.id))];
  record("D1", "Export holds no other tenant's or organisation's tasks and commits", leaked.length === 0 && aaravExport.organisations.every((o) => o.slug === org.slug), `${leaked.length} leaked`);

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

  record("D9", "Unknown fields rejected on account deletion and auto-renew", !deleteAccountSchema.safeParse({ confirm: "x", userId: aaravId }).success && !setAutoRenewSchema.safeParse({ renew: "false" }).success);
  [ok, detail] = await expectError(() => setAutoRenew(outsiderId, false), "not_found");
  record("B1", "Auto-renew change without a subscription is refused", ok, detail);

  [ok, detail] = await expectError(() => deleteAccount(parthId), "conflict");
  record("D10", "Owner of an organisation with other members cannot delete their account", ok && Boolean(await one(db.select({ id: s.organisations.id }).from(s.organisations).where(eq(s.organisations.id, org.id)))), detail);
  await deleteAccount(outsiderId);
  const gone = await rowCount(outWs.id);
  const userGone = !(await one(db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, outsiderId))));
  record("D11", "Account deletion removes the user, workspace, tasks and commits", userGone && gone.tasks === 0 && gone.commits === 0, JSON.stringify(gone));

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
