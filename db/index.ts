import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// WebSocket Pool (not neon-http) so db.transaction() works: task completion and its
// auto-generated commit must be written atomically. Uses the global WebSocket (Node 22+).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
