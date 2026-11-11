import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { CommitLedger } from "@/components/app/commit-ledger";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";
import { cn } from "@/lib/utils";

export const metadata = { title: "History" };

export default async function HistoryPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();

  const workspaceIds = viewer.workspaceIds;
  const userId = viewer.id;
  const projects = (await getProjects(workspaceIds)).map((p) => ({ ...p, label: p.name }));
  const project = projects.find((p) => p.id === params.project);
  const commits = await getCommits({ workspaceIds, userId, projectId: project?.id }, { limit: 250 });

  const projectHref = (id?: string) => {
    const q = new URLSearchParams();
    if (id) q.set("project", id);
    return `/platform/history${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader label="Ledger" title="History" />

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
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-[box-shadow,background-color,color]",
                  active ? "bg-accent text-accent-ink" : "app-btn text-[#9A9A96] hover:text-[#F2F2EF]"
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
      )}

      <Panel title="Your commits" aside={`${commits.length}${commits.length === 250 ? "+" : ""} shown`}>
        {commits.length === 0 ? (
          <EmptyState title="No commits yet" />
        ) : (
          <div className="-mx-3">
            <CommitLedger commits={commits} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam("/platform/history", params, "commit", id)} />
          </div>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}
