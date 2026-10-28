import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { EmptyState, PageHeader, Panel, SegmentedLinks } from "@/components/app/primitives";
import { CommitLedger } from "@/components/app/commit-ledger";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";
import { cn } from "@/lib/utils";

export const metadata = { title: "History — State" };

export default async function HistoryPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();

  // Scope: all of your commits, your personal workspace, or one organisation (whole team)
  const org = viewer.orgs.find((o) => o.slug === params.scope);
  const scopeKey = org ? org.slug : params.scope === "personal" ? "personal" : "all";
  const workspaceIds = org ? [org.workspaceId] : scopeKey === "personal" && viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : viewer.workspaceIds;
  const userId = org ? undefined : viewer.id;

  const orgNames = new Map(viewer.orgs.map((o) => [o.workspaceId, o.name]));
  const projects = (await getProjects(workspaceIds)).map((p) => ({
    ...p,
    label: orgNames.has(p.workspaceId) && !org ? `${p.name} (${orgNames.get(p.workspaceId)})` : p.name,
  }));
  const project = projects.find((p) => p.id === params.project);
  const commits = await getCommits({ workspaceIds, userId, projectId: project?.id }, { limit: 250 });

  const scopeHref = (scope: string) => (scope === "all" ? "/history" : `/history?scope=${scope}`);
  const projectHref = (id?: string) => {
    const q = new URLSearchParams();
    if (scopeKey !== "all") q.set("scope", scopeKey);
    if (id) q.set("project", id);
    return `/history${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        label="Execution ledger"
        title="History"
        description="Every commit, newest first. Commit times are permanent; select one to see the task behind it."
        actions={
          <SegmentedLinks
            label="Scope"
            items={[
              { href: scopeHref("all"), label: "Mine", active: scopeKey === "all" },
              { href: scopeHref("personal"), label: "Personal", active: scopeKey === "personal" },
              ...viewer.orgs.map((o) => ({ href: scopeHref(o.slug), label: o.name, active: scopeKey === o.slug })),
            ]}
          />
        }
      />

      {projects.length > 0 && (
        <nav aria-label="Filter by project" className="flex flex-wrap gap-2">
          {[{ id: undefined, label: "All projects" }, ...projects].map((p) => {
            const active = (p.id ?? null) === (project?.id ?? null);
            return (
              <Link
                key={p.id ?? "all"}
                href={projectHref(p.id) as Route}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-[box-shadow,background-color,color]",
                  active ? "neu-inset-sm text-[#171717]" : "neu-raised-sm text-[#5F5F5B] hover:text-[#171717]"
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
      )}

      <Panel title={org ? `${org.name} commits` : "Your commits"} aside={`${commits.length}${commits.length === 250 ? "+" : ""} shown`}>
        {commits.length === 0 ? (
          <EmptyState title="No commits">Complete a task or record a manual commit to begin your execution history.</EmptyState>
        ) : (
          <div className="-mx-3">
            <CommitLedger commits={commits} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam("/history", params, "commit", id)} showAuthor={Boolean(org)} />
          </div>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}
