"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { PAGE_MODULES } from "@/components/app/pages/client-registry";
import { PAGE_COOKIES, type PageDef, type PageName } from "@/lib/pages/types";
import { Fallback, ParentLink, fallbackPrimary } from "@/components/app/fallback";
import { ActivitySkeleton, BoardSkeleton, HistorySkeleton, InboxSkeleton, MetricsSkeleton, PageSkeleton, TodaySkeleton } from "@/components/app/skeletons";
import { browserLocale, useDemoViewer } from "./demo-root";

/**
 * One product page in a demo: the same load and View as the owner's page
 * (components/app/pages), run in the browser against the demo's database. Shows the
 * page's skeleton until the first load; later reloads keep the page on screen.
 */

const SKELETONS: Partial<Record<PageName, () => React.ReactNode>> = {
  today: () => <TodaySkeleton />,
  inbox: () => <InboxSkeleton />,
  board: () => <BoardSkeleton columns={3} />,
  activity: () => <ActivitySkeleton />,
  review: () => <ActivitySkeleton />,
  history: () => <HistorySkeleton />,
  metrics: () => <MetricsSkeleton />,
};

function pageCookies(): Record<string, string | undefined> {
  const jar = Object.fromEntries(document.cookie.split("; ").map((c) => [c.slice(0, c.indexOf("=")), c.slice(c.indexOf("=") + 1)]));
  return Object.fromEntries(PAGE_COOKIES.map((name) => [name, jar[name]]));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loaded = { kind: "page"; View: PageDef<any>["View"]; props: object } | { kind: "notFound" } | { kind: "error"; error: unknown };

export function DemoPage({ name, params, route, renderedAt }: { name: PageName; params: Record<string, string | undefined>; route: Record<string, string>; renderedAt: number }) {
  const viewer = useDemoViewer();
  const router = useRouter();
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const run = React.useRef(0);
  const key = JSON.stringify([params, route]);

  React.useEffect(() => {
    if (!viewer) return;
    const current = ++run.current;
    void (async () => {
      try {
        const def = (await PAGE_MODULES[name]()).default;
        const result = await def.load({ viewer, params: JSON.parse(key)[0], route: JSON.parse(key)[1], cookies: pageCookies(), browserLocale: browserLocale() });
        if (current !== run.current) return;
        if ("redirect" in result) router.replace(result.redirect as Route);
        else if ("notFound" in result) setLoaded({ kind: "notFound" });
        else setLoaded({ kind: "page", View: def.View, props: result.props });
      } catch (error) {
        if (current === run.current) setLoaded({ kind: "error", error });
      }
    })();
  }, [viewer, name, key, renderedAt, router]);

  // The product's error boundary (app/(app)/error.tsx) shows it
  if (loaded?.kind === "error") throw loaded.error;
  if (loaded?.kind === "notFound") {
    return (
      <Fallback label="404" title="Not found">
        <ParentLink />
        <Link href="/platform/today" className={fallbackPrimary}>
          Open Today
        </Link>
      </Fallback>
    );
  }
  if (!loaded) return <>{(SKELETONS[name] ?? (() => <PageSkeleton />))()}</>;
  const { View, props } = loaded;
  return <View {...props} />;
}
