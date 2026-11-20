import type { PageDef, PageName } from "@/lib/pages/types";
import index from "./index";
import today from "./today";
import inbox from "./inbox";
import board from "./board";
import activity from "./activity";
import history from "./history";
import review from "./review";
import metrics from "./metrics";
import projects from "./projects";
import project from "./project";
import start from "./start";
import settingsAccount from "./settings-account";
import settingsPreferences from "./settings-preferences";
import settingsTags from "./settings-tags";

/** Every product page, for the server renderer (lib/pages/render.tsx). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PAGES: Record<PageName, PageDef<any>> = {
  index,
  today,
  inbox,
  board,
  activity,
  history,
  review,
  metrics,
  projects,
  project,
  start,
  "settings-account": settingsAccount,
  "settings-preferences": settingsPreferences,
  "settings-tags": settingsTags,
};
