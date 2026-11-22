"use client";

import * as React from "react";

/**
 * Works around a lost wake-up in the React that Next 15.5 bundles (19.2 canary). When a
 * navigation stays on the same page (?task=, ?range=, filters, tabs), the new page renders
 * inside the loading.tsx boundary that is already on screen, so React keeps the old page
 * and waits for the data. With a large page the data can arrive without React being told:
 * the update then sits there, finished but not shown, until something unrelated sets state.
 * To the viewer the side panel opens seconds late, or at their next hover.
 *
 * Any state update makes React retry what it was waiting for. So when a same-origin fetch
 * (a page's data or a Server Action) finishes, this leaf updates itself a few times. It
 * renders nothing. Remove it once Next ships a React without the bug; to check, open tasks
 * as the owner on a production build (a demo's pages are too small to show it).
 */
const DELAYS_MS = [0, 30, 100, 250, 600];

export function NavigationWake() {
  const [, wake] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    let timers: number[] = [];
    const observer = new PerformanceObserver((list) => {
      const origin = window.location.origin;
      if (!list.getEntriesByType("resource").some((e) => (e as PerformanceResourceTiming).initiatorType === "fetch" && e.name.startsWith(`${origin}/`))) return;
      timers.forEach(window.clearTimeout);
      timers = DELAYS_MS.map((ms) => window.setTimeout(wake, ms));
    });
    observer.observe({ type: "resource" });
    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, []);
  return null;
}
