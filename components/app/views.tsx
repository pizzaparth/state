import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getDailyExecution, getMetrics, getObjectives, getOpenTasks, type Scope } from "@/db/queries";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { calculateCompletionRate, calculateConsistency, mean, objectivePosition, percentile } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { CycleHistogram, Distribution, VelocityBars } from "./charts";
import { CommitLedger } from "./commit-ledger";
import { ExecutionGraph } from "./execution-graph";
import { Chip, EmptyState, Measure, Panel, ProgressRail, SegmentedLinks } from "./primitives";
import { TaskRow } from "./task-row";

export const PERIODS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type PeriodKey = keyof typeof PERIODS;
export const toPeriod = (value: string | undefined): PeriodKey => (value && value in PERIODS ? (value as PeriodKey) : "30d");

/** Metrics surface shared by personal and organisation metrics. Every value shows its formula. */
export async function MetricsView({
  scope,
  tz,
  period,
  basePath,
  objectiveWorkspaceIds,
}: {
  scope: Scope;
  tz: string;
  period: PeriodKey;
  basePath: string;
  objectiveWorkspaceIds: string[];
}) {
  const days = PERIODS[period];
  const [m, objectives] = await Promise.all([getMetrics(scope, tz, days), getObjectives(objectiveWorkspaceIds)]);
  const now = new Date();

  const velocity = m.execution / days;
  const throughput = m.tasksCompleted / days;
  const completion = calculateCompletionRate(m.plannedCompleted, m.plannedTasks);
  const consistency = calculateConsistency(m.activeDays, days);
  const median = percentile(m.cycleTimesMs, 50);
  const avg = mean(m.cycleTimesMs);
  const p75 = percentile(m.cycleTimesMs, 75);
  const delta = m.previousExecution > 0 ? ((m.execution - m.previousExecution) / m.previousExecution) * 100 : null;

  return (
    <>
      <SegmentedLinks
        label="Period"
        items={Object.keys(PERIODS).map((key) => ({ href: `${basePath}?period=${key}`, label: key.toUpperCase(), active: key === period }))}
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure
          inverse
          label={`Execution / ${days}d`}
          value={formatNumber(m.execution)}
          formula="Σ task weights + manual commit weights"
          delta={
            delta === null ? (
              <span className="text-[#55554F]">No previous period to compare</span>
            ) : (
              <span className="text-[#2A2A27]">
                {delta >= 0 ? "+" : "−"}
                {formatNumber(Math.abs(delta), 1)}% vs previous {days}d ({m.previousExecution})
              </span>
            )
          }
        />
        <Measure label="Velocity" value={formatNumber(velocity, 2)} unit="/ day" formula={`${m.execution} execution ÷ ${days} days`} />
        <Measure label="Throughput" value={formatNumber(throughput, 2)} unit="tasks / day" formula={`${m.tasksCompleted} completed ÷ ${days} days`} />
        <Measure
          label="Completion"
          value={m.plannedTasks ? `${formatNumber(completion, 1)}%` : "—"}
          formula={`${m.plannedCompleted} of ${m.plannedTasks} tasks created in period are done`}
        />
        <Measure label="Median cycle time" value={formatDuration(median)} formula="median(completed_at − started_at)" />
        <Measure label="Consistency" value={`${formatNumber(consistency)}%`} formula={`${m.activeDays} active days ÷ ${days} days`} />
        <Measure label="Commits" value={formatNumber(m.commits)} formula="Task completions + manual commits" />
        <Measure label="Tasks completed" value={formatNumber(m.tasksCompleted)} formula="Tasks that reached Done in period" />
      </div>

      <Panel title="Daily execution" aside={`Mean ${formatNumber(velocity, 1)} per day`}>
        <VelocityBars days={m.daily} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Cycle time" aside={`${m.cycleTimesMs.length} tasks`}>
          <dl className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["Median", median],
              ["Average", avg],
              ["75th pct", p75],
            ].map(([label, v]) => (
              <div key={label as string} className="app-field rounded-[14px] px-3 py-2.5">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{label as string}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{formatDuration(v as number | null)}</dd>
              </div>
            ))}
          </dl>
          <CycleHistogram durationsMs={m.cycleTimesMs} />
        </Panel>
        <Panel title="Project distribution" aside="Share of execution">
          <Distribution rows={m.byProject} />
        </Panel>
      </div>

      {objectives.length > 0 && (
        <Panel title="Objectives">
          <ul className="divide-y divide-white/[0.08]">
            {objectives.map((o) => {
              const pos = objectivePosition(o, now);
              return (
                <li key={o.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.name}</p>
                    <p className="mt-0.5 text-sm text-[#85857F] tabular-nums">
                      {formatNumber(o.currentValue)} / {formatNumber(o.targetValue)} {o.unit}
                      {o.deadlineAt && `, due ${formatDate(o.deadlineAt, tz, { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                    <div className="mt-2.5">
                      <ProgressRail value={o.currentValue} max={o.targetValue} label={`${o.name} progress`} />
                    </div>
                  </div>
                  <p className="font-mono text-sm leading-relaxed tabular-nums text-[#9A9A96]">
                    velocity {formatNumber(pos.velocity, 2)}/d
                    <br />
                    required {pos.required === null ? "—" : pos.required === Infinity ? "past deadline" : `${formatNumber(pos.required, 2)}/d`}
                  </p>
                  <span
                    className={cn(
                      "justify-self-start rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] md:justify-self-end",
                      pos.status === "behind" ? "app-inverse" : "app-field text-[#D4D4D0]"
                    )}
                  >
                    {pos.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

/** Project page shared by personal and organisation projects. */
export async function ProjectView({
  project,
  scope,
  tz,
  taskHref,
  commitHref,
  showPeople,
}: {
  project: { id: string; name: string; status: string; description: string | null };
  scope: Scope;
  tz: string;
  taskHref: (id: string) => string;
  commitHref: (id: string) => string;
  showPeople: boolean;
}) {
  const projectScope = { ...scope, projectId: project.id };
  const [daily, recent, open] = await Promise.all([
    getDailyExecution(projectScope, tz, 91),
    getCommits(projectScope, { limit: 12 }),
    getOpenTasks(projectScope),
  ]);
  const now = new Date();
  const last30 = daily.slice(-30);
  const exec30 = last30.reduce((s, d) => s + d.execution, 0);
  const commits7 = daily.slice(-7).reduce((s, d) => s + d.commits, 0);
  const completed = daily.reduce((s, d) => s + d.tasks, 0);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure inverse label="Execution rate" value={formatNumber(exec30 / 30, 2)} unit="/ day" formula={`${exec30} execution ÷ 30 days`} />
        <Measure label="Open tasks" value={formatNumber(open.length)} formula="Not yet done" />
        <Measure label="Completed / 91d" value={formatNumber(completed)} formula="Task commits in the last 91 days" />
        <Measure label="Commits / 7d" value={formatNumber(commits7)} formula="All commits in the last 7 days" />
      </div>

      <Panel title="Execution graph" aside="Last 13 weeks">
        <ExecutionGraph days={daily} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Open tasks" aside={`${open.length}`}>
          {open.length === 0 ? (
            <EmptyState title="Nothing open">Every task in {project.name} is done.</EmptyState>
          ) : (
            <ul className="-mx-3">
              {open.map((t) => (
                <TaskRow key={t.id} task={t} tz={tz} now={now} href={taskHref(t.id)} showAssignee={showPeople} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent commits">
          {recent.length === 0 ? (
            <EmptyState title="No commits yet">Complete a task in {project.name} to start its history.</EmptyState>
          ) : (
            <div className="-mx-3">
              <CommitLedger commits={recent} tz={tz} now={now} hrefFor={commitHref} showAuthor={showPeople} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

const STATUS_ORDER = ["active", "planned", "paused", "completed", "archived"];

/** Flat project table (Level 0 rows inside a Level 1 panel). */
export function ProjectTable({
  projects,
  hrefFor,
  tz,
}: {
  projects: { id: string; name: string; slug: string; status: string; openTasks: number; completedTasks: number; commits7d: number; execution30d: number; lastCommitAt: Date | null }[];
  hrefFor: (slug: string) => string;
  tz: string;
}) {
  if (projects.length === 0) return <EmptyState title="No projects">Projects group related tasks and give them their own history.</EmptyState>;
  const sorted = [...projects].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-base">
        <thead>
          <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">
            <th scope="col" className="px-2 pb-2 font-semibold">Project</th>
            <th scope="col" className="px-2 pb-2 font-semibold">Status</th>
            <th scope="col" className="px-2 pb-2 text-right font-semibold">Open</th>
            <th scope="col" className="px-2 pb-2 text-right font-semibold">Done</th>
            <th scope="col" className="px-2 pb-2 text-right font-semibold">Commits 7d</th>
            <th scope="col" className="px-2 pb-2 text-right font-semibold">Execution 30d</th>
            <th scope="col" className="px-2 pb-2 text-right font-semibold">Last commit</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-t border-white/[0.08] transition-colors hover:bg-white/[0.03]">
              <th scope="row" className="px-2 py-3 text-left font-medium">
                <Link href={hrefFor(p.slug) as Route} className="rounded-[6px] hover:underline">
                  {p.name}
                </Link>
              </th>
              <td className="px-2 py-3">
                <Chip>{p.status}</Chip>
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{p.openTasks}</td>
              <td className="px-2 py-3 text-right tabular-nums">{p.completedTasks}</td>
              <td className="px-2 py-3 text-right tabular-nums">{p.commits7d}</td>
              <td className="px-2 py-3 text-right font-semibold tabular-nums">{p.execution30d}</td>
              <td className="px-2 py-3 text-right text-[#9A9A96] tabular-nums">{p.lastCommitAt ? formatDate(p.lastCommitAt, tz) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shown on an archived project's page: what archiving means and when it happened. */
export function ArchivedNotice({ archivedAt, tz }: { archivedAt: Date; tz: string }) {
  return (
    <p className="app-panel px-5 py-3 text-base text-[#9A9A96]">
      Archived {formatDate(archivedAt, tz, { day: "numeric", month: "short", year: "numeric" })}. Its history stays here, but it is not offered for{" "}
      <span className="font-mono">#capture</span> or new commits.
    </p>
  );
}

/** Compact list of archived projects under a workspace's active ones. */
export function ArchivedProjects({
  projects,
  hrefFor,
  tz,
}: {
  projects: { id: string; name: string; slug: string; archivedAt: Date | null }[];
  hrefFor: (slug: string) => string;
  tz: string;
}) {
  if (projects.length === 0) return null;
  return (
    <div className="mt-5 border-t border-white/[0.08] pt-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">Archived</h3>
      <ul className="mt-2">
        {projects.map((p) => (
          <li key={p.id} className="flex min-w-0 items-baseline justify-between gap-4 py-1.5 text-base">
            <Link href={hrefFor(p.slug) as Route} className="min-w-0 truncate rounded-[6px] text-[#9A9A96] hover:text-[#F2F2EF] hover:underline">
              {p.name}
            </Link>
            {p.archivedAt && <span className="shrink-0 text-sm tabular-nums text-[#85857F]">{formatDate(p.archivedAt, tz)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
