import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { getViewer } from "@/lib/viewer";
import { getInboxCount, getProjects, getTicker } from "@/db/queries";
import { formatDate, initials } from "@/lib/format";
import { AppShell } from "@/components/app/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Paid-only product: no session goes to sign in, no paid subscription goes to checkout
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPaidAccess(session.user.id))) redirect("/subscribe");

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
        user: { name: viewer.name, email: viewer.email, initials: initials(viewer.name) },
        inboxCount,
        orgs: viewer.orgs.map((o) => ({ name: o.name, slug: o.slug })),
        projects: projects.map((p) => {
          const org = orgByWorkspace.get(p.workspaceId);
          return org
            ? { id: p.id, name: `${p.name} (${org.name})`, href: `/org/${org.slug}/projects/${p.slug}` }
            : { id: p.id, name: p.name, href: `/projects/${p.slug}` };
        }),
        dateLabel: formatDate(new Date(), viewer.tz, { weekday: "short", day: "numeric", month: "short" }),
        ticker,
      }}
    >
      {children}
    </AppShell>
  );
}
