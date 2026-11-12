import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { zoneOffsetMs } from "@/lib/tz";

/**
 * Sample data for a demo visitor's workspace: about 60 days of finished work across
 * study, build, train and design, a few open cards, Inbox captures and two objectives.
 * Runs once, right after the demo account and its empty personal workspace are created.
 *
 * Timestamps are relative to `now` and laid out on the visitor's local days, so Today always
 * has recent work. Ids are random: many demo workspaces exist side by side.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const HISTORY_DAYS = 60;

type Weight = 1 | 2 | 4 | 8;

const PROJECTS = [
  { key: "thesis", name: "Thesis", slug: "thesis", description: "Final-year research write-up.", tag: "study" },
  { key: "relay", name: "Relay", slug: "relay", description: "Side project: a small time-series store.", tag: "build" },
  { key: "marathon", name: "Marathon", slug: "marathon", description: "Training block for the spring race.", tag: "train" },
  { key: "portfolio", name: "Portfolio", slug: "portfolio", description: "Case studies and site refresh.", tag: "design" },
] as const;
type ProjectKey = (typeof PROJECTS)[number]["key"];

// Task phrasing in the imperative; commit messages in the past tense
const WORK: Record<ProjectKey, [string, string][]> = {
  thesis: [
    ["Draft methods section", "Drafted methods section"],
    ["Read three papers on sampling", "Read three papers on sampling"],
    ["Revise chapter 2 intro", "Revised chapter 2 intro"],
    ["Run regression on survey data", "Ran regression on survey data"],
    ["Fix citation format", "Fixed citation format"],
  ],
  relay: [
    ["Fix WAL replay bug", "Fixed WAL replay bug"],
    ["Add range scan tests", "Added range scan tests"],
    ["Benchmark compaction", "Benchmarked compaction"],
    ["Write migration guide", "Wrote migration guide"],
    ["Profile query planner", "Profiled query planner"],
  ],
  marathon: [
    ["Long run 18 km", "Ran 18 km long run"],
    ["Tempo intervals 6×800", "Did tempo intervals 6×800"],
    ["Strength block B", "Finished strength block B"],
    ["Recovery run 6 km", "Ran 6 km recovery"],
  ],
  portfolio: [
    ["Case study layout", "Laid out case study"],
    ["Type scale pass", "Finished type scale pass"],
    ["Export icon set", "Exported icon set"],
    ["Write project captions", "Wrote project captions"],
  ],
};

const OPEN: { title: string; key: ProjectKey; column: "backlog" | "active"; weight: Weight; priority: string; dueDays?: number }[] = [
  { title: "Finish literature review", key: "thesis", column: "active", weight: 4, priority: "high", dueDays: 1 },
  { title: "Implement snapshot reader", key: "relay", column: "active", weight: 4, priority: "medium", dueDays: 3 },
  { title: "Plan taper week", key: "marathon", column: "active", weight: 1, priority: "low" },
  { title: "Write discussion chapter", key: "thesis", column: "backlog", weight: 8, priority: "high", dueDays: 14 },
  { title: "Document the CLI", key: "relay", column: "backlog", weight: 2, priority: "low" },
  { title: "Prototype onboarding flow", key: "portfolio", column: "backlog", weight: 2, priority: "medium", dueDays: 6 },
  { title: "Book race-day travel", key: "marathon", column: "backlog", weight: 1, priority: "none", dueDays: 9 },
];

const INBOX = [
  ["Look into trigram search", 3],
  ["Email supervisor about deadline", 20],
  ["Try a new grid for the case studies", 46],
] as const;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fills the user's (already provisioned, empty) personal workspace with sample work. */
export async function seedDemoData(userId: string, now = Date.now(), tz = "UTC"): Promise<void> {
  const rand = mulberry32(Math.floor(now / DAY));
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const between = (min: number, max: number) => min + rand() * (max - min);
  const weighted = (): Weight => pick([1, 2, 2, 2, 2, 4, 4, 8] as const);
  // Local midnight in the visitor's zone, as epoch ms
  const offset = zoneOffsetMs(tz, new Date(now));
  const todayStart = Math.floor((now + offset) / DAY) * DAY - offset;
  const at = (daysAgo: number, hour: number) => new Date(todayStart - daysAgo * DAY + hour * HOUR);
  const id = () => crypto.randomUUID();

  await db.transaction(async (tx) => {
    const [ws] = await tx
      .select({ id: s.workspaces.id })
      .from(s.workspaces)
      .where(and(eq(s.workspaces.ownerId, userId), eq(s.workspaces.type, "personal")))
      .limit(1);
    if (!ws) throw new Error("demo seed: no personal workspace");
    const [board] = await tx.select({ id: s.boards.id }).from(s.boards).where(eq(s.boards.workspaceId, ws.id)).limit(1);
    const cols = await tx.select({ id: s.columns.id, stateType: s.columns.stateType }).from(s.columns).where(eq(s.columns.boardId, board.id)).orderBy(asc(s.columns.position));
    const col = (state: string) => cols.find((c) => c.stateType === state)!.id;

    const projectId = Object.fromEntries(PROJECTS.map((p) => [p.key, id()])) as Record<ProjectKey, string>;
    await tx.insert(s.projects).values(
      PROJECTS.map((p) => ({ id: projectId[p.key], workspaceId: ws.id, name: p.name, slug: p.slug, description: p.description, createdAt: at(HISTORY_DAYS + 5, 10) }))
    );
    const tagId = Object.fromEntries(PROJECTS.map((p) => [p.tag, id()])) as Record<string, string>;
    await tx.insert(s.tags).values(Object.entries(tagId).map(([name, tid]) => ({ id: tid, workspaceId: ws.id, name })));
    const tagOf = (key: ProjectKey) => tagId[PROJECTS.find((p) => p.key === key)!.tag];

    const tasks: (typeof s.tasks.$inferInsert)[] = [];
    const commits: (typeof s.commits.$inferInsert)[] = [];
    const taskTags: (typeof s.taskTags.$inferInsert)[] = [];
    const commitTags: (typeof s.commitTags.$inferInsert)[] = [];
    let position = 0;
    const pos = () => `a${(position++).toString(36).padStart(4, "0")}`;
    const keys = PROJECTS.map((p) => p.key);

    for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
      const weekend = [0, 6].includes(new Date(todayStart - d * DAY).getUTCDay());
      if (rand() < (weekend ? 0.45 : 0.08)) continue; // rest day
      const count = Math.max(1, Math.round((weekend ? 1.5 : 3) * (0.6 + (HISTORY_DAYS - d) / 120) * between(0.5, 1.4)));
      for (let i = 0; i < count; i++) {
        // Today: only times that have already happened
        const completedAt = d === 0 ? new Date(now - between(20, 8 * 60) * 60_000) : at(d, between(8, 22));
        if (completedAt.getTime() < todayStart - d * DAY) continue;
        const key = pick(keys);
        const [title, message] = pick(WORK[key]);
        const weight = weighted();
        const startedAt = new Date(completedAt.getTime() - between(1.5, 72) * HOUR);
        const taskId = id();
        const commitId = id();
        tasks.push({
          id: taskId,
          workspaceId: ws.id,
          projectId: projectId[key],
          boardId: board.id,
          columnId: col("done"),
          creatorId: userId,
          assigneeId: userId,
          title,
          priority: pick(["none", "low", "medium", "medium", "high"]),
          weight,
          position: pos(),
          createdAt: new Date(startedAt.getTime() - between(2, 96) * HOUR),
          startedAt,
          completedAt,
          updatedAt: completedAt,
        });
        commits.push({ id: commitId, workspaceId: ws.id, projectId: projectId[key], taskId, userId, message, executionValue: weight, source: "task_completion", createdAt: completedAt });
        taskTags.push({ taskId, tagId: tagOf(key) });
        commitTags.push({ commitId, tagId: tagOf(key) });
      }
      // Occasional manual commits: executed work that was never planned as a task
      if (d > 0 && rand() < 0.3) {
        const key = pick(keys);
        commits.push({ id: id(), workspaceId: ws.id, projectId: projectId[key], userId, message: `Notes: ${pick(WORK[key])[1].toLowerCase()}`, executionValue: pick([1, 2] as const), source: "manual", createdAt: at(d, between(7, 22)) });
      }
    }

    for (const t of OPEN) {
      const taskId = id();
      const createdAt = at(Math.floor(between(1, 15)), between(9, 20));
      tasks.push({
        id: taskId,
        workspaceId: ws.id,
        projectId: projectId[t.key],
        boardId: board.id,
        columnId: col(t.column),
        creatorId: userId,
        assigneeId: userId,
        title: t.title,
        priority: t.priority,
        weight: t.weight,
        position: pos(),
        dueAt: t.dueDays === undefined ? null : new Date(todayStart + t.dueDays * DAY + 18 * HOUR),
        startedAt: t.column === "active" ? new Date(Math.max(createdAt.getTime(), now - between(4, 48) * HOUR)) : null,
        createdAt,
      });
      taskTags.push({ taskId, tagId: tagOf(t.key) });
    }

    for (const [title, hoursAgo] of INBOX) {
      tasks.push({ id: id(), workspaceId: ws.id, creatorId: userId, assigneeId: userId, title, weight: 2, position: pos(), createdAt: new Date(now - hoursAgo * HOUR) });
    }

    for (let i = 0; i < tasks.length; i += 200) await tx.insert(s.tasks).values(tasks.slice(i, i + 200));
    for (let i = 0; i < commits.length; i += 200) await tx.insert(s.commits).values(commits.slice(i, i + 200));
    if (taskTags.length) await tx.insert(s.taskTags).values(taskTags);
    if (commitTags.length) await tx.insert(s.commitTags).values(commitTags);

    const thesisGoal = id();
    await tx.insert(s.objectives).values([
      { id: thesisGoal, workspaceId: ws.id, ownerId: userId, name: "Submit thesis draft", currentValue: 5, targetValue: 9, unit: "chapters", startAt: at(40, 9), deadlineAt: at(-30, 23) },
      { id: id(), workspaceId: ws.id, ownerId: userId, name: "Run 300 km this block", currentValue: 182, targetValue: 300, unit: "km", startAt: at(35, 9), deadlineAt: at(-21, 23) },
    ]);
    await tx.insert(s.objectiveProjects).values({ objectiveId: thesisGoal, projectId: projectId.thesis });
    await tx.update(s.users).set({ onboardedAt: new Date(now) }).where(eq(s.users.id, userId));
  });
}
