// Copies PGlite's WebAssembly, file-system bundle and the pg_trgm extension into
// public/pglite/<version>/ so the demo's database worker (lib/demo/db/worker.ts) can
// fetch them from this origin. Bundlers rewrite import.meta.url inside the worker, so
// PGlite cannot find its own files there. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules/@electric-sql/pglite/dist");
const { version } = JSON.parse(readFileSync(join(root, "node_modules/@electric-sql/pglite/package.json"), "utf8"));
const out = join(root, "public/pglite", version);

if (!existsSync(join(out, "pglite.wasm"))) {
  rmSync(join(root, "public/pglite"), { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const file of ["pglite.wasm", "pglite.data", "initdb.wasm", "pg_trgm.tar.gz"]) copyFileSync(join(dist, file), join(out, file));
}
console.log(`[pglite] assets ready at /pglite/${version}`);
