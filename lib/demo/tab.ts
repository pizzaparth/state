/**
 * Tab marker for demo sessions. The demo's session cookie lives until the browser closes,
 * but a demo should end when its tab closes. sessionStorage survives a refresh and dies
 * with the tab, so it marks which demo this tab belongs to.
 *
 * A tab without the marker asks the other open tabs over a BroadcastChannel. If one of
 * them holds this demo (a link opened in a new tab), the new tab adopts the marker; if
 * none answers, the tab that ran the demo is gone and the demo ends.
 */
const KEY = "state.demo";
const CHANNEL = "state.demo";

export function markDemoTab(userId: string) {
  try {
    sessionStorage.setItem(KEY, userId);
  } catch {}
}

export function clearDemoTab() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

function readMarker(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Answers "is demo X open?" from other tabs while this tab holds X. Returns a cleanup. */
export function serveDemoTab(userId: string): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<{ type: string; userId: string }>) => {
    if (event.data?.type === "ping" && event.data.userId === userId && readMarker() === userId) channel.postMessage({ type: "pong", userId });
  };
  return () => channel.close();
}

/** True when this tab, or another open tab, holds the demo. Adopts the marker if so. */
export async function demoTabAlive(userId: string, waitMs = 400): Promise<boolean> {
  if (readMarker() === userId) return true;
  if (typeof BroadcastChannel === "undefined") return false;
  const channel = new BroadcastChannel(CHANNEL);
  const alive = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), waitMs);
    channel.onmessage = (event: MessageEvent<{ type: string; userId: string }>) => {
      if (event.data?.type === "pong" && event.data.userId === userId) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    channel.postMessage({ type: "ping", userId });
  });
  channel.close();
  if (alive) markDemoTab(userId);
  return alive;
}
