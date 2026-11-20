/**
 * Whether this browser tab is running the demo, and a change counter for its data.
 * Light on purpose: the owner's bundle imports it (app/(app)/client-actions.ts) and
 * never loads the demo's database code.
 *
 *   DemoRoot           marks the tab as a demo once its database is ready
 *   demo writes        bump the counter (lib/demo/actions.ts)
 *   DemoRoot/DemoPage  reload their data when it changes
 */

let demo: { demoId: string; userId: string } | null = null;

export function setDemoRuntime(next: { demoId: string; userId: string } | null) {
  demo = next;
}

/** The running demo, or null for the owner. */
export function demoRuntime(): { demoId: string; userId: string } | null {
  return demo;
}

let version = 0;
const listeners = new Set<() => void>();

/** Demo data changed: reload what is on screen. */
export function bumpDemoData() {
  version++;
  for (const listener of listeners) listener();
}

export function subscribeDemoData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const demoDataVersion = () => version;
