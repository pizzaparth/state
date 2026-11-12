import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon, Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Neon's drivers cannot reach a plain Postgres server, so local development
// (localhost / 127.0.0.1) uses node-postgres. Every driver here supports db.transaction():
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

/**
 * Neon: queries go over HTTP, one request each, so a cold serverless instance opens no
 * WebSocket and pays no TLS or Postgres auth handshake per connection. HTTP has no
 * session for interactive transactions, so db.transaction() runs on a WebSocket pool
 * instead. That pool connects lazily, only when a transaction starts.
 */
function neonDb(url: string): NeonDatabase<typeof schema> {
  const http = drizzleNeonHttp({ client: neon(url), schema });
  const ws = drizzleNeon({ client: new NeonPool(pool), schema });
  // Same PgDatabase query API; typed as one driver so callers see a single type
  return Object.assign(http, { transaction: ws.transaction.bind(ws) }) as unknown as NeonDatabase<typeof schema>;
}

export const db: NeonDatabase<typeof schema> = isLocal(connectionString)
  ? (drizzlePg({ client: new PgPool(pool), schema }) as unknown as NeonDatabase<typeof schema>)
  : connectionString
    ? neonDb(connectionString)
    : // No URL (e.g. a build without env): fails on first query, as before
      drizzleNeon({ client: new NeonPool(pool), schema });

export type DB = typeof db;
