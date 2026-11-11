import type { DailyExecution, MetricsData } from "@/db/queries";

/**
 * Demo workspace for the public landing page's metric figures; this module stands in
 * for the database. It generates a year of tasks and commits from a fixed seed, then
 * aggregates them exactly as db/queries does, so every number on the page follows from
 * the records it shows and the formulas the product uses.
 *
 * Days are UTC days ending today, so the demo never looks stale. Same seed and same day
 * give the same workspace, which keeps server and client markup identical.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const SPAN_DAYS = 400;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Work from several disciplines: study, build, train, design
const PROJECTS = {
  Thesis: ["Draft methods section", "Read three papers on sampling", "Revise chapter 2 intro", "Annotate lecture notes", "Fix citation format", "Outline discussion", "Run regression on survey data", "Rewrite abstract"],
  RelayDB: ["Fix WAL replay bug", "Add as-of join tests", "Benchmark compaction", "Write migration guide", "Profile query planner", "Ship 0.4 release notes", "Temporal index prototype", "Review storage PR"],
  Marathon: ["Long run 18 km", "Tempo intervals 6×800", "Mobility session", "Recovery run 6 km", "Strength block B", "Plan taper week"],
  Portfolio: ["Case study layout", "Export icon set", "Type scale pass", "Moodboard for rebrand", "Prototype onboarding flow", "Write project captions"],
} as const;
type ProjectName = keyof typeof PROJECTS;
const PROJECT_NAMES = Object.keys(PROJECTS) as ProjectName[];
const PROJECT_ODDS = [0.34, 0.32, 0.17, 0.17];

const PRIORITIES = ["none", "none", "low", "medium", "medium", "high"] as const;

interface DemoTask {
  id: string;
  title: string;
  project: ProjectName;
  weight: 1 | 2 | 4 | 8;
  priority: string;
  assignee: string;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

interface DemoCommit {
  id: string;
  message: string;
  project: ProjectName;
  executionValue: number;
  source: "task_completion" | "manual";
  taskId: string | null;
  author: string;
  createdAt: number;
}

export interface DemoWorkspace {
  now: Date;
  tasks: DemoTask[];
  commits: DemoCommit[];
}

function pick<T>(rand: () => number, items: readonly T[], odds?: readonly number[]): T {
  let r = rand();
  if (odds) {
    for (let i = 0; i < items.length; i++) {
      if ((r -= odds[i]) < 0) return items[i];
    }
    return items[items.length - 1];
  }
  return items[Math.floor(r * items.length)];
}

const pickWeight = (rand: () => number) => pick(rand, [1, 2, 4, 8] as const, [0.3, 0.42, 0.21, 0.07]);

// Commit hours: mornings, afternoons and a late block, never the small hours
const HOURS = [8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22];

/** A full day's records up to the end of `today`; demoWorkspaces trims them to "now". */
function generate(seed: number, people: string[], today: number): DemoWorkspace {
  const rand = mulberry32(seed);
  const tasks: DemoTask[] = [];
  const commits: DemoCommit[] = [];
  let n = 0;
  const id = (prefix: string) => `${prefix}-${seed.toString(36)}-${(n++).toString(36)}`;

  for (let i = SPAN_DAYS - 1; i >= 0; i--) {
    const day = today - i * DAY;
    const weekday = new Date(day).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    // Slow upward trend, quieter weekends, occasional rest days
    const trend = 0.6 + (SPAN_DAYS - i) / (SPAN_DAYS * 2);
    const rest = rand() < (weekend ? 0.42 : 0.07);
    const count = rest ? 0 : Math.max(1, Math.round((weekend ? 1.6 : 3.4) * trend * people.length ** 0.6 * (0.45 + rand() * 1.1)));

    for (let c = 0; c < count; c++) {
      const at = day + pick(rand, HOURS) * HOUR + Math.floor(rand() * 60) * 60_000;
      const project = pick(rand, PROJECT_NAMES, PROJECT_ODDS);
      const title = pick(rand, PROJECTS[project]);
      const author = pick(rand, people);
      const weight = pickWeight(rand);
      if (rand() < 0.78) {
        // Finished task: its commit is recorded at completion
        const cycle = Math.round((1 + rand() * rand() * 110) * HOUR);
        const startedAt = at - cycle;
        const task: DemoTask = {
          id: id("t"),
          title,
          project,
          weight,
          priority: pick(rand, PRIORITIES),
          assignee: author,
          createdAt: startedAt - Math.floor(rand() * 3 * DAY),
          startedAt,
          completedAt: at,
        };
        tasks.push(task);
        commits.push({ id: id("c"), message: title, project, executionValue: weight, source: "task_completion", taskId: task.id, author, createdAt: at });
      } else {
        commits.push({ id: id("c"), message: title, project, executionValue: weight, source: "manual", taskId: null, author, createdAt: at });
      }
    }

    // Planned work not finished yet (keeps completion and flow honest)
    const open = rest ? 0 : Math.round(rand() * 1.2 * people.length ** 0.5);
    for (let o = 0; o < open; o++) {
      const createdAt = day + pick(rand, HOURS) * HOUR;
      const project = pick(rand, PROJECT_NAMES, PROJECT_ODDS);
      const recent = i < 10;
      const started = recent && rand() < 0.4;
      tasks.push({
        id: id("t"),
        title: pick(rand, PROJECTS[project]),
        project,
        weight: pickWeight(rand),
        priority: pick(rand, PRIORITIES),
        assignee: pick(rand, people),
        createdAt,
        startedAt: started ? createdAt + Math.floor(rand() * 12 * HOUR) : null,
        completedAt: null,
      });
    }
  }
  return { now: new Date(today + DAY - 1), tasks, commits };
}

/** The workspace as it stood at `now`: later commits hidden, later completions still open. */
function asOf(w: DemoWorkspace, now: number): DemoWorkspace {
  return {
    now: new Date(now),
    commits: w.commits.filter((c) => c.createdAt <= now),
    tasks: w.tasks
      .filter((t) => t.createdAt <= now)
      .map((t) =>
        (t.completedAt ?? 0) > now || (t.startedAt ?? 0) > now
          ? { ...t, completedAt: null, startedAt: t.startedAt !== null && t.startedAt <= now ? t.startedAt : null }
          : t
      ),
  };
}

// ------------------------------------------------------------------ aggregations (mirror db/queries)

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayStart = (w: DemoWorkspace) => Math.floor(w.now.getTime() / DAY) * DAY;
/** localDayStart(tz, daysBack) for UTC. */
const dayStart = (w: DemoWorkspace, daysBack: number) => todayStart(w) - daysBack * DAY;

/** getDailyExecution: one entry per day, oldest first, zero days included. */
export function demoDaily(w: DemoWorkspace, days: number): DailyExecution[] {
  const from = dayStart(w, days - 1);
  const byDay = new Map<string, DailyExecution & { projectSet: Set<string> }>();
  for (const c of w.commits) {
    if (c.createdAt < from) continue;
    const key = dayKey(c.createdAt);
    const row = byDay.get(key) ?? { day: key, commits: 0, execution: 0, tasks: 0, projects: 0, projectSet: new Set<string>() };
    row.commits++;
    row.execution += c.executionValue;
    if (c.taskId) row.tasks++;
    row.projectSet.add(c.project);
    row.projects = row.projectSet.size;
    byDay.set(key, row);
  }
  return Array.from({ length: days }, (_, i) => {
    const key = dayKey(from + i * DAY);
    const row = byDay.get(key);
    return row ? { day: key, commits: row.commits, execution: row.execution, tasks: row.tasks, projects: row.projects } : { day: key, commits: 0, execution: 0, tasks: 0, projects: 0 };
  });
}

/** getMetrics for a period of `days`. */
export function demoMetrics(w: DemoWorkspace, days: number): MetricsData {
  const daily = demoDaily(w, days);
  const start = dayStart(w, days - 1);
  const previousStart = dayStart(w, 2 * days - 1);
  const inPeriod = w.commits.filter((c) => c.createdAt >= start);
  const done = w.tasks.filter((t) => t.completedAt !== null && t.completedAt >= start);
  const planned = w.tasks.filter((t) => t.createdAt >= start);
  const byProject = new Map<string, number>();
  for (const c of inPeriod) byProject.set(c.project, (byProject.get(c.project) ?? 0) + c.executionValue);
  return {
    days,
    execution: daily.reduce((s, d) => s + d.execution, 0),
    previousExecution: w.commits.filter((c) => c.createdAt >= previousStart && c.createdAt < start).reduce((s, c) => s + c.executionValue, 0),
    commits: daily.reduce((s, d) => s + d.commits, 0),
    tasksCompleted: done.length,
    activeDays: daily.filter((d) => d.commits > 0).length,
    plannedTasks: planned.length,
    plannedCompleted: planned.filter((t) => t.completedAt !== null).length,
    cycleTimesMs: done.filter((t) => t.startedAt !== null).map((t) => t.completedAt! - t.startedAt!),
    daily,
    byProject: [...byProject].map(([name, execution]) => ({ name, execution })).sort((a, b) => b.execution - a.execution),
  };
}

let cache: { day: number; personal: DemoWorkspace } | null = null;

/** The landing page's demo workspace as of `now` (records built once per day). */
export function demoWorkspaces(now = Date.now()): { personal: DemoWorkspace } {
  const today = Math.floor(now / DAY) * DAY;
  if (cache?.day !== today) cache = { day: today, personal: generate(0x57a7e, ["You"], today) };
  return { personal: asOf(cache.personal, now) };
}
