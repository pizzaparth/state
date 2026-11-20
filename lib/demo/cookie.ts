/**
 * The demo's marker cookie: its id, set in the browser when a demo starts and cleared
 * when it ends. A browser-session cookie (no expiry). It grants nothing: the server only
 * uses it to send the demo's page shell instead of redirecting to /login, and every byte
 * of demo data lives in this browser (lib/demo/db/client.ts).
 */
export const DEMO_COOKIE = "state_demo";
const DEMO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isDemoId = (value: string | null | undefined): value is string => typeof value === "string" && DEMO_ID.test(value);

/** The demo id in a Cookie header, if any. */
export function demoIdFromCookieHeader(header: string | null | undefined): string | null {
  const value = header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${DEMO_COOKIE}=`))
    ?.slice(DEMO_COOKIE.length + 1);
  return isDemoId(value) ? value : null;
}
