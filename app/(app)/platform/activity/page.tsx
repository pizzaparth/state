import * as React from "react";
import { getCommits, getDailyExecution, getEligibleDays } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate, formatNumber } from "@/lib/format";
import { EmptyState, Measure, PageHeader, Panel, SegmentedLinks } from "@/components/app/primitives";
import { ExecutionGraph } from "@/components/app/execution-graph";
import { CommitLedger } from "@/components/app/commit-ledger";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Activity" };

const RANGES = { "30d": 30, "90d": 91, "6m": 182, "1y": 371 } as const;
type RangeKey = keyof typeof RANGES;

export default async function ActivityPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const range: RangeKey = params.range && params.range in RANGES ? (params.range as RangeKey) : "90d";
  const viewer = await getViewer();
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id };
  const [days, recent, eligible] = await Promise.all([
    getDailyExecution(scope, viewer.tz, RANGES[range]),
    getCommits(scope, { sinceDays: 7, tz: viewer.tz }),
    getEligibleDays(scope, viewer.tz, RANGES[range]),
  ]);

  const execution = days.reduce((s, d) => s + d.execution, 0);
  const commits = days.reduce((s, d) => s + d.commits, 0);
  const active = days.filter((d) => d.commits > 0).length;
  const best = days.reduce((a, b) => (b.execution > a.execution ? b : a), days[0]);

  return (
    <>
      <PageHeader
        label="Execution"
        title="Activity"
        actions={
          <SegmentedLinks
            label="Range"
            items={(Object.keys(RANGES) as RangeKey[]).map((key) => ({ href: `/platform/activity?range=${key}`, label: key.toUpperCase(), active: key === range }))}
          />
        }
      />

      <Panel title="Execution graph" aside={`${RANGES[range]} days`}>
        <ExecutionGraph days={days} weekStart={viewer.preferences.weekStart} />
      </Panel>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure label="Execution" value={formatNumber(execution)} formula="Σ commits" />
        <Measure label="Commits" value={formatNumber(commits)} formula="tasks + manual" />
        <Measure label="Active days" value={`${active}/${eligible}`} formula="days with ≥1 commit ÷ eligible days" />
        <Measure label="Highest day" value={formatNumber(best?.execution ?? 0)} formula={best?.execution ? `on ${formatDate(new Date(`${best.day}T12:00:00Z`), "UTC", { weekday: "short", day: "numeric", month: "short" })}` : "No execution in range"} />
      </div>

      <Panel title="Last 7 days" aside={`${recent.length} commits`}>
        {recent.length === 0 ? (
          <EmptyState title="Quiet week" />
        ) : (
          <div className="-mx-3">
            <CommitLedger commits={recent} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam("/platform/activity", params, "commit", id)} />
          </div>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}
