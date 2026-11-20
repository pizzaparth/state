/**
 * Where scripts/copy-pglite.mjs puts PGlite's files. Versioned, so browsers can cache
 * them for good. Must match the installed @electric-sql/pglite (tests/demo-db.test.ts).
 */
export const PGLITE_VERSION = "0.5.15";
export const PGLITE_ASSETS = `/pglite/${PGLITE_VERSION}`;

/** Message the database worker posts when Postgres cannot start. */
export const DEMO_DB_FAILED = "state-demo-db-failed";

/** BroadcastChannel on which the database's leader worker flushes to IndexedDB on request. */
export const demoFlushChannel = (dataDir: string) => `state-demo-flush:${dataDir}`;
