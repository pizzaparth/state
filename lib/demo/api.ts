import { eq } from "drizzle-orm";
import { db } from "#db";
import { users } from "@/db/schema";
import { searchWork, type SearchHit } from "@/db/queries";
import { loadActor, MutationError } from "@/lib/authz";
import { buildExportFile, type ExportQuery } from "@/lib/data/export";
import { parseImport } from "@/lib/data/import";
import { importData } from "@/lib/mutations";
import { IMPORT_LIMITS } from "@/lib/validation";
import { bumpDemoData, demoRuntime } from "./runtime";
import { flushDemoDatabase } from "./db/client";

/**
 * The demo's stand-ins for /api/search, /api/export and /api/import: the same queries,
 * validation and mutations, run on the demo's database in this browser. Loaded only in a
 * demo (command-palette.tsx, data-transfer.tsx).
 */

function requireDemo() {
  const demo = demoRuntime();
  if (!demo) throw new MutationError("unauthenticated", "The demo has ended.");
  return demo;
}

export async function demoSearch(q: string): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 2 || query.length > 100) return [];
  const actor = await loadActor(requireDemo().userId);
  return searchWork(query, [...actor.readable]);
}

export async function demoExport(query: ExportQuery) {
  return buildExportFile(requireDemo().userId, query);
}

type ImportBody = { error?: string; errors?: string[]; result?: Awaited<ReturnType<typeof importData>>; kind?: string };

export async function demoImport(text: string, contentType: string, dry: boolean): Promise<{ ok: boolean; body: ImportBody }> {
  try {
    const { userId } = requireDemo();
    if (new Blob([text]).size > IMPORT_LIMITS.bytes) return { ok: false, body: { error: "Files can be up to 4 MB." } };
    const [user] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
    const parsed = parseImport(text, { format: contentType.startsWith("text/plain") ? "txt" : undefined, tz: user?.tz });
    if (!parsed.ok) return { ok: false, body: { error: parsed.error, errors: parsed.errors } };
    const result = await importData(await loadActor(userId), parsed.data, { dryRun: dry });
    if (!dry) {
      await flushDemoDatabase();
      bumpDemoData();
    }
    return { ok: true, body: { kind: parsed.kind, result } };
  } catch (error) {
    if (error instanceof MutationError) return { ok: false, body: { error: error.message } };
    console.error("[demo import]", error);
    return { ok: false, body: { error: "Import failed. Nothing was saved." } };
  }
}
