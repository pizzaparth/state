import { PGlite, type Extension } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { DEMO_DB_FAILED, PGLITE_ASSETS, demoFlushChannel } from "./assets";

/**
 * The demo's Postgres (PGlite), in a worker shared by every tab of the demo: PGliteWorker
 * elects one tab to run it and the others send their queries there, so two tabs never
 * write the same IndexedDB copy. Its files come from /pglite (scripts/copy-pglite.mjs)
 * because the bundler rewrites import.meta.url, where PGlite would look for them.
 */
const asset = (name: string) => new URL(`${PGLITE_ASSETS}/${name}`, self.location.origin);

const pgTrgm: Extension = { name: "pg_trgm", setup: async () => ({ bundlePath: asset("pg_trgm.tar.gz") }) };

/**
 * Only the tab elected to run Postgres (PGliteWorker's leader) gets here, so it alone
 * answers flush requests from the demo's tabs. pg.syncToFs() would only schedule a flush
 * under relaxed durability; the file system's own sync waits for it.
 */
function serveFlushes(pg: PGlite, dataDir: string) {
  const channel = new BroadcastChannel(demoFlushChannel(dataDir));
  channel.onmessage = async (event: MessageEvent<{ type?: string; id?: string }>) => {
    if (event.data?.type !== "flush") return;
    try {
      await (pg as unknown as { fs: { syncToFs: (relaxed: boolean) => Promise<void> } }).fs.syncToFs(false);
    } finally {
      channel.postMessage({ type: "flushed", id: event.data.id });
    }
  };
}

const ok = (r: Response) => {
  if (!r.ok) throw new Error(`${r.url} answered ${r.status}`);
  return r;
};

void worker({
  async init(options) {
    try {
      const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
        WebAssembly.compileStreaming(fetch(asset("pglite.wasm")).then(ok)),
        WebAssembly.compileStreaming(fetch(asset("initdb.wasm")).then(ok)),
        fetch(asset("pglite.data")).then(ok).then((r) => r.blob()),
      ]);
      // Relaxed: a query returns before its changes reach IndexedDB (a full pass over the
      // database's files, ~100 ms), which then happens in the background. Writes also ask
      // for a flush and wait for it (flushDemoDatabase), so every change survives a refresh;
      // reads no longer wait for a flush they do not need.
      const pg = new PGlite({ dataDir: options.dataDir, extensions: { pg_trgm: pgTrgm }, pgliteWasmModule, initdbWasmModule, fsBundle, relaxedDurability: true });
      await pg.waitReady;
      serveFlushes(pg, options.dataDir ?? "");
      return pg;
    } catch (error) {
      // PGliteWorker only logs this inside the worker; tell the page (lib/demo/db/client.ts)
      postMessage({ type: DEMO_DB_FAILED, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
});
