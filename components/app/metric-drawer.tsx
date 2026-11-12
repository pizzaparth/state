import * as React from "react";
import { getCommits, getDailyExecution, getMetrics, getObjectives, getTasksInWindow, type Scope } from "@/db/queries";
import { dayKey, formatDate, formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { calculateCompletionRate, calculateConsistency, calculateThroughput, calculateVelocity, objectivePosition, percentile } from "@/lib/metrics";
import { cumulative } from "@/lib/metrics/series";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "./detail-drawer";
import { PanelSection } from "./details";
import { CommitLedger } from "./commit-ledger";
import { EmptyState, DISPLAY, TICK } from "./primitives";
import { SeriesChart } from "./series-chart";
import type { MetricRange } from "./metrics-view";

export const METRIC_KEYS = ["execution", "velocity", "throughput", "completion", "cycle", "consistency", "commits", "tasks"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const TITLES: Record<MetricKey, string> = {
  execution: "Execution",
  velocity: "Velocity",
  throughput: "Throughput",
  completion: "Completion",
  cycle: "Cycle time",
  consistency: "Consistency",
  commits: "Commits",
  tasks: "Tasks done",
};

const LIST_LIMIT = 100;

/** The formula with its real numbers, written out. */
function Equation({ lines }: { lines: [string, string][] }) {
  return (
    <dl className="app-panel space-y-2 rounded-[20px] p-4 font-mono text-[14px] tabular-nums">
      {lines.map(([k, v], i) => (
        <div key={k} className={cn("flex items-baseline justify-between gap-4", i === lines.length - 1 && "border-t border-black/[0.08] pt-2 font-semibold")}>
          <dt className="text-[#52525B]">{k}</dt>
          <dd className={i === lines.length - 1 ? "text-accent" : "text-[#0A0A0A]"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * ?metric=<key>: one number explained. The formula filled in with the period's real
 * values, then the commits or tasks that produced it.
 */
export async function MetricDrawer({ metric, scope, tz, range, commitHref }: { metric: string; scope: Scope; tz: string; range: MetricRange; commitHref: (id: string) => string }) {
  if (!METRIC_KEYS.includes(metric as MetricKey)) return null;
  const key = metric as MetricKey;
  const m = await getMetrics(scope, tz, range.days, range.end);
  const span = `${formatDate(new Date(`${range.from}T12:00:00Z`), "UTC", { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(new Date(`${range.to}T12:00:00Z`), "UTC", { day: "numeric", month: "short", year: "numeric" })}`;
  const usesCommits = key === "execution" || key === "velocity" || key === "commits";
  const usesTasks = key === "throughput" || key === "tasks" || key === "cycle";
  const [commits, done, planned] = await Promise.all([
    usesCommits ? getCommits(scope, { tz, from: range.from, to: range.to, limit: LIST_LIMIT }) : [],
    usesTasks ? getTasksInWindow(scope, tz, range.from, range.to, "completed", LIST_LIMIT) : [],
    key === "completion" ? getTasksInWindow(scope, tz, range.from, range.to, "planned", LIST_LIMIT) : [],
  ]);

  const lines: [string, string][] =
    key === "execution"
      ? [["Σ task + manual weights", formatNumber(m.execution)], ["commits", formatNumber(m.commits)], ["Execution", formatNumber(m.execution)]]
      : key === "velocity"
        ? [["Execution", formatNumber(m.execution)], ["÷ days", formatNumber(range.days)], ["Velocity / day", formatNumber(calculateVelocity(m.execution, range.days), 2)]]
        : key === "throughput"
          ? [["Tasks reaching Done", formatNumber(m.tasksCompleted)], ["÷ days", formatNumber(range.days)], ["Throughput / day", formatNumber(calculateThroughput(m.tasksCompleted, range.days), 2)]]
          : key === "completion"
            ? [["Planned (created on the board)", formatNumber(m.plannedTasks)], ["of those done", formatNumber(m.plannedCompleted)], ["Completion", m.plannedTasks ? `${formatNumber(calculateCompletionRate(m.plannedCompleted, m.plannedTasks), 1)}%` : "—"]]
            : key === "cycle"
              ? [["Tasks done with a start", `${m.cycleTimesMs.length} of ${m.tasksCompleted}`], ["P75", formatDuration(percentile(m.cycleTimesMs, 75))], ["Median (done − started)", formatDuration(percentile(m.cycleTimesMs, 50))]]
              : key === "consistency"
                ? [["Days with ≥ 1 commit", formatNumber(m.activeDays)], ["÷ eligible days", formatNumber(m.eligibleDays)], ["Consistency", `${formatNumber(calculateConsistency(m.activeDays, m.eligibleDays))}%`]]
                : key === "commits"
                  ? [["From tasks", formatNumber(m.daily.reduce((s, d) => s + d.tasks, 0))], ["Manual and imported", formatNumber(m.commits - m.daily.reduce((s, d) => s + d.tasks, 0))], ["Commits", formatNumber(m.commits)]]
                  : [["Reached Done", formatNumber(m.tasksCompleted)], ["with a start", formatNumber(m.cycleTimesMs.length)], ["Tasks done", formatNumber(m.tasksCompleted)]];

  return (
    <DetailDrawer param="metric" title="Metric" crumbs={[TITLES[key]]}>
      <div className="app-stagger space-y-8">
        <div>
          <p className="mb-2 font-mono text-[13px] text-[#71717A]">{span}</p>
          <h2 className={cn(DISPLAY, "text-[1.75rem] leading-none")}>{TITLES[key]}</h2>
        </div>
        <Equation lines={lines} />
        {key === "consistency" && (
          <PanelSection title="Days" aside={`${m.activeDays} active`}>
            <ol className="grid grid-cols-7 gap-1 font-mono text-[11px] tabular-nums">
              {m.daily.slice(-m.eligibleDays).map((d) => (
                <li key={d.day} title={`${d.day}: ${d.commits} commits`} className={cn("rounded-[6px] px-1 py-1.5 text-center", d.commits > 0 ? "bg-accent text-white" : "app-field text-[#71717A]")}>
                  {d.day.slice(8)}
                </li>
              ))}
            </ol>
          </PanelSection>
        )}
        {usesCommits && (
          <PanelSection title="Commits counted" aside={`${commits.length}${commits.length === LIST_LIMIT ? "+" : ""}`}>
            {commits.length === 0 ? <EmptyState title="None" /> : <div className="-mx-3"><CommitLedger commits={commits} tz={tz} now={new Date()} hrefFor={commitHref} /></div>}
          </PanelSection>
        )}
        {(usesTasks || key === "completion") && (
          <PanelSection title={key === "completion" ? "Planned tasks" : "Tasks counted"} aside={`${(key === "completion" ? planned : done).length}`}>
            <ul className="divide-y divide-black/[0.05]">
              {(key === "completion" ? planned : done).map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{t.title}</span>
                    <span className="block font-mono text-[12px] text-[#71717A]">{[t.projectName, t.completedAt ? `done ${formatDateTime(t.completedAt, tz)}` : "open"].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-[#52525B]">
                    {key === "cycle" ? (t.startedAt && t.completedAt ? formatDuration(t.completedAt.getTime() - t.startedAt.getTime()) : "no start") : `+${t.weight}`}
                  </span>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </div>
    </DetailDrawer>
  );
}

/**
 * ?objective=<id>: burn-up (actual against the straight line from start to deadline),
 * required velocity and projected finish, all from objectivePosition.
 */
export async function ObjectiveDrawer({ objectiveId, workspaceIds, tz }: { objectiveId: string; workspaceIds: string[]; tz: string }) {
  const [live, archived] = await Promise.all([getObjectives(workspaceIds), getObjectives(workspaceIds, { archived: true })]);
  const o = [...live, ...archived].find((x) => x.id === objectiveId);
  if (!o) return null;
  const now = new Date();
  const pos = objectivePosition(o, now);
  const today = dayKey(now, tz);
  const start = dayKey(o.startAt, tz);
  const elapsed = Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1);
  const deadline = o.deadlineAt ? dayKey(o.deadlineAt, tz) : null;
  const totalDays = Math.min(730, Math.max(elapsed, deadline ? Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1 : elapsed));

  // Actual: daily execution since start (execution objectives), or start → now (hand-counted)
  let actual: (number | null)[];
  if (o.measure === "execution") {
    const daily = await getDailyExecution({ workspaceIds: [o.workspaceId], projectId: o.projectId ?? undefined }, tz, Math.min(elapsed, 730));
    const cum = cumulative(daily.map((d) => d.execution));
    actual = Array.from({ length: totalDays }, (_, i) => (i < cum.length ? Math.min(cum[i], o.currentValue) : null));
  } else {
    actual = Array.from({ length: totalDays }, (_, i) => (i === 0 ? 0 : i === Math.min(elapsed, totalDays) - 1 ? o.currentValue : null));
  }
  const ideal = deadline ? Array.from({ length: totalDays }, (_, i) => (o.targetValue * (i + 1)) / totalDays) : Array.from({ length: totalDays }, () => null);
  const dayAt = (i: number) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
  const labels = Array.from({ length: totalDays }, (_, i) => dayAt(i));
  const every = Math.max(1, Math.ceil(totalDays / 6));

  return (
    <DetailDrawer param="objective" title="Objective" crumbs={[o.projectName ?? "Workspace"]}>
      <div className="app-stagger space-y-8">
        <div>
          <p className={cn(TICK, "mb-2 text-[11px] text-[#71717A]")}>{pos.status}{pos.status === "overdue" ? ` · ${pos.daysOver}d past` : ""}</p>
          <h2 className={cn(DISPLAY, "text-[1.75rem] leading-none")}>{o.name}</h2>
          <p className="mt-2 font-mono text-[14px] tabular-nums text-[#52525B]">
            {formatNumber(o.currentValue)} / {formatNumber(o.targetValue)} {o.unit}
          </p>
        </div>
        <Equation
          lines={[
            ["velocity (since start)", `${formatNumber(pos.velocity, 2)}/d`],
            ["required", pos.required === null ? "no deadline" : pos.required === Infinity ? "past deadline" : `${formatNumber(pos.required, 2)}/d`],
            ["days left", pos.daysLeft === null ? "—" : formatNumber(pos.daysLeft, 0)],
            ["projected finish", pos.status === "completed" ? "done" : pos.projected ? formatDate(pos.projected, tz, { day: "numeric", month: "short", year: "numeric" }) : "—"],
          ]}
        />
        <PanelSection title="Burn-up" aside={deadline ? `to ${deadline}` : "no deadline"}>
          <SeriesChart
            title={`${o.name}: actual against the straight line to the target`}
            labels={labels}
            ticks={labels.map((l, i) => (i % every === 0 || i === totalDays - 1 ? l.slice(5) : ""))}
            series={[
              { label: "Actual", kind: "area", tone: "hi", values: actual },
              { label: "On pace", kind: "line", tone: "mid", dashed: true, values: ideal },
            ]}
          />
          {o.measure === "manual" && <p className="mt-2 font-mono text-[12px] text-[#71717A]">hand-counted: start and now only</p>}
        </PanelSection>
      </div>
    </DetailDrawer>
  );
}
