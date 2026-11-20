import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_LOCALE, setRequestLocale } from "@/lib/locale";
import { localeFromHeader } from "@/lib/preferences";
import { loadViewerData, type Viewer } from "@/lib/viewer-data";

export type { Viewer } from "@/lib/viewer-data";

/** The signed-in user and the workspaces they can access, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSession();
  if (!session) redirect("/login");
  const viewer = await loadViewerData(session.user.id, localeFromHeader((await headers()).get("accept-language")) ?? DEFAULT_LOCALE);
  if (!viewer) redirect("/login");
  setRequestLocale(viewer.locale);
  return viewer;
});
