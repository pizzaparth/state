import type { PGlite } from "@electric-sql/pglite";
import { PGliteWorker } from "@electric-sql/pglite/worker";
import { DEMO_DB_FAILED, demoFlushChannel } from "./assets";

/**
 * The browser's connection to the demo database: PGlite (Postgres compiled to
 * WebAssembly) in a worker, stored in IndexedDB as `/pglite/state-demo-<id>`. It survives a
 * refresh; lib/demo/local.ts deletes it when the demo ends.
 *
 * db/browser.ts builds the Drizzle client on top of `demoClient`, so the product's
 * queries and mutations run here unchanged. Queries wait until openDemoDatabase() runs.
 */

export const DEMO_DB_PREFIX = "state-demo-";

let opened: { id: string; pg: Promise<PGliteWorker> } | null = null;
let resolveFirst: (pg: PGliteWorker) => void;
const first = new Promise<PGliteWorker>((resolve) => {
  resolveFirst = resolve;
});

/**
 * Opens (or reuses) the demo's database. One demo per browser tab. Resolves once
 * Postgres answers a query, and rejects if the worker reports that it cannot start
 * (PGliteWorker itself reports "ready" before Postgres has started).
 */
export function openDemoDatabase(id: string): Promise<PGliteWorker> {
  if (opened?.id === id) return opened.pg;
  const worker = new Worker(new URL("./worker.ts", import.meta.url));
  const failed = new Promise<never>((_, reject) => {
    worker.addEventListener("message", (event: MessageEvent<{ type?: string; message?: string }>) => {
      if (event.data?.type === DEMO_DB_FAILED) reject(new Error(`demo database: ${event.data.message}`));
    });
  });
  const pg = PGliteWorker.create(worker, { dataDir: `idb://${DEMO_DB_PREFIX}${id}`, id: `${DEMO_DB_PREFIX}${id}` }).then(async (client) => {
    await Promise.race([client.query("select 1"), failed]);
    return client;
  });
  opened = { id, pg };
  void pg.then(resolveFirst, () => {
    if (opened?.pg === pg) opened = null;
  });
  return pg;
}

/** Closes the open database, if any (before deleting it). */
export async function closeDemoDatabase(): Promise<void> {
  const current = opened;
  opened = null;
  if (current) await (await current.pg).close().catch(() => undefined);
}

const ready = () => opened?.pg ?? first;

const FLUSH_TIMEOUT_MS = 5_000;

/**
 * Waits until every change so far is stored in IndexedDB: writes call this before
 * reporting success. Asks the tab running Postgres (lib/demo/db/worker.ts), which may be
 * another tab of the demo; never waits longer than a few seconds.
 */
export async function flushDemoDatabase(): Promise<void> {
  const current = opened;
  if (!current) return;
  await current.pg;
  const channel = new BroadcastChannel(demoFlushChannel(`idb://${DEMO_DB_PREFIX}${current.id}`));
  const id = crypto.randomUUID();
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      channel.close();
      resolve();
    };
    const timer = setTimeout(done, FLUSH_TIMEOUT_MS);
    channel.onmessage = (event: MessageEvent<{ type?: string; id?: string }>) => {
      if (event.data?.type === "flushed" && event.data.id === id) done();
    };
    channel.postMessage({ type: "flush", id });
  });
}

/** What Drizzle's PGlite driver calls (query, transaction), forwarded to the worker. */
export const demoClient = {
  query: (...args: Parameters<PGlite["query"]>) => ready().then((pg) => pg.query(...args)),
  transaction: <T>(fn: Parameters<PGlite["transaction"]>[0]) => ready().then((pg) => pg.transaction(fn) as Promise<T>),
  exec: (...args: Parameters<PGlite["exec"]>) => ready().then((pg) => pg.exec(...args)),
} as unknown as PGlite;
