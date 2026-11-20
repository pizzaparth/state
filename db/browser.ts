import { drizzle } from "drizzle-orm/pglite";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { demoClient } from "@/lib/demo/db/client";
import * as schema from "./schema";

/**
 * `#db` in the browser (package.json "imports", "browser" condition): the demo's own
 * Postgres (PGlite), so db/queries and lib/mutations run in the visitor's browser with no
 * server or network. The server resolves `#db` to db/index.ts (Neon) instead.
 *
 * Typed as the server's driver: both are Drizzle PgDatabase with the same query API.
 */
export const db = drizzle({ client: demoClient, schema }) as unknown as NeonDatabase<typeof schema>;

export type DB = typeof db;
