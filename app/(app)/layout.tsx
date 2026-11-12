import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getViewer, getViewerTicker } from "@/lib/viewer";
import { getInboxCount, getProjects } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/app/shell";

// Signed-in product pages never belong in search results
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Product pages render per request: the nonce CSP in middleware.ts needs a fresh nonce
  // on each response. Marketing and auth pages are prerendered (static CSP, next.config.ts).
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");

  const viewer = await getViewer();
  const [inboxCount, projects, ticker] = await Promise.all([
    getInboxCount(viewer.personalWorkspaceId),
    getProjects(viewer.workspaceIds),
    getViewerTicker(viewer),
  ]);

  return (
    <AppShell
      data={{
        inboxCount,
        projects: projects.map((p) => ({ id: p.id, name: p.name, href: `/platform/projects/${p.slug}` })),
        dateLabel: formatDate(new Date(), viewer.tz, { weekday: "short", day: "numeric", month: "short" }),
        ticker,
        demoUserId: viewer.isDemo ? viewer.id : null,
      }}
    >
      {children}
    </AppShell>
  );
}
