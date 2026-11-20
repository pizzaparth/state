import { getInboxCount, getRecentManualMessages, getShellProjects, getTagNames } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { loadViewerTicker, type Viewer } from "@/lib/viewer-data";
import type { ShellData } from "@/components/app/shell";

/** What the app shell shows around every page. Server (owner) and browser (demo). */
export async function loadShellData(viewer: Viewer, opts: { sidebarCollapsed: boolean; demoId: string | null }): Promise<ShellData> {
  const [inboxCount, projects, ticker, recentMessages, tagNames] = await Promise.all([
    getInboxCount(viewer.personalWorkspaceId),
    getShellProjects(viewer.workspaceIds),
    loadViewerTicker(viewer),
    getRecentManualMessages(viewer.id, viewer.workspaceIds),
    getTagNames(viewer.workspaceIds),
  ]);
  return {
    inboxCount,
    projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug, href: `/platform/projects/${p.slug}` })),
    dateLabel: formatDate(new Date(), viewer.tz, { weekday: "short", day: "numeric", month: "short" }),
    ticker,
    demoId: opts.demoId,
    tz: viewer.tz,
    sidebarCollapsed: opts.sidebarCollapsed,
    locale: viewer.locale,
    motion: viewer.preferences.motion,
    defaultWeight: viewer.preferences.defaultWeight,
    recentMessages,
    tagNames,
  };
}
