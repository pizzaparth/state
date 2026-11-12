import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import {
  boards,
  columns,
  commitTags,
  commits,
  notifications,
  objectiveProjects,
  objectives,
  projects,
  tags,
  taskTags,
  tasks,
  users,
  workspaces,
} from "../schema";

/**
 * Read-only queries for the product UI. Every function takes the workspace ids the
 * caller may read (from getViewer) and never returns rows outside them.
 */

export interface Scope {
  workspaceIds: string[];
  /** Restrict to one person's work: commits they made, tasks assigned to them. */
  userId?: string;
  projectId?: string;
}

const PRIORITY_RANK = sql`case ${tasks.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`;

/** Start of the viewer's local day `daysBack` days ago, as a timestamptz expression. */
const localDayStart = (tz: string, daysBack: number) =>
  sql`(date_trunc('day', now() at time zone ${tz}) - make_interval(days => ${daysBack})) at time zone ${tz}`;

function commitWhere(scope: Scope): SQL[] {
  const where: SQL[] = [inArray(commits.workspaceId, scope.workspaceIds), isNull(commits.deletedAt)];
  if (scope.userId) where.push(eq(commits.userId, scope.userId));
  if (scope.projectId) where.push(eq(commits.projectId, scope.projectId));
  return where;
}

function taskWhere(scope: Scope): SQL[] {
  const where: SQL[] = [inArray(tasks.workspaceId, scope.workspaceIds), isNull(tasks.deletedAt)];
  if (scope.userId) where.push(eq(tasks.assigneeId, scope.userId));
  if (scope.projectId) where.push(eq(tasks.projectId, scope.projectId));
  return where;
}

const empty = (scope: Scope) => scope.workspaceIds.length === 0;

// ------------------------------------------------------------------ execution
export interface DailyExecution {
  day: string; // YYYY-MM-DD in the viewer's timezone
  commits: number;
  execution: number;
  tasks: number;
  projects: number;
}

/** One entry per local day, oldest first, including zero days. */
export async function getDailyExecution(scope: Scope, tz: string, days: number): Promise<DailyExecution[]> {
  const rows = empty(scope)
    ? []
    : await db
        .select({
          day: sql<string>`to_char(${commits.createdAt} at time zone ${tz}, 'YYYY-MM-DD')`,
          commits: sql<number>`count(*)::int`,
          execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int`,
          tasks: sql<number>`count(${commits.taskId})::int`,
          projects: sql<number>`count(distinct ${commits.projectId})::int`,
        })
        .from(commits)
        .where(and(...commitWhere(scope), gte(commits.createdAt, localDayStart(tz, days - 1))))
        .groupBy(sql`1`);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  // en-CA formats as YYYY-MM-DD
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const out: DailyExecution[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { day: key, commits: 0, execution: 0, tasks: 0, projects: 0 });
  }
  return out;
}

/**
 * Eligible days for Consistency: the last `days` local days, but none before the scope
 * existed (the earlier of its workspace's creation and its first commit). Today counts.
 * A new account therefore starts at 1 eligible day, not the whole period.
 */
export async function getEligibleDays(scope: Scope, tz: string, days: number): Promise<number> {
  if (empty(scope)) return days;
  const firstCommit = db
    .select({ at: sql`min(${commits.createdAt})` })
    .from(commits)
    .where(and(...commitWhere(scope)));
  const created = db.select({ at: sql`min(${workspaces.createdAt})` }).from(workspaces).where(inArray(workspaces.id, scope.workspaceIds));
  const [row] = await db.execute<{ n: number | null }>(
    sql`select ((now() at time zone ${tz})::date - (least((${created}), (${firstCommit})) at time zone ${tz})::date + 1)::int as n`
  ).then((r) => ("rows" in r ? (r.rows as { n: number | null }[]) : (r as unknown as { n: number | null }[])));
  const n = row?.n;
  return n === null || n === undefined ? days : Math.max(1, Math.min(days, n));
}

// ------------------------------------------------------------------ commits
export interface CommitRow {
  id: string;
  message: string;
  executionValue: number;
  source: string;
  createdAt: Date;
  workspaceId: string;
  taskId: string | null;
  projectName: string | null;
  projectSlug: string | null;
  authorId: string;
  authorName: string;
  tags: string[];
}

/** Start of a local calendar day (YYYY-MM-DD) in `tz`, as a timestamptz expression. */
const dayStartAt = (tz: string, day: string) => sql`((${day})::date)::timestamp at time zone ${tz}`;

export interface CommitFilters {
  limit?: number;
  sinceDays?: number;
  tz?: string;
  /** First and last local day, inclusive (needs tz). */
  from?: string;
  to?: string;
  source?: "task_completion" | "manual" | "imported";
  tag?: string;
  weight?: number;
  /** Message contains (case-insensitive). */
  q?: string;
  /** Only commits after this one in newest-first order (cursor pagination). */
  before?: { at: Date; id: string };
}

const commitFilterWhere = (scope: Scope, opts: CommitFilters): SQL[] => {
  const where = commitWhere(scope);
  if (opts.sinceDays !== undefined && opts.tz) where.push(gte(commits.createdAt, localDayStart(opts.tz, opts.sinceDays - 1)));
  if (opts.from && opts.tz) where.push(gte(commits.createdAt, dayStartAt(opts.tz, opts.from)));
  if (opts.to && opts.tz) where.push(lt(commits.createdAt, sql`${dayStartAt(opts.tz, opts.to)} + interval '1 day'`));
  if (opts.source) where.push(eq(commits.source, opts.source));
  if (opts.weight) where.push(eq(commits.executionValue, opts.weight));
  if (opts.q) where.push(sql`${commits.message} ilike ${likePattern(opts.q)}`);
  if (opts.before) where.push(sql`(${commits.createdAt}, ${commits.id}) < (${opts.before.at.toISOString()}::timestamptz, ${opts.before.id})`);
  if (opts.tag)
    where.push(sql`exists (select 1 from ${commitTags} join ${tags} on ${tags.id} = ${commitTags.tagId} where ${commitTags.commitId} = ${commits.id} and ${tags.name} = ${opts.tag})`);
  return where;
};

export async function getCommits(scope: Scope, opts: CommitFilters = {}): Promise<CommitRow[]> {
  if (empty(scope)) return [];
  const rows = await db
    .select({
      id: commits.id,
      message: commits.message,
      executionValue: commits.executionValue,
      source: commits.source,
      createdAt: commits.createdAt,
      workspaceId: commits.workspaceId,
      taskId: commits.taskId,
      projectName: projects.name,
      projectSlug: projects.slug,
      authorId: commits.userId,
      authorName: users.name,
    })
    .from(commits)
    .leftJoin(projects, eq(projects.id, commits.projectId))
    .innerJoin(users, eq(users.id, commits.userId))
    .where(and(...commitFilterWhere(scope, opts)))
    .orderBy(desc(commits.createdAt), desc(commits.id))
    .limit(opts.limit ?? 200);
  return withCommitTags(rows);
}

/** Count and Σ execution of every commit matching the filters (History's header line). */
export async function getCommitTotals(scope: Scope, opts: CommitFilters = {}): Promise<{ count: number; execution: number }> {
  if (empty(scope)) return { count: 0, execution: 0 };
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`, execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int` })
    .from(commits)
    .where(and(...commitFilterWhere(scope, { ...opts, before: undefined })));
  return row ?? { count: 0, execution: 0 };
}

async function withCommitTags<T extends { id: string }>(rows: T[]): Promise<(T & { tags: string[] })[]> {
  if (rows.length === 0) return [];
  const tagRows = await db
    .select({ commitId: commitTags.commitId, name: tags.name })
    .from(commitTags)
    .innerJoin(tags, eq(tags.id, commitTags.tagId))
    .where(inArray(commitTags.commitId, rows.map((r) => r.id)))
    .limit(rows.length * 10);
  const by = new Map<string, string[]>();
  for (const t of tagRows) by.set(t.commitId, [...(by.get(t.commitId) ?? []), t.name]);
  return rows.map((r) => ({ ...r, tags: by.get(r.id) ?? [] }));
}

/** Tasks created and completed between two local days, inclusive (week review). */
export async function getTaskFlow(scope: Scope, tz: string, from: string, to: string): Promise<{ created: number; completed: number }> {
  if (empty(scope)) return { created: 0, completed: 0 };
  const start = dayStartAt(tz, from);
  const end = sql`${dayStartAt(tz, to)} + interval '1 day'`;
  const [row] = await db
    .select({
      created: sql<number>`count(*) filter (where ${tasks.createdAt} >= ${start} and ${tasks.createdAt} < ${end})::int`,
      completed: sql<number>`count(*) filter (where ${tasks.completedAt} >= ${start} and ${tasks.completedAt} < ${end})::int`,
    })
    .from(tasks)
    .where(and(...taskWhere(scope), sql`(${tasks.createdAt} >= ${start} or ${tasks.completedAt} >= ${start})`));
  return row ?? { created: 0, completed: 0 };
}

export async function getCommitDetail(commitId: string, workspaceIds: string[]) {
  if (workspaceIds.length === 0) return null;
  const [row] = await db
    .select({
      id: commits.id,
      workspaceId: commits.workspaceId,
      userId: commits.userId,
      message: commits.message,
      executionValue: commits.executionValue,
      source: commits.source,
      createdAt: commits.createdAt,
      authorName: users.name,
      projectId: commits.projectId,
      projectName: projects.name,
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskCreatedAt: tasks.createdAt,
      taskStartedAt: tasks.startedAt,
      taskCompletedAt: tasks.completedAt,
      taskDescription: tasks.description,
    })
    .from(commits)
    .innerJoin(users, eq(users.id, commits.userId))
    .leftJoin(projects, eq(projects.id, commits.projectId))
    .leftJoin(tasks, eq(tasks.id, commits.taskId))
    .where(and(eq(commits.id, commitId), inArray(commits.workspaceId, workspaceIds), isNull(commits.deletedAt)))
    .limit(1);
  if (!row) return null;
  const tagRows = await db
    .select({ name: tags.name })
    .from(commitTags)
    .innerJoin(tags, eq(tags.id, commitTags.tagId))
    .where(eq(commitTags.commitId, commitId))
    .limit(50);
  return { ...row, tags: tagRows.map((t) => t.name) };
}

// ------------------------------------------------------------------ ticker
export interface Ticker {
  today: number;
  last7: number;
  prev7: number;
  activeDays7: number;
  /** Days of the last 7 the account existed (Consistency denominator). */
  eligible7: number;
}

/** The shell's stat strip: one pass over the viewer's last 14 local days of commits. */
export async function getTicker(scope: Scope & { userId: string }, tz: string): Promise<Ticker> {
  if (empty(scope)) return { today: 0, last7: 0, prev7: 0, activeDays7: 0, eligible7: 7 };
  const day0 = localDayStart(tz, 0);
  const day6 = localDayStart(tz, 6);
  const [[row], eligible7] = await Promise.all([
    db
    .select({
      today: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${day0}), 0)::int`,
      last7: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${day6}), 0)::int`,
      prev7: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} < ${day6}), 0)::int`,
      activeDays7: sql<number>`count(distinct (${commits.createdAt} at time zone ${tz})::date) filter (where ${commits.createdAt} >= ${day6})::int`,
    })
    .from(commits)
    .where(and(...commitWhere(scope), gte(commits.createdAt, localDayStart(tz, 13)))),
    getEligibleDays(scope, tz, 7),
  ]);
  return { ...(row ?? { today: 0, last7: 0, prev7: 0, activeDays7: 0 }), eligible7 };
}

// ------------------------------------------------------------------ tasks
export interface TaskCard {
  id: string;
  title: string;
  priority: string;
  weight: number;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  columnId: string | null;
  position: string;
  projectName: string | null;
  projectSlug: string | null;
  recurrenceRule: string | null;
  columnEnteredAt: Date;
  deferUntil: Date | null;
  plannedFor: string | null;
  tags: string[];
}

const taskCardFields = {
  id: tasks.id,
  title: tasks.title,
  priority: tasks.priority,
  weight: tasks.weight,
  dueAt: tasks.dueAt,
  startedAt: tasks.startedAt,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  columnId: tasks.columnId,
  position: tasks.position,
  projectName: projects.name,
  projectSlug: projects.slug,
  recurrenceRule: tasks.recurrenceRule,
  columnEnteredAt: tasks.columnEnteredAt,
  deferUntil: tasks.deferUntil,
  plannedFor: tasks.plannedFor,
};

async function withTags<T extends { id: string }>(rows: T[]): Promise<(T & { tags: string[] })[]> {
  if (rows.length === 0) return [];
  const tagRows = await db
    .select({ taskId: taskTags.taskId, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, rows.map((r) => r.id)));
  const byTask = new Map<string, string[]>();
  for (const t of tagRows) byTask.set(t.taskId, [...(byTask.get(t.taskId) ?? []), t.name]);
  return rows.map((r) => ({ ...r, tags: byTask.get(r.id) ?? [] }));
}

function selectTaskCards() {
  return db
    .select(taskCardFields)
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId));
}

export interface BoardData {
  id: string;
  name: string;
  columns: { id: string; name: string; stateType: string; wipLimit: number | null }[];
  tasks: (TaskCard & { description: string | null })[];
  doneWindowDays: number;
}

/** Upper bound on cards sent to one board view; keeps payloads bounded on huge boards. */
const BOARD_CARD_LIMIT = 1000;

/** Board with open tasks and Done tasks from the last `doneWindowDays` days. */
export async function getBoard(boardId: string, workspaceIds: string[], doneWindowDays = 14): Promise<BoardData | null> {
  if (workspaceIds.length === 0) return null;
  const [board] = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .where(and(eq(boards.id, boardId), inArray(boards.workspaceId, workspaceIds)))
    .limit(1);
  if (!board) return null;

  const cols = await db
    .select({ id: columns.id, name: columns.name, stateType: columns.stateType, wipLimit: columns.wipLimit })
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(asc(columns.position), asc(columns.id))
    .limit(50);

  const rows = await db
    .select({ ...taskCardFields, description: tasks.description })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.boardId, boardId),
        isNull(tasks.deletedAt),
        isNull(tasks.archivedAt),
        sql`(${tasks.completedAt} is null or ${tasks.completedAt} >= now() - make_interval(days => ${doneWindowDays}))`
      )
    )
    // Bytewise order matches the fractional keys written by lib/position.ts
    .orderBy(sql`${tasks.position} collate "C"`, asc(tasks.id))
    .limit(BOARD_CARD_LIMIT);

  return { ...board, columns: cols, tasks: await withTags(rows), doneWindowDays };
}

const inboxWhere = (personalWorkspaceId: string) =>
  and(eq(tasks.workspaceId, personalWorkspaceId), isNull(tasks.boardId), isNull(tasks.deletedAt), isNull(tasks.completedAt));

export async function getInbox(personalWorkspaceId: string | null, limit = 200): Promise<TaskCard[]> {
  if (!personalWorkspaceId) return [];
  const rows = await selectTaskCards().where(inboxWhere(personalWorkspaceId)).orderBy(desc(tasks.createdAt)).limit(limit);
  return withTags(rows);
}

export async function getInboxCount(personalWorkspaceId: string | null): Promise<number> {
  if (!personalWorkspaceId) return 0;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(inboxWhere(personalWorkspaceId));
  return row.n;
}

export async function getTaskDetail(taskId: string, workspaceIds: string[]) {
  if (workspaceIds.length === 0) return null;
  const [row] = await db
    .select({
      ...taskCardFields,
      workspaceId: tasks.workspaceId,
      boardId: tasks.boardId,
      projectId: tasks.projectId,
      description: tasks.description,
      recurrenceRule: tasks.recurrenceRule,
      boardName: boards.name,
      columnName: columns.name,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(boards, eq(boards.id, tasks.boardId))
    .leftJoin(columns, eq(columns.id, tasks.columnId))
    .where(and(eq(tasks.id, taskId), inArray(tasks.workspaceId, workspaceIds), isNull(tasks.deletedAt)))
    .limit(1);
  if (!row) return null;
  const [withTag] = await withTags([row]);
  const [commit] = await db
    .select({ id: commits.id, message: commits.message, executionValue: commits.executionValue, createdAt: commits.createdAt })
    .from(commits)
    .where(and(eq(commits.taskId, taskId), isNull(commits.deletedAt)))
    .limit(1);
  return { ...withTag, commit: commit ?? null };
}

/** All columns of a board, in order, if the viewer can read it (the task panel's status control). */
export async function getBoardColumns(boardId: string, workspaceIds: string[]): Promise<{ id: string; name: string; stateType: string }[]> {
  if (workspaceIds.length === 0) return [];
  return db
    .select({ id: columns.id, name: columns.name, stateType: columns.stateType })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .where(and(eq(columns.boardId, boardId), inArray(boards.workspaceId, workspaceIds)))
    .orderBy(asc(columns.position), asc(columns.id))
    .limit(50);
}

export interface BoardTarget {
  id: string;
  name: string;
  columns: { id: string; name: string; stateType: string }[];
}

/** Boards in one workspace with their open (non-Done) columns: where an Inbox task can go. */
export async function getBoardTargets(workspaceId: string, workspaceIds: string[]): Promise<BoardTarget[]> {
  if (!workspaceIds.includes(workspaceId)) return [];
  const rows = await db
    .select({ boardId: boards.id, boardName: boards.name, id: columns.id, name: columns.name, stateType: columns.stateType })
    .from(boards)
    .innerJoin(columns, eq(columns.boardId, boards.id))
    .where(and(eq(boards.workspaceId, workspaceId), sql`${columns.stateType} <> 'done'`))
    .orderBy(asc(boards.createdAt), asc(boards.id), asc(columns.position))
    .limit(200);
  const byBoard = new Map<string, BoardTarget>();
  for (const r of rows) {
    const board = byBoard.get(r.boardId) ?? { id: r.boardId, name: r.boardName, columns: [] };
    board.columns.push({ id: r.id, name: r.name, stateType: r.stateType });
    byBoard.set(r.boardId, board);
  }
  return [...byBoard.values()];
}

export interface TodayData {
  active: TaskCard[];
  queued: TaskCard[];
  overdue: TaskCard[];
  completed: TaskCard[];
  commits: CommitRow[];
  executionToday: number;
}

export async function getToday(scope: Scope & { userId: string }, tz: string): Promise<TodayData> {
  if (empty(scope)) return { active: [], queued: [], overdue: [], completed: [], commits: [], executionToday: 0 };
  const open = and(...taskWhere(scope), isNull(tasks.completedAt), isNull(tasks.archivedAt));
  // Overdue tasks get their own list, so Active and Queued exclude them
  const notOverdue = sql`(${tasks.dueAt} is null or ${tasks.dueAt} >= ${localDayStart(tz, 0)})`;

  const [active, queued, overdue, completed, todayCommits] = await Promise.all([
    selectTaskCards()
      .innerJoin(columns, eq(columns.id, tasks.columnId))
      .where(and(open, notOverdue, inArray(columns.stateType, ["active", "review"])))
      .orderBy(asc(PRIORITY_RANK), asc(tasks.dueAt)),
    selectTaskCards()
      .innerJoin(columns, eq(columns.id, tasks.columnId))
      .where(and(open, notOverdue, eq(columns.stateType, "backlog")))
      .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(PRIORITY_RANK))
      .limit(6),
    selectTaskCards().where(and(open, isNotNull(tasks.dueAt), lt(tasks.dueAt, localDayStart(tz, 0)))).orderBy(asc(tasks.dueAt)),
    selectTaskCards()
      .where(and(...taskWhere(scope), gte(tasks.completedAt, localDayStart(tz, 0))))
      .orderBy(desc(tasks.completedAt)),
    getCommits(scope, { sinceDays: 1, tz }),
  ]);

  return {
    active: await withTags(active),
    queued: await withTags(queued),
    overdue: await withTags(overdue),
    completed: await withTags(completed),
    commits: todayCommits,
    executionToday: todayCommits.reduce((sum, c) => sum + c.executionValue, 0),
  };
}

// ------------------------------------------------------------------ metrics
export interface MetricsData {
  days: number;
  execution: number;
  previousExecution: number;
  commits: number;
  tasksCompleted: number;
  activeDays: number;
  /** Days of the period the account existed, today included (Consistency denominator). */
  eligibleDays: number;
  plannedTasks: number;
  plannedCompleted: number;
  cycleTimesMs: number[];
  daily: DailyExecution[];
  byProject: { name: string; execution: number }[];
}

export async function getMetrics(scope: Scope, tz: string, days: number): Promise<MetricsData> {
  const daily = await getDailyExecution(scope, tz, days);
  if (empty(scope)) {
    return { days, execution: 0, previousExecution: 0, commits: 0, tasksCompleted: 0, activeDays: 0, eligibleDays: days, plannedTasks: 0, plannedCompleted: 0, cycleTimesMs: [], daily, byProject: [] };
  }
  const start = localDayStart(tz, days - 1);
  const previousStart = localDayStart(tz, 2 * days - 1);

  const [[previous], cycle, [planned], byProject, eligibleDays] = await Promise.all([
    db
      .select({ execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int` })
      .from(commits)
      .where(and(...commitWhere(scope), gte(commits.createdAt, previousStart), lt(commits.createdAt, start))),
    db
      .select({ ms: sql<number>`extract(epoch from (${tasks.completedAt} - ${tasks.startedAt})) * 1000` })
      .from(tasks)
      .where(and(...taskWhere(scope), gte(tasks.completedAt, start), isNotNull(tasks.startedAt))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(${tasks.completedAt})::int`,
      })
      .from(tasks)
      .where(and(...taskWhere(scope), isNotNull(tasks.boardId), gte(tasks.createdAt, start))),
    db
      .select({ name: sql<string>`coalesce(${projects.name}, 'No project')`, execution: sql<number>`sum(${commits.executionValue})::int` })
      .from(commits)
      .leftJoin(projects, eq(projects.id, commits.projectId))
      .where(and(...commitWhere(scope), gte(commits.createdAt, start)))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(50),
    getEligibleDays(scope, tz, days),
  ]);

  return {
    days,
    eligibleDays,
    execution: daily.reduce((s, d) => s + d.execution, 0),
    previousExecution: previous.execution,
    commits: daily.reduce((s, d) => s + d.commits, 0),
    tasksCompleted: cycle.length + (await countCompletedWithoutStart(scope, start)),
    activeDays: daily.filter((d) => d.commits > 0).length,
    plannedTasks: planned.total,
    plannedCompleted: planned.completed,
    cycleTimesMs: cycle.map((c) => Number(c.ms)),
    daily,
    byProject,
  };
}

async function countCompletedWithoutStart(scope: Scope, start: SQL) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...taskWhere(scope), gte(tasks.completedAt, start), isNull(tasks.startedAt)));
  return row.n;
}

export interface MetricSeries {
  /** Daily execution over `history` days (the period, the prior period and SMA warm-up). */
  history: DailyExecution[];
  /** Commits by local ISO weekday (1 = Monday) and hour, current period. */
  punchcard: { dow: number; hour: number; commits: number; execution: number }[];
  /** Commits grouped by execution value, current period. */
  weights: { weight: number; commits: number; execution: number }[];
  /** Tasks created and completed per local day, current period. */
  flow: { day: string; created: number; completed: number }[];
  /** Cycle times of tasks completed in the current and prior periods. */
  cycles: { day: string; ms: number }[];
  /** Execution per project, current and prior period. */
  projects: { name: string; execution: number; previous: number; commits: number; activeDays: number }[];
}

/** Time-series inputs for the Metrics page; every list is bounded. */
export async function getMetricSeries(scope: Scope, tz: string, days: number): Promise<MetricSeries> {
  const historyDays = Math.max(2 * days, days + 27);
  const history = await getDailyExecution(scope, tz, historyDays);
  if (empty(scope)) return { history, punchcard: [], weights: [], flow: [], cycles: [], projects: [] };
  const start = localDayStart(tz, days - 1);
  const previousStart = localDayStart(tz, 2 * days - 1);
  const localDay = (column: typeof tasks.createdAt | typeof tasks.completedAt) => sql<string>`to_char(${column} at time zone ${tz}, 'YYYY-MM-DD')`;

  const [punchcard, weights, created, completed, cycles, byProject] = await Promise.all([
    db
      .select({
        dow: sql<number>`extract(isodow from ${commits.createdAt} at time zone ${tz})::int`,
        hour: sql<number>`extract(hour from ${commits.createdAt} at time zone ${tz})::int`,
        commits: sql<number>`count(*)::int`,
        execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int`,
      })
      .from(commits)
      .where(and(...commitWhere(scope), gte(commits.createdAt, start)))
      .groupBy(sql`1`, sql`2`)
      .limit(168),
    db
      .select({
        weight: commits.executionValue,
        commits: sql<number>`count(*)::int`,
        execution: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int`,
      })
      .from(commits)
      .where(and(...commitWhere(scope), gte(commits.createdAt, start)))
      .groupBy(commits.executionValue)
      .orderBy(asc(commits.executionValue))
      .limit(50),
    db
      .select({ day: localDay(tasks.createdAt), n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(...taskWhere(scope), gte(tasks.createdAt, start)))
      .groupBy(sql`1`)
      .limit(400),
    db
      .select({ day: localDay(tasks.completedAt), n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(...taskWhere(scope), gte(tasks.completedAt, start)))
      .groupBy(sql`1`)
      .limit(400),
    db
      .select({ day: localDay(tasks.completedAt), ms: sql<number>`extract(epoch from (${tasks.completedAt} - ${tasks.startedAt})) * 1000` })
      .from(tasks)
      .where(and(...taskWhere(scope), gte(tasks.completedAt, previousStart), isNotNull(tasks.startedAt)))
      .orderBy(asc(tasks.completedAt))
      .limit(5000),
    db
      .select({
        name: sql<string>`coalesce(${projects.name}, 'No project')`,
        execution: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${start}), 0)::int`,
        previous: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} < ${start}), 0)::int`,
        commits: sql<number>`count(*) filter (where ${commits.createdAt} >= ${start})::int`,
        activeDays: sql<number>`count(distinct (${commits.createdAt} at time zone ${tz})::date) filter (where ${commits.createdAt} >= ${start})::int`,
      })
      .from(commits)
      .leftJoin(projects, eq(projects.id, commits.projectId))
      .where(and(...commitWhere(scope), gte(commits.createdAt, previousStart)))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`, sql`3 desc`)
      .limit(50),
  ]);

  const createdBy = new Map(created.map((r) => [r.day, r.n]));
  const completedBy = new Map(completed.map((r) => [r.day, r.n]));
  return {
    history,
    punchcard,
    weights,
    flow: history.slice(-days).map((d) => ({ day: d.day, created: createdBy.get(d.day) ?? 0, completed: completedBy.get(d.day) ?? 0 })),
    cycles: cycles.map((c) => ({ day: c.day, ms: Number(c.ms) })),
    projects: byProject,
  };
}

// ------------------------------------------------------------------ projects
export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  workspaceId: string;
  openTasks: number;
  completedTasks: number;
  commits7d: number;
  execution30d: number;
  lastCommitAt: Date | null;
}

/** Live projects of one workspace for a picker, if the viewer can read it. */
export async function getProjectOptions(workspaceId: string, workspaceIds: string[]): Promise<{ id: string; name: string; slug: string }[]> {
  if (!workspaceIds.includes(workspaceId)) return [];
  return db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name))
    .limit(200);
}

/** Live projects with counts. "7d" and "30d" are the viewer's last 7 and 30 local days, today included. */
export async function getProjects(workspaceIds: string[], tz: string): Promise<ProjectSummary[]> {
  if (workspaceIds.length === 0) return [];
  const taskCounts = db
    .select({
      projectId: tasks.projectId,
      open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)::int`.as("open"),
      done: sql<number>`count(${tasks.completedAt})::int`.as("done"),
    })
    .from(tasks)
    .where(and(inArray(tasks.workspaceId, workspaceIds), isNull(tasks.deletedAt)))
    .groupBy(tasks.projectId)
    .as("tc");
  const commitStats = db
    .select({
      projectId: commits.projectId,
      c7: sql<number>`count(*) filter (where ${commits.createdAt} >= ${localDayStart(tz, 6)})::int`.as("c7"),
      e30: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${localDayStart(tz, 29)}), 0)::int`.as("e30"),
      last: sql<Date>`max(${commits.createdAt})`.as("last"),
    })
    .from(commits)
    .where(and(inArray(commits.workspaceId, workspaceIds), isNull(commits.deletedAt)))
    .groupBy(commits.projectId)
    .as("cs");

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      status: projects.status,
      description: projects.description,
      workspaceId: projects.workspaceId,
      openTasks: sql<number>`coalesce(${taskCounts.open}, 0)`,
      completedTasks: sql<number>`coalesce(${taskCounts.done}, 0)`,
      commits7d: sql<number>`coalesce(${commitStats.c7}, 0)`,
      execution30d: sql<number>`coalesce(${commitStats.e30}, 0)`,
      lastCommitAt: commitStats.last,
    })
    .from(projects)
    .leftJoin(taskCounts, eq(taskCounts.projectId, projects.id))
    .leftJoin(commitStats, eq(commitStats.projectId, projects.id))
    .where(and(inArray(projects.workspaceId, workspaceIds), isNull(projects.archivedAt)))
    .orderBy(sql`case ${projects.status} when 'active' then 0 when 'planned' then 1 when 'paused' then 2 else 3 end`, asc(projects.name))
    .limit(200);
  return rows.map((r) => ({ ...r, lastCommitAt: r.lastCommitAt ? new Date(r.lastCommitAt) : null }));
}

/** Live projects for the shell (sidebar, palette, Log work): names only, no aggregates. */
export async function getShellProjects(workspaceIds: string[]): Promise<{ id: string; name: string; slug: string }[]> {
  if (workspaceIds.length === 0) return [];
  return db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(and(inArray(projects.workspaceId, workspaceIds), isNull(projects.archivedAt)))
    .orderBy(sql`case ${projects.status} when 'active' then 0 when 'planned' then 1 when 'paused' then 2 else 3 end`, asc(projects.name))
    .limit(200);
}

/** The person's last distinct manual commit messages, newest first (Log work suggestions). */
export async function getRecentManualMessages(userId: string, workspaceIds: string[], limit = 20): Promise<string[]> {
  if (workspaceIds.length === 0) return [];
  const rows = await db
    .select({ message: commits.message, at: sql<Date>`max(${commits.createdAt})` })
    .from(commits)
    .where(and(inArray(commits.workspaceId, workspaceIds), eq(commits.userId, userId), eq(commits.source, "manual"), isNull(commits.deletedAt)))
    .groupBy(commits.message)
    .orderBy(sql`2 desc`)
    .limit(limit);
  return rows.map((r) => r.message);
}

/** Archived projects in the given workspaces, most recently archived first. */
export async function getArchivedProjects(workspaceIds: string[], limit = 100) {
  if (workspaceIds.length === 0) return [];
  return db
    .select({ id: projects.id, name: projects.name, slug: projects.slug, workspaceId: projects.workspaceId, archivedAt: projects.archivedAt })
    .from(projects)
    .where(and(inArray(projects.workspaceId, workspaceIds), isNotNull(projects.archivedAt)))
    .orderBy(desc(projects.archivedAt))
    .limit(limit);
}

export async function getProjectBySlug(workspaceId: string, slug: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, slug)))
    .limit(1);
  return project ?? null;
}

export async function getOpenTasks(scope: Scope): Promise<(TaskCard & { columnName: string | null })[]> {
  if (empty(scope)) return [];
  const rows = await db
    .select({ ...taskCardFields, columnName: columns.name })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(columns, eq(columns.id, tasks.columnId))
    .where(and(...taskWhere(scope), isNull(tasks.completedAt), isNull(tasks.archivedAt)))
    .orderBy(asc(columns.position), asc(PRIORITY_RANK))
    .limit(500);
  return withTags(rows);
}

// ------------------------------------------------------------------ objectives, account
/**
 * Live objectives with their linked project. An "execution" objective's current value is
 * worked out here: the sum of commit execution since it started, in its linked project
 * when it has one, otherwise across its workspace.
 */
export async function getObjectives(workspaceIds: string[], opts: { archived?: boolean } = {}) {
  if (workspaceIds.length === 0) return [];
  const rows = await db
    .select()
    .from(objectives)
    .where(and(inArray(objectives.workspaceId, workspaceIds), opts.archived ? isNotNull(objectives.archivedAt) : isNull(objectives.archivedAt)))
    .orderBy(opts.archived ? desc(objectives.archivedAt) : asc(objectives.deadlineAt), asc(objectives.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const ids = rows.map((o) => o.id);
  const links = await db
    .select({ objectiveId: objectiveProjects.objectiveId, projectId: projects.id, name: projects.name })
    .from(objectiveProjects)
    .innerJoin(projects, eq(projects.id, objectiveProjects.projectId))
    .where(inArray(objectiveProjects.objectiveId, ids))
    .limit(500);

  // Execution objectives: every sum in one grouped query (commits since start, in the
  // linked projects when there are any, otherwise across the workspace)
  const executionIds = rows.filter((o) => o.measure === "execution").map((o) => o.id);
  const sums = executionIds.length
    ? await db
        .select({ id: objectives.id, total: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int` })
        .from(objectives)
        .leftJoin(
          commits,
          and(
            eq(commits.workspaceId, objectives.workspaceId),
            isNull(commits.deletedAt),
            gte(commits.createdAt, objectives.startAt),
            sql`(not exists (select 1 from ${objectiveProjects} op where op.objective_id = ${objectives.id}) or ${commits.projectId} in (select op.project_id from ${objectiveProjects} op where op.objective_id = ${objectives.id}))`
          )
        )
        .where(inArray(objectives.id, executionIds))
        .groupBy(objectives.id)
    : [];
  const sumOf = new Map(sums.map((r) => [r.id, r.total]));

  return Promise.all(
    rows.map(async (o) => {
      const linked = links.filter((l) => l.objectiveId === o.id);
      const projectName = linked[0]?.name ?? null;
      const projectId = linked[0]?.projectId ?? null;
      if (o.measure !== "execution") return { ...o, projectName, projectId };
      const total = sumOf.get(o.id) ?? 0;
      let completedAt = total >= o.targetValue ? o.completedAt : null;
      if (total >= o.targetValue && !completedAt) completedAt = await settleCompletion(o, linked.map((l) => l.projectId));
      return { ...o, currentValue: total, completedAt, projectName, projectId };
    })
  );
}

/**
 * When an execution objective first reads as reached: the time of the commit whose
 * running sum crossed the target, stored once so it never moves again.
 */
async function settleCompletion(o: { id: string; workspaceId: string; startAt: Date; targetValue: number }, projectIds: string[]): Promise<Date> {
  const running = db
    .select({
      at: commits.createdAt,
      total: sql<number>`sum(${commits.executionValue}) over (order by ${commits.createdAt}, ${commits.id})`.as("total"),
    })
    .from(commits)
    .where(
      and(
        eq(commits.workspaceId, o.workspaceId),
        isNull(commits.deletedAt),
        gte(commits.createdAt, o.startAt),
        projectIds.length ? inArray(commits.projectId, projectIds) : undefined
      )
    )
    .as("running");
  const [crossing] = await db.select({ at: running.at }).from(running).where(sql`${running.total} >= ${o.targetValue}`).orderBy(asc(running.at)).limit(1);
  const at = crossing?.at ?? new Date();
  const [row] = await db
    .update(objectives)
    .set({ completedAt: at })
    .where(and(eq(objectives.id, o.id), isNull(objectives.completedAt)))
    .returning({ completedAt: objectives.completedAt });
  return row?.completedAt ?? at;
}

/** Deleted tasks from the last 30 days, newest first (Settings → Data). */
export async function getDeletedTasks(workspaceIds: string[], limit = 100) {
  if (workspaceIds.length === 0) return [];
  return db
    .select({ id: tasks.id, title: tasks.title, deletedAt: tasks.deletedAt, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(inArray(tasks.workspaceId, workspaceIds), isNotNull(tasks.deletedAt), sql`${tasks.deletedAt} >= now() - interval '30 days'`))
    .orderBy(desc(tasks.deletedAt))
    .limit(limit);
}

/** Tag names in the viewer's workspaces (filters and suggestions), A–Z. */
export async function getTagNames(workspaceIds: string[], limit = 200): Promise<string[]> {
  if (workspaceIds.length === 0) return [];
  const rows = await db.select({ name: tags.name }).from(tags).where(inArray(tags.workspaceId, workspaceIds)).orderBy(asc(tags.name)).limit(limit);
  return rows.map((r) => r.name);
}

export async function getNotifications(userId: string, limit = 10) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getAccount(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      timezone: users.timezone,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// ------------------------------------------------------------------ search
export const SEARCH_LIMIT = 8;

export interface SearchHit {
  id: string;
  kind: "task" | "commit";
  title: string;
  /** Project name, or "Personal". */
  context: string;
  href: string;
  at: Date;
  done: boolean;
}

/** `%` and `_` in the query match themselves, not any character. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Tasks (title, description, tags, project name) and commits (message, tags, project
 * name) across the viewer's workspaces, newest first.
 * Deleted tasks and retired commits are left out; archived ones are found.
 */
export async function searchWork(q: string, workspaceIds: string[]): Promise<SearchHit[]> {
  if (workspaceIds.length === 0) return [];
  const pattern = likePattern(q);
  const [taskRows, commitRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        boardId: tasks.boardId,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          inArray(tasks.workspaceId, workspaceIds),
          isNull(tasks.deletedAt),
          sql`(${tasks.title} ilike ${pattern} or ${tasks.description} ilike ${pattern} or ${projects.name} ilike ${pattern} or exists (select 1 from ${taskTags} join ${tags} on ${tags.id} = ${taskTags.tagId} where ${taskTags.taskId} = ${tasks.id} and ${tags.name} ilike ${pattern}))`
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(SEARCH_LIMIT),
    db
      .select({
        id: commits.id,
        message: commits.message,
        createdAt: commits.createdAt,
        projectName: projects.name,
      })
      .from(commits)
      .leftJoin(projects, eq(projects.id, commits.projectId))
      .where(
        and(
          inArray(commits.workspaceId, workspaceIds),
          isNull(commits.deletedAt),
          sql`(${commits.message} ilike ${pattern} or ${projects.name} ilike ${pattern} or exists (select 1 from ${commitTags} join ${tags} on ${tags.id} = ${commitTags.tagId} where ${commitTags.commitId} = ${commits.id} and ${tags.name} ilike ${pattern}))`
        )
      )
      .orderBy(desc(commits.createdAt))
      .limit(SEARCH_LIMIT),
  ]);
  const place = (project: string | null) => project ?? "Personal";
  return [
    ...taskRows.map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      context: place(t.projectName),
      href: t.boardId ? `/platform/board?task=${t.id}` : `/platform/inbox?task=${t.id}`,
      at: t.createdAt,
      done: t.completedAt !== null,
    })),
    ...commitRows.map((c) => ({
      id: c.id,
      kind: "commit" as const,
      title: c.message,
      context: place(c.projectName),
      href: `/platform/history?commit=${c.id}`,
      at: c.createdAt,
      done: true,
    })),
  ];
}

/** Whether a person has recorded any commit, anywhere. */
export async function hasCommits(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: commits.id }).from(commits).where(and(eq(commits.userId, userId), isNull(commits.deletedAt))).limit(1);
  return Boolean(row);
}

/**
 * First-run setup state from the person's own personal board: their newest open task
 * there, their newest commit, and the board's Done column.
 */
export async function getOnboardingState(userId: string, personalWorkspaceId: string | null, personalBoardId: string | null) {
  if (!personalWorkspaceId || !personalBoardId) return { task: null, commit: null, doneColumnId: null };
  const [[task], [commit], [done]] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, weight: tasks.weight })
      .from(tasks)
      .where(and(eq(tasks.boardId, personalBoardId), eq(tasks.workspaceId, personalWorkspaceId), eq(tasks.creatorId, userId), isNull(tasks.completedAt), isNull(tasks.deletedAt)))
      .orderBy(desc(tasks.createdAt))
      .limit(1),
    db
      .select({ message: commits.message, executionValue: commits.executionValue })
      .from(commits)
      .where(and(eq(commits.workspaceId, personalWorkspaceId), eq(commits.userId, userId), isNull(commits.deletedAt)))
      .orderBy(desc(commits.createdAt))
      .limit(1),
    db.select({ id: columns.id }).from(columns).where(and(eq(columns.boardId, personalBoardId), eq(columns.stateType, "done"))).limit(1),
  ]);
  return { task: task ?? null, commit: commit ?? null, doneColumnId: done?.id ?? null };
}
