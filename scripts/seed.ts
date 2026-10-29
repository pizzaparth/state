/**
 * Seeds a demo dataset into the database in DATABASE_URL.
 *
 *   npm run db:seed
 *
 * Idempotent: deletes the demo users (everything they own cascades) and recreates
 * them. Timestamps are relative to the moment the seed runs, so Today always has
 * data. Randomness is seeded, so the shape of the history is stable between runs.
 * Never run against production.
 */
import { inArray, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db";
import * as s from "../db/schema";

// Demo accounts share a published password, so they must never reach a real deployment
const target = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (process.env.NODE_ENV === "production" || (!["localhost", "127.0.0.1", "::1"].includes(target) && process.env.SEED_ALLOW_REMOTE !== "1")) {
  console.error(`Refusing to seed ${target || "an unknown database"}: demo accounts use a public password. Local databases only.`);
  process.exit(2);
}

const PASSWORD = "state-demo-2026";
const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY = 86_400_000;
const NOW = Date.now();

const USERS = [
  { id: "demo-parth", name: "Parth", email: "demo@state.test", username: "parth" },
  { id: "demo-aarav", name: "Aarav Kulkarni", email: "aarav@state.test", username: "aarav" },
  { id: "demo-ishita", name: "Ishita Sharma", email: "ishita@state.test", username: "ishita" },
] as const;
const [PARTH, AARAV, ISHITA] = USERS;

// ---------------------------------------------------------------- helpers
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x5747e);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + rand() * (max - min);

/** UTC instant for a wall-clock time in IST, `daysAgo` days before today. */
function ist(daysAgo: number, hour: number, minute = 0): Date {
  const todayIstMidnight = Math.floor((NOW + IST_OFFSET_MS) / DAY) * DAY - IST_OFFSET_MS;
  return new Date(todayIstMidnight - daysAgo * DAY + (hour * 60 + minute) * 60_000);
}
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);
const weekday = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).getUTCDay();

let seq = 0;
const id = (prefix: string) => `seed-${prefix}-${(++seq).toString(36)}`;

type Weight = 1 | 2 | 4 | 8;
const weighted = (): Weight => pick([1, 2, 2, 2, 2, 4, 4, 8] as const);

// Task phrasing in the imperative; commit messages in the past tense
const VERBS = [
  ["Implement", "Implemented"],
  ["Fix", "Fixed"],
  ["Refactor", "Refactored"],
  ["Add", "Added"],
  ["Write", "Wrote"],
  ["Review", "Reviewed"],
  ["Benchmark", "Benchmarked"],
  ["Document", "Documented"],
  ["Profile", "Profiled"],
  ["Test", "Tested"],
] as const;

const SUBJECTS: Record<string, string[]> = {
  relaydb: ["temporal index", "as-of join", "vector executor", "WAL compaction", "query planner", "column encoder", "range scans", "snapshot reader"],
  state: ["auth middleware", "board drag and drop", "commit ledger", "metrics queries", "billing webhooks", "command palette", "execution graph"],
  university: ["OS assignment 4", "DBMS revision notes", "compilers lab", "networks problem set"],
  research: ["related work section", "experiment harness", "results tables", "dataset loader"],
  site: ["landing page", "pricing page", "docs navigation", "blog layout"],
  analyse: ["factor model", "backtest runner", "data ingestion"],
};

// ---------------------------------------------------------------- seed
async function main() {
  const hash = await hashPassword(PASSWORD);

  // Fresh slate for the demo accounts; workspaces, tasks, commits etc. cascade
  await db.delete(s.users).where(inArray(s.users.id, USERS.map((u) => u.id)));

  await db.transaction(async (tx) => {
    // -------------------------------------------------------------- people
    await tx.insert(s.users).values(
      USERS.map((u) => ({
        ...u,
        emailVerified: true,
        timezone: TZ,
        subscriptionStatus: "active",
        subscriptionPlan: "organisation",
        dailyExecutionTarget: 12,
        createdAt: ist(120, 10),
      }))
    );
    await tx.insert(s.accounts).values(
      USERS.map((u) => ({ id: id("acct"), userId: u.id, accountId: u.id, providerId: "credential", password: hash }))
    );

    // -------------------------------------------------------------- workspaces
    const personalWs = Object.fromEntries(USERS.map((u) => [u.id, `seed-ws-${u.username}`]));
    await tx.insert(s.workspaces).values([
      ...USERS.map((u) => ({ id: personalWs[u.id], name: "Personal", slug: `personal-${u.id}`, type: "personal", ownerId: u.id })),
      { id: "seed-ws-ksan", name: "Ksan Relay", slug: "ksan-relay", type: "organisation", ownerId: PARTH.id },
    ]);
    for (const u of USERS) {
      await tx.update(s.users).set({ defaultWorkspaceId: personalWs[u.id] }).where(sql`${s.users.id} = ${u.id}`);
    }

    const ORG_ID = "seed-org-ksan";
    await tx.insert(s.organisations).values({
      id: ORG_ID,
      workspaceId: "seed-ws-ksan",
      name: "Ksan Relay",
      slug: "ksan-relay",
      description: "Quantitative tools and research.",
      timezone: TZ,
    });
    await tx.insert(s.organisationMembers).values([
      { organisationId: ORG_ID, userId: PARTH.id, role: "owner", joinedAt: ist(110, 11) },
      { organisationId: ORG_ID, userId: AARAV.id, role: "admin", joinedAt: ist(100, 12) },
      { organisationId: ORG_ID, userId: ISHITA.id, role: "member", joinedAt: ist(80, 9) },
    ]);
    await tx.insert(s.organisationInvitations).values({
      id: id("invite"),
      organisationId: ORG_ID,
      email: "kabir@example.test",
      role: "member",
      invitedById: PARTH.id,
      token: `seed-${Math.floor(rand() * 1e12).toString(36)}`,
      status: "pending",
      expiresAt: new Date(NOW + 5 * DAY),
    });

    await tx.insert(s.subscriptions).values(
      USERS.map((u) => ({
        userId: u.id,
        organisationId: ORG_ID,
        provider: "razorpay",
        providerSubscriptionId: `sub_demo_${u.username}`,
        plan: "organisation",
        status: "active",
        seats: u.id === PARTH.id ? 3 : 1,
        currentPeriodStart: ist(12, 0),
        currentPeriodEnd: ist(-18, 0),
      }))
    );

    // -------------------------------------------------------------- projects
    const P = personalWs[PARTH.id];
    const projects = [
      { key: "relaydb", ws: P, name: "RelayDB", slug: "relaydb", status: "active", description: "Quantitative temporal database." },
      { key: "state", ws: P, name: "State", slug: "state", status: "active", description: "Quantitative execution system." },
      { key: "university", ws: P, name: "University", slug: "university", status: "active", description: "Semester 7 coursework." },
      { key: "research", ws: P, name: "Research Paper 03", slug: "research-paper-03", status: "paused", description: "Microstructure signals under latency." },
      { key: "o-relaydb", ws: "seed-ws-ksan", name: "RelayDB Core", slug: "relaydb-core", status: "active", description: "Storage and query engine." },
      { key: "o-site", ws: "seed-ws-ksan", name: "Ksan Relay Website", slug: "ksan-relay-website", status: "active", description: "Public site and docs." },
      { key: "o-state", ws: "seed-ws-ksan", name: "State", slug: "state", status: "active", description: "Execution system, team edition." },
      { key: "o-analyse", ws: "seed-ws-ksan", name: "Analyse", slug: "analyse", status: "planned", description: "Quantitative analysis platform." },
    ] as const;
    const projectId = Object.fromEntries(projects.map((p) => [p.key, `seed-proj-${p.key}`]));
    await tx.insert(s.projects).values(
      projects.map((p) => ({
        id: projectId[p.key],
        workspaceId: p.ws,
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: p.status,
        createdAt: ist(100, 10),
      }))
    );

    // -------------------------------------------------------------- boards
    await tx.insert(s.boards).values([
      ...USERS.map((u) => ({ id: `seed-board-${u.username}`, workspaceId: personalWs[u.id], name: "Personal", type: "personal" })),
      { id: "seed-board-ksan", workspaceId: "seed-ws-ksan", name: "Ksan Relay", type: "organisation" },
    ]);
    const col = (board: string, name: string) => `${board}-${name.toLowerCase()}`;
    // "Queued" is the label; its state type stays "backlog"
    const stateTypeOf = (name: string) => (name === "Queued" ? "backlog" : name.toLowerCase());
    await tx.insert(s.columns).values([
      ...USERS.flatMap((u) =>
        ["Queued", "Active", "Done"].map((name, position) => ({
          id: col(`seed-board-${u.username}`, name),
          boardId: `seed-board-${u.username}`,
          name,
          position,
          stateType: stateTypeOf(name),
        }))
      ),
      ...["Queued", "Active", "Review", "Done"].map((name, position) => ({
        id: col("seed-board-ksan", name),
        boardId: "seed-board-ksan",
        name,
        position,
        stateType: stateTypeOf(name),
      })),
    ]);
    const PB = "seed-board-parth";
    const OB = "seed-board-ksan";

    // -------------------------------------------------------------- tags
    const tagNames = { [P]: ["backend", "research", "reading", "ops", "paper"], "seed-ws-ksan": ["backend", "frontend", "infra", "docs"] };
    const tagId = (ws: string, name: string) => `seed-tag-${ws === P ? "p" : "o"}-${name}`;
    await tx.insert(s.tags).values(
      Object.entries(tagNames).flatMap(([ws, names]) => names.map((name) => ({ id: tagId(ws, name), workspaceId: ws, name })))
    );

    const tasks: (typeof s.tasks.$inferInsert)[] = [];
    const commits: (typeof s.commits.$inferInsert)[] = [];
    const taskTags: (typeof s.taskTags.$inferInsert)[] = [];
    const commitTags: (typeof s.commitTags.$inferInsert)[] = [];
    let position = 0;
    const pos = () => `a${(position++).toString(36).padStart(4, "0")}`;

    // -------------------------------------------------------------- personal history: ~90 days of completed work
    const personalProjects = ["relaydb", "state", "university", "research"] as const;
    const personalTag = { relaydb: "backend", state: "backend", university: "reading", research: "paper" } as const;
    for (let d = 89; d >= 0; d--) {
      const day = ist(d, 0);
      const weekend = [0, 6].includes(weekday(day));
      if (rand() < (weekend ? 0.45 : 0.08)) continue; // rest day
      const count = Math.max(1, Math.round((weekend ? 1.5 : 3.2) * (0.6 + (90 - d) / 140) * between(0.5, 1.4)));
      for (let i = 0; i < count; i++) {
        // Today: only times that have already happened
        const completedAt = d === 0 ? minutesAgo(between(20, 9 * 60)) : ist(d, between(9, 23), between(0, 59));
        if (completedAt.getTime() < ist(0, 0).getTime() && d === 0) continue;
        const key = pick(personalProjects);
        const [verb, past] = pick(VERBS);
        const subject = pick(SUBJECTS[key]);
        const weight = weighted();
        const taskId = id("task");
        const startedAt = new Date(completedAt.getTime() - between(1.5, 72) * 3_600_000);
        tasks.push({
          id: taskId,
          workspaceId: P,
          projectId: projectId[key],
          boardId: PB,
          columnId: col(PB, "Done"),
          creatorId: PARTH.id,
          assigneeId: PARTH.id,
          title: `${verb} ${subject}`,
          priority: pick(["none", "low", "medium", "medium", "high"]),
          weight,
          position: pos(),
          createdAt: new Date(startedAt.getTime() - between(2, 120) * 3_600_000),
          startedAt,
          completedAt,
          updatedAt: completedAt,
        });
        const commitId = id("commit");
        commits.push({
          id: commitId,
          workspaceId: P,
          projectId: projectId[key],
          taskId,
          userId: PARTH.id,
          message: `${past} ${subject}`,
          executionValue: weight,
          source: "task_completion",
          createdAt: completedAt,
        });
        taskTags.push({ taskId, tagId: tagId(P, personalTag[key]) });
        commitTags.push({ commitId, tagId: tagId(P, personalTag[key]) });
      }
      // Occasional manual commits: executed work that was never planned as a task
      if (rand() < 0.3) {
        const createdAt = d === 0 ? minutesAgo(between(30, 6 * 60)) : ist(d, between(7, 22), between(0, 59));
        if (d === 0 && createdAt.getTime() < ist(0, 0).getTime()) continue;
        const manual = pick([
          { message: "Read chapter 7 of OS", project: "university", weight: 1 },
          { message: "Finished market microstructure notes", project: "research", weight: 2 },
          { message: "Reviewed pull request #38", project: "relaydb", weight: 1 },
          { message: "Deployed staging build", project: "state", weight: 2 },
          { message: "Paired on query planner design", project: "relaydb", weight: 2 },
        ] as const);
        commits.push({
          id: id("commit"),
          workspaceId: P,
          projectId: projectId[manual.project],
          userId: PARTH.id,
          message: manual.message,
          executionValue: manual.weight,
          source: "manual",
          createdAt,
        });
      }
    }

    // -------------------------------------------------------------- personal open work
    const open: { title: string; key: (typeof personalProjects)[number]; column: "Queued" | "Active"; weight: Weight; priority: string; due?: number; description?: string }[] = [
      { title: "Finish RelayDB query parser", key: "relaydb", column: "Active", weight: 4, priority: "high", due: 0, description: "Handle nested as-of joins and window clauses. Parser tests must cover the grammar in docs/sql.md." },
      { title: "Implement caching for metric windows", key: "state", column: "Active", weight: 4, priority: "medium", due: 2 },
      { title: "Finish OS chapter 8", key: "university", column: "Active", weight: 2, priority: "medium", due: -1 },
      { title: "Review design for history filters", key: "state", column: "Active", weight: 1, priority: "low" },
      { title: "Benchmark compaction under write load", key: "relaydb", column: "Queued", weight: 4, priority: "medium", due: 6 },
      { title: "Write related work section", key: "research", column: "Queued", weight: 8, priority: "high", due: 14 },
      { title: "Update documentation for CLI", key: "state", column: "Queued", weight: 2, priority: "low" },
      { title: "Prepare DBMS mid-semester revision", key: "university", column: "Queued", weight: 2, priority: "medium", due: 4 },
      { title: "Profile vector executor allocations", key: "relaydb", column: "Queued", weight: 2, priority: "none" },
      { title: "Draft objective review for Q4", key: "state", column: "Queued", weight: 1, priority: "none", due: 9 },
    ];
    for (const t of open) {
      const taskId = id("task");
      const createdAt = ist(Math.floor(between(1, 20)), between(9, 20));
      tasks.push({
        id: taskId,
        workspaceId: P,
        projectId: projectId[t.key],
        boardId: PB,
        columnId: col(PB, t.column),
        creatorId: PARTH.id,
        assigneeId: PARTH.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        weight: t.weight,
        position: pos(),
        dueAt: t.due === undefined ? null : ist(-t.due, 18),
        startedAt: t.column === "Active" ? new Date(Math.max(createdAt.getTime(), NOW - between(4, 60) * 3_600_000)) : null,
        createdAt,
      });
      taskTags.push({ taskId, tagId: tagId(P, personalTag[t.key]) });
    }

    // Inbox: captured, not yet placed on a board
    for (const [title, hoursAgo] of [
      ["Look into trigram index for search", 3],
      ["Email professor about project extension", 20],
      ["Try Zig for the column encoder", 46],
      ["Renew domain for ksanrelay.in", 70],
    ] as const) {
      tasks.push({
        id: id("task"),
        workspaceId: P,
        creatorId: PARTH.id,
        title,
        weight: 2,
        position: pos(),
        createdAt: minutesAgo(hoursAgo * 60),
      });
    }

    // -------------------------------------------------------------- organisation history
    const ORG = "seed-ws-ksan";
    const orgProjects = ["o-relaydb", "o-site", "o-state"] as const;
    const orgSubjects = { "o-relaydb": SUBJECTS.relaydb, "o-site": SUBJECTS.site, "o-state": SUBJECTS.state } as const;
    const orgTag = { "o-relaydb": "backend", "o-site": "frontend", "o-state": "backend" } as const;
    const members = [PARTH, AARAV, ISHITA];
    for (let d = 59; d >= 0; d--) {
      const day = ist(d, 0);
      if ([0, 6].includes(weekday(day)) && rand() < 0.7) continue;
      const count = Math.round(between(1, 5));
      for (let i = 0; i < count; i++) {
        const completedAt = d === 0 ? minutesAgo(between(15, 7 * 60)) : ist(d, between(10, 21), between(0, 59));
        if (d === 0 && completedAt.getTime() < ist(0, 0).getTime()) continue;
        const key = pick(orgProjects);
        const member = pick(members);
        const [verb, past] = pick(VERBS);
        const subject = pick(orgSubjects[key]);
        const weight = weighted();
        const taskId = id("task");
        const startedAt = new Date(completedAt.getTime() - between(3, 96) * 3_600_000);
        tasks.push({
          id: taskId,
          workspaceId: ORG,
          projectId: projectId[key],
          boardId: OB,
          columnId: col(OB, "Done"),
          creatorId: pick(members).id,
          assigneeId: member.id,
          title: `${verb} ${subject}`,
          priority: pick(["none", "low", "medium", "high"]),
          weight,
          position: pos(),
          createdAt: new Date(startedAt.getTime() - between(4, 200) * 3_600_000),
          startedAt,
          completedAt,
          updatedAt: completedAt,
        });
        const commitId = id("commit");
        commits.push({
          id: commitId,
          workspaceId: ORG,
          projectId: projectId[key],
          taskId,
          userId: member.id,
          message: `${past} ${subject}`,
          executionValue: weight,
          source: "task_completion",
          createdAt: completedAt,
        });
        taskTags.push({ taskId, tagId: tagId(ORG, orgTag[key]) });
        commitTags.push({ commitId, tagId: tagId(ORG, orgTag[key]) });
      }
    }

    const orgOpen: { title: string; key: (typeof orgProjects)[number]; column: string; who: (typeof USERS)[number]; weight: Weight; priority: string; due?: number }[] = [
      { title: "Rate limiting for public API", key: "o-state", column: "Queued", who: AARAV, weight: 4, priority: "high", due: 5 },
      { title: "Billing export to CSV", key: "o-state", column: "Queued", who: ISHITA, weight: 2, priority: "medium" },
      { title: "Docs search", key: "o-site", column: "Queued", who: ISHITA, weight: 2, priority: "low" },
      { title: "Range scan iterator", key: "o-relaydb", column: "Queued", who: PARTH, weight: 8, priority: "high", due: 12 },
      { title: "As-of join tests", key: "o-relaydb", column: "Active", who: PARTH, weight: 2, priority: "medium", due: 1 },
      { title: "Vector execution for filters", key: "o-relaydb", column: "Active", who: AARAV, weight: 4, priority: "high", due: 3 },
      { title: "Pricing page copy", key: "o-site", column: "Active", who: ISHITA, weight: 1, priority: "low", due: -2 },
      { title: "Auth middleware hardening", key: "o-state", column: "Review", who: ISHITA, weight: 2, priority: "high" },
      { title: "WAL checksum verification", key: "o-relaydb", column: "Review", who: AARAV, weight: 4, priority: "critical", due: 0 },
    ];
    for (const t of orgOpen) {
      const taskId = id("task");
      const createdAt = ist(Math.floor(between(2, 25)), between(10, 19));
      tasks.push({
        id: taskId,
        workspaceId: ORG,
        projectId: projectId[t.key],
        boardId: OB,
        columnId: col(OB, t.column),
        creatorId: PARTH.id,
        assigneeId: t.who.id,
        title: t.title,
        priority: t.priority,
        weight: t.weight,
        position: pos(),
        dueAt: t.due === undefined ? null : ist(-t.due, 18),
        startedAt: t.column === "Queued" ? null : new Date(Math.max(createdAt.getTime(), NOW - between(6, 90) * 3_600_000)),
        createdAt,
      });
      taskTags.push({ taskId, tagId: tagId(ORG, orgTag[t.key]) });
    }

    for (let i = 0; i < tasks.length; i += 200) await tx.insert(s.tasks).values(tasks.slice(i, i + 200));
    for (let i = 0; i < commits.length; i += 200) await tx.insert(s.commits).values(commits.slice(i, i + 200));
    await tx.insert(s.taskTags).values(taskTags);
    await tx.insert(s.commitTags).values(commitTags);

    // -------------------------------------------------------------- objectives
    await tx.insert(s.objectives).values([
      { id: "seed-obj-ml", workspaceId: P, ownerId: PARTH.id, name: "Learn machine learning", currentValue: 17, targetValue: 42, unit: "modules", startAt: ist(45, 9), deadlineAt: ist(-64, 23) },
      { id: "seed-obj-paper", workspaceId: P, ownerId: PARTH.id, name: "Submit Research Paper 03", currentValue: 3, targetValue: 8, unit: "sections", startAt: ist(30, 9), deadlineAt: ist(-21, 23) },
      { id: "seed-obj-relaydb", workspaceId: ORG, ownerId: AARAV.id, name: "Ship RelayDB 0.4", currentValue: 23, targetValue: 40, unit: "tasks", startAt: ist(40, 9), deadlineAt: ist(-30, 23) },
    ]);
    await tx.insert(s.objectiveProjects).values([
      { objectiveId: "seed-obj-paper", projectId: projectId.research },
      { objectiveId: "seed-obj-relaydb", projectId: projectId["o-relaydb"] },
    ]);

    // -------------------------------------------------------------- notifications
    await tx.insert(s.notifications).values([
      { userId: PARTH.id, type: "task.overdue", targetType: "task", metadata: { title: "Finish OS chapter 8" }, createdAt: minutesAgo(90) },
      { userId: PARTH.id, type: "task.assigned", targetType: "task", metadata: { title: "Range scan iterator", by: "Aarav Kulkarni" }, createdAt: minutesAgo(300) },
      { userId: PARTH.id, type: "project.status_changed", targetType: "project", metadata: { title: "Research Paper 03", status: "paused" }, createdAt: minutesAgo(60 * 26), readAt: minutesAgo(60 * 20) },
    ]);

    console.log(`Seeded ${USERS.length} users, ${projects.length} projects, ${tasks.length} tasks, ${commits.length} commits.`);
  });

  console.log(`\nSign in at /login\n  email:    ${PARTH.email}\n  password: ${PASSWORD}`);
  console.log(`Teammates (same password): ${AARAV.email}, ${ISHITA.email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
