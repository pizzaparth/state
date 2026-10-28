import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Neon's WebSocket driver cannot reach a plain Postgres server, so local development
// (localhost / 127.0.0.1) uses node-postgres. Both drivers support db.transaction():
// task completion and its auto-generated commit must be written atomically.
function isLocal(url: string | undefined) {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Connections per server instance. Serverless deployments run many instances, so keep
// this small and point DATABASE_URL at Neon's pooled (-pooler) host, which multiplexes
// them onto a few Postgres connections.
const pool = {
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
};

export const db: NeonDatabase<typeof schema> = isLocal(connectionString)
  ? // Same PgDatabase query API; typed as one driver so callers see a single type
    (drizzlePg({ client: new PgPool(pool), schema }) as unknown as NeonDatabase<typeof schema>)
  : drizzleNeon({ client: new NeonPool(pool), schema });

export type DB = typeof db;
