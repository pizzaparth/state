import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getDailyExecution, getMetrics, getOrgMembers } from "@/db/queries";
import { getViewerOrg } from "@/lib/viewer";
import { formatDuration, formatNumber, initials } from "@/lib/format";
import { percentile } from "@/lib/metrics";
import { Avatar, EmptyState, Measure, Panel } from "@/components/app/primitives";
import { ExecutionGraph } from "@/components/app/execution-graph";
import { CommitLedger } from "@/components/app/commit-ledger";
import { OrgHeader } from "@/components/app/org-header";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export default async function OrganisationOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const { viewer, org } = await getViewerOrg(orgSlug);
  const scope = { workspaceIds: [org.workspaceId] };
  const [daily, metrics, members, recent] = await Promise.all([
    getDailyExecution(scope, viewer.tz, 91),
    getMetrics(scope, viewer.tz, 30),
    getOrgMembers(org.id, org.workspaceId),
    getCommits(scope, { limit: 10 }),
  ]);
  const base = `/org/${org.slug}`;

  return (
    <>
      <title>{`${org.name} — State`}</title>
      <OrgHeader org={org} active="overview" />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure inverse label="Execution / 30d" value={formatNumber(metrics.execution)} formula="Σ team commit execution" />
        <Measure label="Commits / 30d" value={formatNumber(metrics.commits)} formula="Task completions + manual commits" />
        <Measure label="Projects touched" value={formatNumber(metrics.byProject.length)} formula="Projects with commits in 30 days" />
        <Measure label="Median cycle" value={formatDuration(percentile(metrics.cycleTimesMs, 50))} formula="median(completed_at − started_at)" />
      </div>

      <Panel title="Team execution graph" aside="Last 13 weeks">
        <ExecutionGraph days={daily} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Members" aside="Last 30 days, alphabetical">
          <ul className="divide-y divide-white/[0.08]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={m.name} initials={initials(m.name)} className="size-8 text-[13px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{m.name}</span>
                  <span className="block text-sm text-[#85857F]">{m.openTasks} open tasks</span>
                </span>
                <span className="text-right text-sm tabular-nums text-[#9A9A96]">
                  <span className="block font-semibold text-[#F2F2EF]">{m.execution30} execution</span>
                  {m.commits30} commits
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-[#9A9A96]">
            Shown for context, not as a ranking. Execution depends on the weights people choose and the work they were assigned.
          </p>
        </Panel>
        <Panel
          title="Recent team commits"
          aside={
            <Link href={`/history?scope=${org.slug}` as Route} className="underline-offset-2 hover:underline">
              Full history
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState title="No commits yet">Team commits appear here as tasks reach Done.</EmptyState>
          ) : (
            <div className="-mx-3">
              <CommitLedger commits={recent} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam(base, query, "commit", id)} showAuthor />
            </div>
          )}
        </Panel>
      </div>

      <Drawers params={query} viewer={viewer} />
    </>
  );
}
