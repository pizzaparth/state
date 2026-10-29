import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAccess } from "@/lib/billing/access";
import { getViewer } from "@/lib/viewer";
import { getInboxCount, getProjects, getTicker } from "@/db/queries";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/app/shell";

// Signed-in product pages never belong in search results
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Paid-only product: no session goes to sign in, never paid goes to checkout. A lapsed
  // or overdue plan keeps reading (and exporting); its writes are refused on the server.
  const session = await getSession();
  if (!session) redirect("/login");
  const { access, reason } = await getAccess(session.user.id);
  if (access === "none") redirect("/subscribe");

  const viewer = await getViewer();
  const [inboxCount, projects, ticker] = await Promise.all([
    getInboxCount(viewer.personalWorkspaceId),
    getProjects(viewer.workspaceIds),
    getTicker({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz),
  ]);
  const orgByWorkspace = new Map(viewer.orgs.map((o) => [o.workspaceId, o]));

  return (
    <AppShell
      data={{
        inboxCount,
        orgs: viewer.orgs.map((o) => ({ name: o.name, slug: o.slug })),
        projects: projects.map((p) => {
          const org = orgByWorkspace.get(p.workspaceId);
          return org
            ? { id: p.id, name: `${p.name} (${org.name})`, href: `/platform/org/${org.slug}/projects/${p.slug}` }
            : { id: p.id, name: p.name, href: `/platform/projects/${p.slug}` };
        }),
        dateLabel: formatDate(new Date(), viewer.tz, { weekday: "short", day: "numeric", month: "short" }),
        ticker,
        readOnly: access === "read_only" ? reason : null,
      }}
    >
      {children}
    </AppShell>
  );
}
