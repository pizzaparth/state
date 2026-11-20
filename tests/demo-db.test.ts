import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The demo runs db/queries and lib/mutations on PGlite in the browser. Here they run on
// PGlite in Node, against the same migrations and seed, to catch SQL that Neon accepts
// and PGlite does not, and transactions that would deadlock on PGlite's single connection.
vi.mock("#db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/db/schema");
  return { db: drizzle({ client: new PGlite({ extensions: { pg_trgm } }), schema }) };
});

const { setupDemo } = await import("@/lib/demo/setup");
const q = await import("@/db/queries");
const m = await import("@/lib/mutations");
const { loadActor } = await import("@/lib/authz");
const { buildExport } = await import("@/lib/data/export");
const { loadViewerData } = await import("@/lib/viewer-data");
const { DEMO_MIGRATIONS } = await import("@/lib/demo/db/migrations.generated");
const { PGLITE_VERSION } = await import("@/lib/demo/db/assets");
const { demoMigrations } = await import("../scripts/gen-demo-migrations.mjs");

const TZ = "Asia/Kolkata";
let userId: string;

beforeAll(async () => {
  ({ userId } = await setupDemo("test", TZ));
}, 60_000);

describe("demo database", () => {
  it("bundles every migration and the installed PGlite version", () => {
    expect(DEMO_MIGRATIONS).toEqual(demoMigrations());
    expect(JSON.parse(readFileSync("node_modules/@electric-sql/pglite/package.json", "utf8")).version).toBe(PGLITE_VERSION);
  });

  it("setup is idempotent", async () => {
    expect(await setupDemo("test", TZ)).toEqual({ userId, changed: false });
  });

  it("reads every page's data", async () => {
    const viewer = (await loadViewerData(userId, "en-GB"))!;
    expect(viewer.isDemo).toBe(true);
    const scope = { workspaceIds: viewer.workspaceIds, userId };
    const today = await q.getToday(scope, TZ);
    expect(today.active.length).toBeGreaterThan(0);
    const metrics = await q.getMetrics(scope, TZ, 30);
    expect(metrics.execution).toBeGreaterThan(0);
    const series = await q.getMetricSeries(scope, TZ, 30);
    expect(series.history.length).toBeGreaterThan(0);
    expect(await q.getEligibleDays(scope, TZ, 30)).toBeGreaterThan(0);
    const board = await q.getBoard(viewer.personalBoardId!, viewer.workspaceIds);
    expect(board?.columns.length).toBe(3);
    expect((await q.getInbox(viewer.personalWorkspaceId)).length).toBe(3);
    expect((await q.getProjects(viewer.workspaceIds, TZ)).length).toBe(4);
    expect((await q.searchWork("thesis", viewer.workspaceIds)).length).toBeGreaterThan(0);
    expect((await q.getCommits(scope, { tz: TZ, limit: 10 })).length).toBe(10);
    expect((await q.getObjectives(viewer.workspaceIds)).length).toBe(2);
    expect((await buildExport(userId)).tasks.length).toBeGreaterThan(0);
  });

  it("writes: capture, move to Done (auto commit), manual commit, withdraw", async () => {
    const actor = await loadActor(userId);
    const viewer = (await loadViewerData(userId, "en-GB"))!;
    const before = (await q.getTicker({ workspaceIds: viewer.workspaceIds, userId }, TZ)).today;
    const card = await m.addBoardTask(actor, { columnId: (await q.getBoardColumns(viewer.personalBoardId!, viewer.workspaceIds))[0].id, title: "Write the abstract", weight: 4 });
    const done = await m.completeTask(actor, { taskId: card.id });
    expect(done.committed).toBe(4);
    const commit = await m.createManualCommit(actor, { message: "Reviewed notes", projectId: null, weight: 2 });
    expect((await q.getTicker({ workspaceIds: viewer.workspaceIds, userId }, TZ)).today).toBe(before + 6);
    await m.withdrawCommit(actor, { commitId: commit.id });
    expect((await q.getTicker({ workspaceIds: viewer.workspaceIds, userId }, TZ)).today).toBe(before + 4);
    await m.captureTask(actor, { text: "Plan next week #thesis !high +2" });
    expect((await q.getInbox(viewer.personalWorkspaceId)).length).toBe(4);
  });
});
