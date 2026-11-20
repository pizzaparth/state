"use client";

import * as React from "react";
import { flushDemoDatabase, openDemoDatabase } from "@/lib/demo/db/client";
import { setupDemo } from "@/lib/demo/setup";
import { endDemo, readDemoId } from "@/lib/demo/local";
import { demoTabAlive, serveDemoTab } from "@/lib/demo/tab";
import { demoDataVersion, setDemoRuntime, subscribeDemoData } from "@/lib/demo/runtime";
import { loadViewerData, type Viewer } from "@/lib/viewer-data";
import { loadShellData } from "@/lib/shell-data";
import { DEFAULT_LOCALE } from "@/lib/locale";
import { localeFromHeader } from "@/lib/preferences";
import { AppShell, type ShellData } from "@/components/app/shell";
import { DemoStatus } from "./demo-status";

/**
 * The demo's app shell. The server sends this instead of loading anything (app/(app)/
 * layout.tsx): it opens the demo's database in this browser, builds it on first use
 * (lib/demo/setup.ts), then loads the shell from it. Pages inside load the same way
 * (DemoPage). Data reloads after every demo write and on router.refresh() (renderedAt).
 *
 * Tab lifetime (lib/demo/tab.ts): a tab that is not this demo's, with no other tab of it
 * still open, ends the demo before opening anything. A tab of the demo answers the
 * others from the start, so a second tab opened mid-boot joins instead of ending it.
 * Setup runs under a lock shared by the demo's tabs, so only one of them builds it.
 */

const DemoViewerContext = React.createContext<Viewer | null>(null);

/** The demo's viewer, for DemoPage. */
export const useDemoViewer = () => React.useContext(DemoViewerContext);

export const browserLocale = () => (typeof navigator === "undefined" ? null : localeFromHeader(navigator.languages?.join(",") || navigator.language));

type State = { status: "booting" } | { status: "failed" } | { status: "ready"; viewer: Viewer; shell: ShellData };

// A first boot downloads Postgres (about 4 MB compressed) and builds the demo; past this
// the open is stuck (a stale lock or connection left by a closed page): reload once
const BOOT_TIMEOUT_MS = 25_000;
const RETRIED = "state.demo.retried";
const retried = {
  get: () => {
    try {
      return sessionStorage.getItem(RETRIED) !== null;
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) sessionStorage.setItem(RETRIED, "1");
      else sessionStorage.removeItem(RETRIED);
    } catch {}
  },
};

export function DemoRoot({ children, sidebarCollapsed, renderedAt }: { children: React.ReactNode; sidebarCollapsed: boolean; renderedAt: number }) {
  const [state, setState] = React.useState<State>({ status: "booting" });
  const version = React.useSyncExternalStore(subscribeDemoData, demoDataVersion, () => 0);
  const demo = React.useRef<{ demoId: string; userId: string } | null>(null);

  // Answer "is this demo open?" for the demo's other tabs, for as long as this tab is open
  React.useEffect(() => {
    const demoId = readDemoId();
    return demoId ? serveDemoTab(demoId) : undefined;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!demo.current) {
          const demoId = readDemoId();
          // The demo cookie is gone (ended in another tab): start again
          if (!demoId) return window.location.replace("/demo");
          // Its tab was closed: the demo is over
          if (!(await demoTabAlive(demoId))) {
            await endDemo(demoId);
            return window.location.replace("/?demo=ended");
          }
          await openDemoDatabase(demoId);
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const setup = async () => {
            const { userId, changed } = await setupDemo(demoId, timezone);
            // A freshly built demo is stored before it is shown
            if (changed) await flushDemoDatabase();
            return userId;
          };
          const userId = navigator.locks ? await navigator.locks.request(`state-demo-setup-${demoId}`, setup) : await setup();
          demo.current = { demoId, userId };
          setDemoRuntime(demo.current);
        }
        const viewer = await loadViewerData(demo.current.userId, browserLocale() ?? DEFAULT_LOCALE);
        if (!viewer) throw new Error("demo account missing");
        const shell = await loadShellData(viewer, { sidebarCollapsed, demoId: demo.current.demoId });
        if (!cancelled) setState({ status: "ready", viewer, shell });
      } catch (error) {
        console.error("[demo] could not open the demo", error);
        if (!cancelled) setState((s) => (s.status === "ready" ? s : { status: "failed" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, renderedAt, sidebarCollapsed]);

  // Watchdog for a boot that never finishes: one automatic reload, then the failure screen
  React.useEffect(() => {
    if (state.status !== "booting") {
      if (state.status === "ready") retried.set(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (retried.get()) return setState({ status: "failed" });
      retried.set(true);
      window.location.reload();
    }, BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  if (state.status !== "ready") return <DemoStatus failed={state.status === "failed"} />;
  return (
    <DemoViewerContext.Provider value={state.viewer}>
      <AppShell data={state.shell}>{children}</AppShell>
    </DemoViewerContext.Provider>
  );
}
