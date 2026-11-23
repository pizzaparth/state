import type { PageDef, PageName } from "@/lib/pages/types";

/** Every product page, loaded on demand for the demo (components/app/demo/demo-page.tsx). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PAGE_MODULES: Record<PageName, () => Promise<{ default: PageDef<any> }>> = {
  index: () => import("./index"),
  today: () => import("./today"),
  inbox: () => import("./inbox"),
  board: () => import("./board"),
  activity: () => import("./activity"),
  history: () => import("./history"),
  review: () => import("./review"),
  metrics: () => import("./metrics"),
  work: () => import("./work"),
  start: () => import("./start"),
  "settings-account": () => import("./settings-account"),
  "settings-preferences": () => import("./settings-preferences"),
  "settings-tags": () => import("./settings-tags"),
};
