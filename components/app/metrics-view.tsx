import * as React from "react";
import { getMetrics, getMetricSeries, getObjectives, type DailyExecution, type MetricSeries, type MetricsData, type Scope } from "@/db/queries";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { calculateCompletionRate, calculateConsistency, mean, objectivePosition, percentile } from "@/lib/metrics";
import { autocorrelation, byWeek, change, cumulative, drawdown, linearTrend, rollingMean, stdev, streaks, sum } from "@/lib/metrics/series";
import { weightLabel } from "@/lib/weights";
import { cn } from "@/lib/utils";
import { CycleHistogram, MixBar, StatGrid } from "./charts";
import { ExecutionGraph } from "./execution-graph";
import { EmptyState, Measure, Panel, ProgressRail, SegmentedLinks, TICK } from "./primitives";
import { ArchiveObjective, NewObjective, ObjectiveProgress } from "./objectives";
import { Punchcard, SeriesChart } from "./series-chart";

export const PERIODS = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "1y": 365 } as const;
export type PeriodKey = keyof typeof PERIODS;
export const toPeriod = (value: string | undefined): PeriodKey => (value && value in PERIODS ? (value as PeriodKey) : "30d");

const dayText = (key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
};
const longDay = (key: string) => dayText(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** About six evenly spaced axis labels, always including the last point. */
function spacedTicks(labels: string[], count = 6): string[] {
  const every = Math.max(1, Math.ceil(labels.length / count));
  return labels.map((l, i) => ((labels.length - 1 - i) % every === 0 ? l : ""));
}

const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${formatNumber(Math.abs(v), digits)}`;

/** ▲/▼ with percent: arrow and sign carry direction, never colour alone. */
function Delta({ pct, days, inverse }: { pct: number | null; days: number; inverse?: boolean }) {
  if (pct === null) return <span className={inverse ? "text-accent-muted" : "text-[#71717A]"}>no prior {days}d</span>;
  return (
    <span className={inverse ? "text-white" : "text-[#52525B]"}>
      {pct >= 0 ? "▲" : "▼"}
      {formatNumber(Math.abs(pct), 1)}% <span className={inverse ? "text-accent-muted" : "text-[#71717A]"}>vs prior {days}d</span>
    </span>
  );
}

const HISTOGRAM = [
  { label: "0", test: (v: number) => v === 0 },
  { label: "1–2", test: (v: number) => v >= 1 && v <= 2 },
  { label: "3–4", test: (v: number) => v >= 3 && v <= 4 },
  { label: "5–8", test: (v: number) => v >= 5 && v <= 8 },
  { label: "9–16", test: (v: number) => v >= 9 && v <= 16 },
  { label: "17+", test: (v: number) => v >= 17 },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Metrics surface. Every value shows its formula. */
export async function MetricsView({
  scope,
  tz,
  period,
  basePath,
  objectiveWorkspaceIds,
  objectiveControls = null,
}: {
  scope: Scope;
  tz: string;
  period: PeriodKey;
  basePath: string;
  objectiveWorkspaceIds: string[];
  /** Set when the viewer can create and update objectives in that workspace. */
  objectiveControls?: ObjectiveControls | null;
}) {
  const days = PERIODS[period];
  const [m, s, objectives] = await Promise.all([getMetrics(scope, tz, days), getMetricSeries(scope, tz, days), getObjectives(objectiveWorkspaceIds)]);
  return <MetricsReport metrics={m} series={s} objectives={objectives} objectiveControls={objectiveControls} tz={tz} period={period} basePath={basePath} />;
}

type Objective = Awaited<ReturnType<typeof getObjectives>>[number];

export interface ObjectiveControls {
  projects: { id: string; name: string }[];
}

/**
 * Renders already-loaded metrics. `basePath` null hides the period switch; `overview`
 * stops after the headline numbers, execution series and statistics (landing page).
 */
export function MetricsReport({
  metrics: m,
  series: s,
  objectives,
  objectiveControls = null,
  tz,
  period,
  basePath,
  overview = false,
}: {
  metrics: MetricsData;
  series: MetricSeries;
  objectives: Objective[];
  objectiveControls?: ObjectiveControls | null;
  tz: string;
  period: PeriodKey;
  basePath: string | null;
  overview?: boolean;
}) {
  const days = PERIODS[period];
  const now = new Date();

  // ---------------------------------------------------------------- series
  const history = s.history;
  const cur = history.slice(-days);
  const prev = history.slice(-2 * days, -days);
  const col = (rows: DailyExecution[], key: "execution" | "commits" | "tasks") => rows.map((d) => d[key]);
  const exec = col(cur, "execution");
  const prevExec = col(prev, "execution");
  const tail = <T,>(values: T[]) => values.slice(-days);
  // Smoothed spark: 7-day mean (raw days for the 7D period)
  const spark = (values: number[]) => (days <= 7 ? tail(values) : (tail(rollingMean(values, 7)) as number[]));

  const labels = cur.map((d) => longDay(d.day));
  const ticks = spacedTicks(cur.map((d) => dayText(d.day)));
  const sma7 = tail(rollingMean(col(history, "execution"), 7));
  const sma28 = tail(rollingMean(col(history, "execution"), 28));
  const trend = linearTrend(exec);
  const trendLine = trend ? exec.map((_, i) => trend.intercept + trend.slope * i) : exec.map(() => null);
  const rolling7Sum = rollingMean(col(history, "execution"), 7).map((v) => (v === null ? null : v * 7));
  const dd = tail(drawdown(rolling7Sum));
  const ddValues = dd.filter((v): v is number => v !== null);
  const maxDrawdown = ddValues.length ? Math.min(...ddValues) : 0;

  // ---------------------------------------------------------------- headline numbers
  const velocity = m.execution / days;
  const throughput = m.tasksCompleted / days;
  const completion = calculateCompletionRate(m.plannedCompleted, m.plannedTasks);
  const consistency = calculateConsistency(m.activeDays, m.eligibleDays);
  const prevActive = prev.filter((d) => d.commits > 0).length;
  const curStart = cur[0]?.day ?? "";
  const cycleCur = s.cycles.filter((c) => c.day >= curStart).map((c) => c.ms);
  const cyclePrev = s.cycles.filter((c) => c.day < curStart).map((c) => c.ms);
  const median = percentile(m.cycleTimesMs, 50);
  const priorMedian = percentile(cyclePrev, 50);
  const activeSeries = history.map((d) => (d.commits > 0 ? 100 : 0));

  // ---------------------------------------------------------------- statistics
  const avgDay = sum(exec) / days;
  const sd = stdev(exec);
  const { longest, current } = streaks(exec);
  const rho7 = autocorrelation(exec, 7);
  const rho1 = autocorrelation(exec, 1);
  const maxIndex = exec.indexOf(Math.max(...exec));
  const stats = [
    { label: "Mean / day", value: formatNumber(avgDay, 2), formula: "Σ execution ÷ days" },
    { label: "Median / day", value: formatNumber(percentile(exec, 50) ?? 0, 1), formula: "P50 of daily execution" },
    { label: "Std dev σ", value: sd === null ? "—" : formatNumber(sd, 2), formula: "√(Σ(x − x̄)² ÷ (n − 1))" },
    { label: "CV", value: sd === null || avgDay === 0 ? "—" : `${formatNumber((sd / avgDay) * 100)}%`, formula: "σ ÷ mean; lower = steadier" },
    { label: "P90 day", value: formatNumber(percentile(exec, 90) ?? 0), formula: "90th percentile day" },
    { label: "Peak day", value: exec[maxIndex] ? `+${exec[maxIndex]}` : "—", formula: exec[maxIndex] ? dayText(cur[maxIndex].day, { day: "numeric", month: "short", year: "numeric" }) : "max daily execution" },
    { label: "Zero days", value: formatNumber(exec.slice(-m.eligibleDays).filter((v) => v === 0).length), formula: `of ${m.eligibleDays} eligible days` },
    { label: "Streak", value: `${current}d`, formula: `current · longest ${longest}d` },
    { label: "Trend", value: trend ? `${signed(trend.slope, 2)}/d` : "—", formula: "OLS slope, execution per day" },
    { label: "Trend R²", value: trend ? formatNumber(trend.r2, 2) : "—", formula: "share of variance the trend explains" },
    { label: "ρ lag 1", value: rho1 === null ? "—" : formatNumber(rho1, 2), formula: "autocorrelation, day to next day" },
    { label: "ρ lag 7", value: rho7 === null ? "—" : formatNumber(rho7, 2), formula: "autocorrelation, weekly rhythm" },
  ];

  // ---------------------------------------------------------------- distributions
  const histogram = HISTOGRAM.map((b) => exec.filter(b.test).length);
  const weekdayTotals = WEEKDAYS.map(() => ({ execution: 0, n: 0 }));
  for (const d of cur) {
    const wd = (new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7;
    weekdayTotals[wd].execution += d.execution;
    weekdayTotals[wd].n++;
  }
  const weekdayMeans = weekdayTotals.map((w) => (w.n ? w.execution / w.n : 0));

  const weightParts = s.weights.map((w) => ({
    name: weightLabel(w.weight) === "Custom" ? `+${w.weight}` : `${weightLabel(w.weight)} +${w.weight}`,
    value: w.execution,
    detail: `${w.commits}×`,
  }));
  const taskCommits = sum(col(cur, "tasks"));
  const allCommits = sum(col(cur, "commits"));
  const sourceParts = [
    { name: "From tasks", value: taskCommits, detail: `${taskCommits}×` },
    { name: "Manual", value: allCommits - taskCommits, detail: `${allCommits - taskCommits}×` },
  ];

  // ---------------------------------------------------------------- weekly buckets
  const weeks = byWeek(cur).map((w) => {
    const execution = sum(w.days.map((d) => d.execution));
    return {
      week: w.week,
      span: w.days.length,
      execution,
      commits: sum(w.days.map((d) => d.commits)),
      tasks: sum(w.days.map((d) => d.tasks)),
      active: w.days.filter((d) => d.commits > 0).length,
      velocity: execution / w.days.length,
    };
  });
  const flowDaily = days <= 30;
  const flowRows = flowDaily
    ? s.flow.map((f) => ({ label: longDay(f.day), tick: dayText(f.day), created: f.created, completed: f.completed }))
    : byWeek(s.flow).map((w) => ({
        label: `Week of ${longDay(w.week)}`,
        tick: dayText(w.week),
        created: sum(w.days.map((d) => d.created)),
        completed: sum(w.days.map((d) => d.completed)),
      }));
  const created = sum(s.flow.map((f) => f.created));
  const completed = sum(s.flow.map((f) => f.completed));
  const cycleWeeks = byWeek(s.cycles.filter((c) => c.day >= curStart));
  const cycleByWeek = new Map(cycleWeeks.map((w) => [w.week, w.days.map((d) => d.ms)]));
  const cycleTrend = weeks.map((w) => {
    const ms = cycleByWeek.get(w.week) ?? [];
    return { label: `Week of ${longDay(w.week)}`, tick: dayText(w.week), median: percentile(ms, 50), p75: percentile(ms, 75), n: ms.length };
  });
  const toHours = (ms: number | null) => (ms === null ? null : ms / 3_600_000);

  const maxWeek = Math.max(1, ...weeks.map((w) => w.execution));
  const projectTotal = sum(s.projects.map((p) => p.execution));

  return (
    <>
      {basePath !== null && (
        <SegmentedLinks
          label="Period"
          items={Object.keys(PERIODS).map((key) => ({ href: `${basePath}?period=${key}`, label: key.toUpperCase(), active: key === period }))}
        />
      )}

      <div className="app-stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure
          inverse
          label={`Execution / ${days}d`}
          value={formatNumber(m.execution)}
          formula="Σ task + manual weights"
          spark={spark(col(history, "execution"))}
          delta={<Delta inverse pct={change(m.execution, m.previousExecution)} days={days} />}
        />
        <Measure
          label="Velocity"
          value={formatNumber(velocity, 2)}
          unit="/ day"
          formula={`${m.execution} ÷ ${days} days`}
          spark={spark(col(history, "execution"))}
          delta={<Delta pct={change(m.execution, m.previousExecution)} days={days} />}
        />
        <Measure
          label="Throughput"
          value={formatNumber(throughput, 2)}
          unit="tasks / day"
          formula={`${m.tasksCompleted} ÷ ${days} days`}
          spark={spark(col(history, "tasks"))}
          delta={<Delta pct={change(sum(col(cur, "tasks")), sum(col(prev, "tasks")))} days={days} />}
        />
        <Measure
          label="Completion"
          value={m.plannedTasks ? `${formatNumber(completion, 1)}%` : "—"}
          formula={`${m.plannedCompleted} ÷ ${m.plannedTasks} planned`}
        />
        <Measure
          label="Cycle time"
          value={formatDuration(median)}
          formula="median(done − started)"
          delta={<Delta pct={median === null || priorMedian === null ? null : change(median, priorMedian)} days={days} />}
        />
        <Measure
          label="Consistency"
          value={`${formatNumber(consistency)}%`}
          formula={`${m.activeDays} ÷ ${m.eligibleDays} eligible days`}
          spark={spark(activeSeries)}
          delta={<Delta pct={change(m.activeDays, prevActive)} days={days} />}
        />
        <Measure
          label="Commits"
          value={formatNumber(m.commits)}
          formula="tasks + manual"
          spark={spark(col(history, "commits"))}
          delta={<Delta pct={change(m.commits, sum(col(prev, "commits")))} days={days} />}
        />
        <Measure
          label="Tasks done"
          value={formatNumber(m.tasksCompleted)}
          formula="reached Done"
          spark={cumulative(col(cur, "tasks"))}
          delta={<Delta pct={change(sum(col(cur, "tasks")), sum(col(prev, "tasks")))} days={days} />}
        />
      </div>

      <Panel title="Execution series" aside={trend ? `trend ${signed(trend.slope, 2)}/d · R² ${formatNumber(trend.r2, 2)}` : undefined}>
        <SeriesChart
          title="Daily execution with 7-day moving average and linear trend"
          labels={labels}
          ticks={ticks}
          height={240}
          digits={1}
          series={[
            { label: "Daily", kind: "bar", tone: "mid", values: exec },
            { label: "SMA 7D", kind: "line", tone: "hi", values: sma7 },
            { label: "Trend", kind: "line", tone: "hi", dashed: true, values: trendLine },
          ]}
        />
      </Panel>

      {!overview && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Cumulative" aside={<Delta pct={change(sum(exec), sum(prevExec))} days={days} />}>
            <SeriesChart
              title="Running total of execution, this period against the prior period"
              labels={cur.map((d, i) => `Day ${i + 1} · ${dayText(d.day)}${prev[i] ? ` vs ${dayText(prev[i].day)}` : ""}`)}
              ticks={spacedTicks(cur.map((_, i) => `D${i + 1}`))}
              series={[
                { label: "This period", kind: "area", tone: "hi", values: cumulative(exec) },
                { label: "Prior period", kind: "line", tone: "mid", dashed: true, values: cumulative(prevExec) },
              ]}
            />
          </Panel>
          <Panel title="Rolling velocity" aside="per day">
            <SeriesChart
              title="7-day and 28-day rolling mean of daily execution"
              labels={labels}
              ticks={ticks}
              digits={2}
              series={[
                { label: "7D mean", kind: "line", tone: "hi", values: sma7 },
                { label: "28D mean", kind: "line", tone: "mid", dashed: true, values: sma28 },
              ]}
            />
          </Panel>
        </div>
      )}

      <Panel title="Statistics" aside={`n = ${days} days`}>
        <StatGrid stats={stats} />
      </Panel>

      {!overview && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Drawdown" aside={`max ${formatNumber(maxDrawdown, 1)}% · now ${formatNumber(dd.at(-1) ?? 0, 1)}%`}>
              <SeriesChart
                title="Rolling 7-day execution, percent below its running peak"
                labels={labels}
                ticks={ticks}
                unit="%"
                digits={1}
                series={[{ label: "From peak", kind: "area", tone: "mid", values: dd }]}
              />
              <p className="mt-2 font-mono text-[12px] text-[#71717A]">(Σ7D − peak) ÷ peak</p>
            </Panel>
            <Panel title="Day distribution" aside={`σ ${sd === null ? "—" : formatNumber(sd, 2)}`}>
              <SeriesChart
                title="Number of days by daily execution"
                labels={HISTOGRAM.map((b) => `${b.label} execution`)}
                ticks={HISTOGRAM.map((b) => b.label)}
                series={[{ label: "Days", kind: "bar", tone: "hi", values: histogram }]}
              />
              <p className="mt-2 font-mono text-[12px] text-[#71717A]">days per execution band</p>
            </Panel>
          </div>

          {days >= 30 && (
            <Panel title="Calendar" aside={`${m.activeDays}/${m.eligibleDays} active`}>
              <ExecutionGraph days={cur} />
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Weekday profile" aside={rho7 === null ? undefined : `ρ7 ${formatNumber(rho7, 2)}`}>
              <SeriesChart
                title="Mean execution by weekday"
                labels={WEEKDAYS.map((d, i) => `${d} (${weekdayTotals[i].n} days)`)}
                ticks={WEEKDAYS}
                digits={2}
                refs={[{ value: avgDay, label: `mean ${formatNumber(avgDay, 1)}` }]}
                series={[{ label: "Mean", kind: "bar", tone: "hi", values: weekdayMeans }]}
              />
            </Panel>
            <Panel title="Mix">
              <div className="space-y-6">
                <div>
                  <h3 className={cn(TICK, "mb-3 text-[#71717A]")}>By weight · Σ</h3>
                  <MixBar label="Execution by weight" parts={weightParts} />
                </div>
                <div>
                  <h3 className={cn(TICK, "mb-3 text-[#71717A]")}>By source · commits</h3>
                  <MixBar label="Commits by source" parts={sourceParts} />
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Commit hours" aside={`${allCommits} commits · local time`}>
            <Punchcard cells={s.punchcard} />
          </Panel>

          <Panel title="Flow" aside={`${created} in · ${completed} out · net ${signed(created - completed, 0)} open`}>
            <SeriesChart
              title={`Tasks created and completed per ${flowDaily ? "day" : "week"}`}
              labels={flowRows.map((r) => r.label)}
              ticks={spacedTicks(flowRows.map((r) => r.tick), 8)}
              series={[
                { label: "Created", kind: "bar", tone: "mid", values: flowRows.map((r) => r.created) },
                { label: "Completed", kind: "bar", tone: "hi", values: flowRows.map((r) => r.completed) },
              ]}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Cycle time" aside={`${m.cycleTimesMs.length} tasks`}>
              <dl className="mb-5 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Median", median],
                    ["Average", mean(m.cycleTimesMs)],
                    ["75th pct", percentile(m.cycleTimesMs, 75)],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="app-field rounded-[14px] px-3 py-2.5">
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{formatDuration(v)}</dd>
                  </div>
                ))}
              </dl>
              <CycleHistogram durationsMs={cycleCur} />
            </Panel>
            <Panel title="Cycle trend" aside="hours, weekly">
              <SeriesChart
                title="Weekly median and 75th percentile cycle time, in hours"
                labels={cycleTrend.map((w) => `${w.label} · ${w.n} tasks`)}
                ticks={spacedTicks(cycleTrend.map((w) => w.tick))}
                unit="h"
                digits={1}
                series={[
                  { label: "Median", kind: "line", tone: "hi", values: cycleTrend.map((w) => toHours(w.median)) },
                  { label: "P75", kind: "line", tone: "mid", dashed: true, values: cycleTrend.map((w) => toHours(w.p75)) },
                ]}
              />
            </Panel>
          </div>

          <Panel title="Weekly ledger" aside={`${weeks.length} weeks`}>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-base tabular-nums">
                <thead>
                  <tr className={cn(TICK, "text-left text-[#52525B]")}>
                    <th scope="col" className="px-2 pb-2 font-medium">Week</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Σ</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">WoW</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Commits</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Done</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Active</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Vel</th>
                    <th scope="col" className="w-[22%] px-2 pb-2 font-medium">
                      <span className="sr-only">Execution bar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...weeks].reverse().map((w, i, rows) => {
                    const before = rows[i + 1];
                    const wow = before ? change(w.execution / w.span, before.execution / before.span) : null;
                    return (
                      <tr key={w.week} className="border-t border-black/[0.05]">
                        <th scope="row" className="px-2 py-2.5 text-left font-medium">
                          {dayText(w.week, { day: "numeric", month: "short", year: "2-digit" })}
                          {w.span < 7 && <span className="ml-1.5 font-mono text-[12px] font-normal text-[#71717A]">{w.span}d</span>}
                        </th>
                        <td className="px-2 py-2.5 text-right font-semibold">{w.execution}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-sm text-[#52525B]">
                          {wow === null ? "—" : `${wow >= 0 ? "▲" : "▼"}${formatNumber(Math.abs(wow))}%`}
                        </td>
                        <td className="px-2 py-2.5 text-right">{w.commits}</td>
                        <td className="px-2 py-2.5 text-right">{w.tasks}</td>
                        <td className="px-2 py-2.5 text-right text-[#52525B]">
                          {w.active}/{w.span}
                        </td>
                        <td className="px-2 py-2.5 text-right">{formatNumber(w.velocity, 2)}</td>
                        <td className="px-2 py-2.5">
                          <span className="app-field block h-2 overflow-hidden rounded-full" aria-hidden="true">
                            <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${w.execution / maxWeek})` }} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[12px] text-[#71717A]">WoW = change in Σ ÷ days; partial weeks marked</p>
          </Panel>

          <Panel title="Projects" aside="Share of execution">
            {s.projects.length === 0 ? (
              <p className="font-mono text-sm text-[#71717A]">No execution</p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-base tabular-nums">
                  <thead>
                    <tr className={cn(TICK, "text-left text-[#52525B]")}>
                      <th scope="col" className="px-2 pb-2 font-medium">Project</th>
                      <th scope="col" className="px-2 pb-2 text-right font-medium">Σ</th>
                      <th scope="col" className="w-[22%] px-2 pb-2 font-medium">Share</th>
                      <th scope="col" className="px-2 pb-2 text-right font-medium">Prior</th>
                      <th scope="col" className="px-2 pb-2 text-right font-medium">Δ</th>
                      <th scope="col" className="px-2 pb-2 text-right font-medium">Commits</th>
                      <th scope="col" className="px-2 pb-2 text-right font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.projects.map((p) => {
                      const share = projectTotal ? p.execution / projectTotal : 0;
                      const delta = change(p.execution, p.previous);
                      return (
                        <tr key={p.name} className="border-t border-black/[0.05]">
                          <th scope="row" className="max-w-[16rem] truncate px-2 py-2.5 text-left font-medium">
                            {p.name}
                          </th>
                          <td className="px-2 py-2.5 text-right font-semibold">{p.execution}</td>
                          <td className="px-2 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="app-field block h-2 flex-1 overflow-hidden rounded-full" aria-hidden="true">
                                <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${share})` }} />
                              </span>
                              <span className="w-10 text-right font-mono text-sm text-[#52525B]">{formatNumber(share * 100)}%</span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right text-[#52525B]">{p.previous}</td>
                          <td className="px-2 py-2.5 text-right font-mono text-sm text-[#52525B]">
                            {delta === null ? (p.execution > 0 ? "new" : "—") : `${delta >= 0 ? "▲" : "▼"}${formatNumber(Math.abs(delta))}%`}
                          </td>
                          <td className="px-2 py-2.5 text-right">{p.commits}</td>
                          <td className="px-2 py-2.5 text-right text-[#52525B]">
                            {p.activeDays}/{m.eligibleDays}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {(objectives.length > 0 || objectiveControls) && (
            <Panel
              title="Objectives"
              aside={objectiveControls && <NewObjective projects={objectiveControls.projects} />}
            >
              {objectives.length === 0 ? (
                <EmptyState title="No objectives" />
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {objectives.map((o) => {
                    const pos = objectivePosition(o, now);
                    return (
                      <li key={o.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{o.name}</p>
                          <p className="mt-0.5 text-sm text-[#71717A] tabular-nums">
                            {formatNumber(o.currentValue)} / {formatNumber(o.targetValue)} {o.unit}
                            {o.projectName && ` · ${o.projectName}`}
                            {o.deadlineAt && `, due ${formatDate(o.deadlineAt, tz, { day: "numeric", month: "short", year: "numeric" })}`}
                          </p>
                          <div className="mt-2.5">
                            <ProgressRail value={o.currentValue} max={o.targetValue} label={`${o.name} progress`} />
                          </div>
                        </div>
                        <p className="font-mono text-sm leading-relaxed tabular-nums text-[#52525B]">
                          velocity {formatNumber(pos.velocity, 2)}/d
                          <br />
                          required {pos.required === null ? "—" : pos.required === Infinity ? "past deadline" : `${formatNumber(pos.required, 2)}/d`}
                          {pos.projected && pos.status !== "completed" && (
                            <>
                              <br />
                              eta {formatDate(pos.projected, tz, { day: "numeric", month: "short", year: "numeric" })}
                            </>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          {objectiveControls && o.measure === "manual" && <ObjectiveProgress objectiveId={o.id} name={o.name} value={o.currentValue} unit={o.unit} />}
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em]",
                              pos.status === "behind" ? "app-inverse" : "app-field text-[#27272A]"
                            )}
                          >
                            {pos.status}
                          </span>
                          {objectiveControls && <ArchiveObjective objectiveId={o.id} name={o.name} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
