import { DEMO_COOKIE, demoIdFromCookieHeader } from "./cookie";
import { clearDemoTab, markDemoTab } from "./tab";

/**
 * A demo's lifetime, in the browser. Nothing about a demo reaches the server: its data is
 * a PGlite database in IndexedDB (lib/demo/db/client.ts), and the state_demo cookie only
 * tells the server to send the demo's page shell.
 *
 *   start      new id, cookie and tab marker; databases of earlier demos are deleted
 *   refresh    cookie and marker survive, so the database is reopened as it was
 *   tab close  the next visit finds no marker and no other tab of it, and ends it (DemoRoot)
 *   end        cookie, marker and database are deleted
 *
 * Light on purpose (the owner's bundle reaches it through SignOutButton); the database
 * module is loaded only when a demo actually closes one.
 */

const DB_PREFIX = "/pglite/state-demo-";

/** This browser's demo id, or null. */
export function readDemoId(): string | null {
  return typeof document === "undefined" ? null : demoIdFromCookieHeader(document.cookie);
}

function writeCookie(value: string, maxAge?: number) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${DEMO_COOKIE}=${value}; path=/; samesite=lax${maxAge === undefined ? "" : `; max-age=${maxAge}`}${secure}`;
}

/**
 * Asks the browser to delete a database, waiting at most a moment. While another tab
 * still has it open the delete stays queued and happens when that tab closes; a second
 * delete of the same database then waits behind the first without any event, so this
 * must never wait for completion.
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 500);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = done;
    } catch {
      done();
    }
  });
}

/** Deletes every demo database in this browser except `keep`. */
export async function purgeDemoDatabases(keep?: string): Promise<void> {
  try {
    const all = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    await Promise.all(all.map((d) => d.name).filter((n): n is string => Boolean(n?.startsWith(DB_PREFIX)) && n !== `${DB_PREFIX}${keep}`).map(deleteDatabase));
  } catch {
    // Storage unavailable: nothing to delete
  }
}

/** Starts a new demo in this tab and returns its id. */
export async function startDemo(): Promise<string> {
  await purgeDemoDatabases();
  const id = crypto.randomUUID();
  writeCookie(id);
  markDemoTab(id);
  return id;
}

/** Ends the demo: its cookie, tab marker and database are deleted. */
export async function endDemo(id: string | null = readDemoId()): Promise<void> {
  clearDemoTab();
  writeCookie("", 0);
  if (!id) return;
  const { closeDemoDatabase } = await import("./db/client");
  await closeDemoDatabase();
  await deleteDatabase(`${DB_PREFIX}${id}`);
}
