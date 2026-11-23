import type * as React from "react";
import type { Viewer } from "@/lib/viewer-data";
import { BOARD_SORT_COOKIE } from "@/lib/board-sort";
import { BOARD_FILTER_COOKIE } from "@/lib/board-filter";

/**
 * A product page split in two, so it renders in either place:
 *
 *   load   reads what the page shows (db/queries through `#db`)
 *   View   renders it, with no data access and nothing server-only
 *
 * The owner's pages run both on the server (lib/pages/render.tsx, Neon). A demo runs
 * both in the browser (components/app/demo/demo-page.tsx, PGlite). Page modules live in
 * components/app/pages/.
 */

export interface PageContext {
  viewer: Viewer;
  /** Search params (one value each). */
  params: Record<string, string | undefined>;
  /** Dynamic route segments, e.g. { workSlug }. */
  route: Record<string, string>;
  /** The page's preference cookies (PAGE_COOKIES). */
  cookies: Record<string, string | undefined>;
  /** Language the browser asks for, when the viewer saved none. */
  browserLocale: string | null;
}

export type PageResult<P> = { props: P } | { redirect: string } | { notFound: true };

export interface PageDef<P> {
  load: (ctx: PageContext) => Promise<PageResult<P>>;
  View: React.ComponentType<P>;
}

export function definePage<P>(def: PageDef<P>): PageDef<P> {
  return def;
}

export const PAGE_NAMES = [
  "index",
  "today",
  "inbox",
  "board",
  "activity",
  "history",
  "review",
  "metrics",
  "work",
  "start",
  "settings-account",
  "settings-preferences",
  "settings-tags",
] as const;
export type PageName = (typeof PAGE_NAMES)[number];

/**
 * Preference cookies pages read (board sort and filter, collapsed metric sections). Never
 * auth cookies. The last is METRICS_COLLAPSED_COOKIE, spelled out: it lives in a client
 * module, which server code cannot read a plain value from.
 */
export const PAGE_COOKIES = [BOARD_SORT_COOKIE, BOARD_FILTER_COOKIE, "metrics_collapsed"] as const;
