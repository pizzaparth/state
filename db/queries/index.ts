import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import {
  accounts,
  boards,
  columns,
  commitTags,
  commits,
  notifications,
  objectiveProjects,
  objectives,
  organisationInvitations,
  organisationMembers,
  organisations,
  payments,
  projects,
  subscriptions,
  tags,
  taskTags,
  tasks,
  users,
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
}

export async function getCommits(
  scope: Scope,
  opts: { limit?: number; sinceDays?: number; tz?: string } = {}
): Promise<CommitRow[]> {
  if (empty(scope)) return [];
  const where = commitWhere(scope);
  if (opts.sinceDays !== undefined && opts.tz) where.push(gte(commits.createdAt, localDayStart(opts.tz, opts.sinceDays - 1)));
  return db
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
    .where(and(...where))
    .orderBy(desc(commits.createdAt))
    .limit(opts.limit ?? 200);
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
    .where(eq(commitTags.commitId, commitId));
  return { ...row, tags: tagRows.map((t) => t.name) };
}

// ------------------------------------------------------------------ ticker
export interface Ticker {
  today: number;
  last7: number;
  prev7: number;
  activeDays7: number;
}

/** The shell's stat strip: one pass over the viewer's last 14 local days of commits. */
export async function getTicker(scope: Scope & { userId: string }, tz: string): Promise<Ticker> {
  if (empty(scope)) return { today: 0, last7: 0, prev7: 0, activeDays7: 0 };
  const day0 = localDayStart(tz, 0);
  const day6 = localDayStart(tz, 6);
  const [row] = await db
    .select({
      today: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${day0}), 0)::int`,
      last7: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= ${day6}), 0)::int`,
      prev7: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} < ${day6}), 0)::int`,
      activeDays7: sql<number>`count(distinct (${commits.createdAt} at time zone ${tz})::date) filter (where ${commits.createdAt} >= ${day6})::int`,
    })
    .from(commits)
    .where(and(...commitWhere(scope), gte(commits.createdAt, localDayStart(tz, 13))));
  return row ?? { today: 0, last7: 0, prev7: 0, activeDays7: 0 };
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
  assigneeName: string | null;
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
  assigneeName: users.name,
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
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId));
}

export interface BoardData {
  id: string;
  name: string;
  columns: { id: string; name: string; stateType: string; total: number }[];
  tasks: TaskCard[];
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

  const [colRows, totals] = await Promise.all([
    db
      .select({ id: columns.id, name: columns.name, stateType: columns.stateType })
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(asc(columns.position)),
    db
      .select({ columnId: tasks.columnId, total: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), isNull(tasks.deletedAt), isNull(tasks.archivedAt)))
      .groupBy(tasks.columnId),
  ]);
  const totalBy = new Map(totals.map((t) => [t.columnId, t.total]));
  const cols = colRows.map((c) => ({ ...c, total: totalBy.get(c.id) ?? 0 }));

  const rows = await selectTaskCards()
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
  const creator = sql<string>`(select ${users.name} from ${users} where ${users.id} = ${tasks.creatorId})`;
  const [row] = await db
    .select({
      ...taskCardFields,
      workspaceId: tasks.workspaceId,
      boardId: tasks.boardId,
      description: tasks.description,
      recurrenceRule: tasks.recurrenceRule,
      boardName: boards.name,
      columnName: columns.name,
      creatorName: creator,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
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
  plannedTasks: number;
  plannedCompleted: number;
  cycleTimesMs: number[];
  daily: DailyExecution[];
  byProject: { name: string; execution: number }[];
}

export async function getMetrics(scope: Scope, tz: string, days: number): Promise<MetricsData> {
  const daily = await getDailyExecution(scope, tz, days);
  if (empty(scope)) {
    return { days, execution: 0, previousExecution: 0, commits: 0, tasksCompleted: 0, activeDays: 0, plannedTasks: 0, plannedCompleted: 0, cycleTimesMs: [], daily, byProject: [] };
  }
  const start = localDayStart(tz, days - 1);
  const previousStart = localDayStart(tz, 2 * days - 1);

  const [[previous], cycle, [planned], byProject] = await Promise.all([
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
      .orderBy(sql`2 desc`),
  ]);

  return {
    days,
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
export async function getProjectOptions(workspaceId: string, workspaceIds: string[]) {
  if (!workspaceIds.includes(workspaceId)) return [];
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name))
    .limit(200);
}

export async function getProjects(workspaceIds: string[]): Promise<ProjectSummary[]> {
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
      c7: sql<number>`count(*) filter (where ${commits.createdAt} >= now() - interval '7 days')::int`.as("c7"),
      e30: sql<number>`coalesce(sum(${commits.executionValue}) filter (where ${commits.createdAt} >= now() - interval '30 days'), 0)::int`.as("e30"),
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
    .orderBy(sql`case ${projects.status} when 'active' then 0 when 'planned' then 1 when 'paused' then 2 else 3 end`, asc(projects.name));
  return rows.map((r) => ({ ...r, lastCommitAt: r.lastCommitAt ? new Date(r.lastCommitAt) : null }));
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
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .leftJoin(columns, eq(columns.id, tasks.columnId))
    .where(and(...taskWhere(scope), isNull(tasks.completedAt), isNull(tasks.archivedAt)))
    .orderBy(asc(columns.position), asc(PRIORITY_RANK))
    .limit(500);
  return withTags(rows);
}

// ------------------------------------------------------------------ organisations
export async function getOrgBoardId(workspaceId: string): Promise<string | null> {
  const [board] = await db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.workspaceId, workspaceId), eq(boards.type, "organisation")))
    .limit(1);
  return board?.id ?? null;
}

export async function getOrgMembers(organisationId: string, workspaceId: string) {
  const stats = db
    .select({
      userId: commits.userId,
      commits30: sql<number>`count(*)::int`.as("commits30"),
      execution30: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int`.as("execution30"),
    })
    .from(commits)
    .where(and(eq(commits.workspaceId, workspaceId), isNull(commits.deletedAt), gte(commits.createdAt, sql`now() - interval '30 days'`)))
    .groupBy(commits.userId)
    .as("ms");
  const open = db
    .select({ userId: tasks.assigneeId, open: sql<number>`count(*)::int`.as("open") })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.completedAt), isNull(tasks.deletedAt), isNotNull(tasks.boardId)))
    .groupBy(tasks.assigneeId)
    .as("mo");

  // Alphabetical on purpose: contribution is shown in context, never ranked
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: organisationMembers.role,
      joinedAt: organisationMembers.joinedAt,
      commits30: sql<number>`coalesce(${stats.commits30}, 0)`,
      execution30: sql<number>`coalesce(${stats.execution30}, 0)`,
      openTasks: sql<number>`coalesce(${open.open}, 0)`,
    })
    .from(organisationMembers)
    .innerJoin(users, eq(users.id, organisationMembers.userId))
    .leftJoin(stats, eq(stats.userId, users.id))
    .leftJoin(open, eq(open.userId, users.id))
    .where(eq(organisationMembers.organisationId, organisationId))
    .orderBy(asc(users.name))
    .limit(500);
}

export async function getPendingInvitations(organisationId: string) {
  return db
    .select({ id: organisationInvitations.id, email: organisationInvitations.email, role: organisationInvitations.role, expiresAt: organisationInvitations.expiresAt })
    .from(organisationInvitations)
    .where(and(eq(organisationInvitations.organisationId, organisationId), eq(organisationInvitations.status, "pending"), gte(organisationInvitations.expiresAt, sql`now()`)))
    .orderBy(asc(organisationInvitations.email))
    .limit(100);
}

// ------------------------------------------------------------------ objectives, account
/**
 * Live objectives with their linked project. An "execution" objective's current value is
 * worked out here: the sum of commit execution since it started, in its linked project
 * when it has one, otherwise across its workspace.
 */
export async function getObjectives(workspaceIds: string[]) {
  if (workspaceIds.length === 0) return [];
  const rows = await db
    .select()
    .from(objectives)
    .where(and(inArray(objectives.workspaceId, workspaceIds), isNull(objectives.archivedAt)))
    .orderBy(asc(objectives.deadlineAt), asc(objectives.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const links = await db
    .select({ objectiveId: objectiveProjects.objectiveId, projectId: projects.id, name: projects.name })
    .from(objectiveProjects)
    .innerJoin(projects, eq(projects.id, objectiveProjects.projectId))
    .where(inArray(objectiveProjects.objectiveId, rows.map((o) => o.id)))
    .limit(500);
  return Promise.all(
    rows.map(async (o) => {
      const linked = links.filter((l) => l.objectiveId === o.id);
      if (o.measure !== "execution") return { ...o, projectName: linked[0]?.name ?? null };
      const [{ total }] = await db
        .select({ total: sql<number>`coalesce(sum(${commits.executionValue}), 0)::int` })
        .from(commits)
        .where(
          and(
            eq(commits.workspaceId, o.workspaceId),
            isNull(commits.deletedAt),
            gte(commits.createdAt, o.startAt),
            linked.length ? inArray(commits.projectId, linked.map((l) => l.projectId)) : undefined
          )
        );
      return { ...o, currentValue: total, completedAt: total >= o.targetValue ? (o.completedAt ?? new Date()) : null, projectName: linked[0]?.name ?? null };
    })
  );
}

export async function getNotifications(userId: string, limit = 10) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getSubscription(userId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Recurring charges, newest first. */
export async function getPayments(userId: string, limit = 24) {
  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      periodStart: payments.periodStart,
      periodEnd: payments.periodEnd,
      receiptUrl: payments.receiptUrl,
      chargedAt: payments.chargedAt,
    })
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.chargedAt))
    .limit(limit);
}

/** Whether the account signs in with a password (deletion asks for it). */
export async function hasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"), isNotNull(accounts.password)))
    .limit(1);
  return Boolean(row);
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
  /** Project and place, e.g. "RelayDB · Ksan Relay". */
  context: string;
  href: string;
  at: Date;
  done: boolean;
}

/** `%` and `_` in the query match themselves, not any character. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Tasks by title and commits by message across the viewer's workspaces, newest first.
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
        orgName: organisations.name,
        orgSlug: organisations.slug,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(organisations, eq(organisations.workspaceId, tasks.workspaceId))
      .where(and(inArray(tasks.workspaceId, workspaceIds), isNull(tasks.deletedAt), sql`${tasks.title} ilike ${pattern}`))
      .orderBy(desc(tasks.createdAt))
      .limit(SEARCH_LIMIT),
    db
      .select({
        id: commits.id,
        message: commits.message,
        createdAt: commits.createdAt,
        projectName: projects.name,
        orgName: organisations.name,
      })
      .from(commits)
      .leftJoin(projects, eq(projects.id, commits.projectId))
      .leftJoin(organisations, eq(organisations.workspaceId, commits.workspaceId))
      .where(and(inArray(commits.workspaceId, workspaceIds), isNull(commits.deletedAt), sql`${commits.message} ilike ${pattern}`))
      .orderBy(desc(commits.createdAt))
      .limit(SEARCH_LIMIT),
  ]);
  const place = (project: string | null, org: string | null) => [project, org ?? "Personal"].filter(Boolean).join(" · ");
  return [
    ...taskRows.map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      context: place(t.projectName, t.orgName),
      href: t.orgSlug ? `/platform/org/${t.orgSlug}/board?task=${t.id}` : t.boardId ? `/platform/personal?task=${t.id}` : `/platform/inbox?task=${t.id}`,
      at: t.createdAt,
      done: t.completedAt !== null,
    })),
    ...commitRows.map((c) => ({
      id: c.id,
      kind: "commit" as const,
      title: c.message,
      context: place(c.projectName, c.orgName),
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
