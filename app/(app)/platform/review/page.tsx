import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getCommits, getTaskFlow } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { dayKey, dayLabel, formatNumber } from "@/lib/format";
import { isoWeek, shiftDay, weekStart } from "@/lib/week";
import { EmptyState, Measure, PageHeader, Panel } from "@/components/app/primitives";
import { CommitLedger } from "@/components/app/commit-ledger";
import { MixBar } from "@/components/app/charts";
import { withParam } from "@/components/app/task-row";
import { CopyTextButton } from "@/components/app/copy-text-button";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";
import { currentLocale } from "@/lib/locale";

export const metadata = { title: "Week review" };

const WEEK_LIMIT = 2000;

/** One ISO week: Σ, commits by day, split by project, created against done, and the ledger. */
export default async function ReviewPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const today = dayKey(new Date(), viewer.tz);
  const current = isoWeek(today);
  const start = weekStart(params.week) ?? weekStart(current)!;
  const week = isoWeek(start);
  const end = shiftDay(start, 6);
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id };
  const [commits, flow] = await Promise.all([
    getCommits(scope, { tz: viewer.tz, from: start, to: end, limit: WEEK_LIMIT }),
    getTaskFlow(scope, viewer.tz, start, end),
  ]);

  const total = commits.reduce((s, c) => s + c.executionValue, 0);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const byDay = days.map((d) => {
    const rows = commits.filter((c) => dayKey(c.createdAt, viewer.tz) === d);
    return { day: d, commits: rows.length, execution: rows.reduce((s, c) => s + c.executionValue, 0) };
  });
  const maxDay = Math.max(1, ...byDay.map((d) => d.execution));
  const projects = new Map<string, { execution: number; commits: number }>();
  for (const c of commits) {
    const key = c.projectName ?? "No project";
    const p = projects.get(key) ?? { execution: 0, commits: 0 };
    p.execution += c.executionValue;
    p.commits++;
    projects.set(key, p);
  }
  const projectParts = [...projects].sort((a, b) => b[1].execution - a[1].execution).map(([name, p]) => ({ name, value: p.execution, detail: `${p.commits}×` }));
  const weekday = (d: string) => new Intl.DateTimeFormat(currentLocale(), { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const range = `${dayLabel(start, today)} – ${dayLabel(end, today)}`;

  const text = [
    `Week ${week} (${start} to ${end})`,
    `Execution Σ ${total} · ${commits.length} commits · ${flow.completed} tasks done · ${flow.created} created`,
    "",
    "By day",
    ...byDay.map((d) => `  ${weekday(d.day)} ${d.day}  +${d.execution}  (${d.commits})`),
    "",
    "By project",
    ...projectParts.map((p) => `  ${p.name}  +${p.value}  (${p.detail})`),
    "",
    "Commits",
    ...[...commits].reverse().map((c) => `  ${dayKey(c.createdAt, viewer.tz)}  +${c.executionValue}  ${c.message}${c.projectName ? `  [${c.projectName}]` : ""}`),
  ].join("\n");

  const href = (w: string) => `/platform/review?week=${w}` as Route;
  const prev = isoWeek(shiftDay(start, -7));
  const next = isoWeek(shiftDay(start, 7));

  return (
    <>
      <PageHeader
        label={`${week} · ${range}`}
        title="Week review"
        actions={
          <>
            <Link href={href(prev)} className="app-btn mi-press inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {prev.slice(5)}
            </Link>
            {start < weekStart(current)! && (
              <Link href={href(next)} className="app-btn mi-press inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium">
                {next.slice(5)}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
            <CopyTextButton text={text} />
          </>
        }
      />

      <div className="app-stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure inverse label="Execution Σ" value={formatNumber(total)} formula="Σ commit weights, Mon–Sun" />
        <Measure label="Commits" value={formatNumber(commits.length)} formula="tasks + manual" />
        <Measure label="Done" value={formatNumber(flow.completed)} formula="tasks reaching Done" />
        <Measure label="Created" value={formatNumber(flow.created)} formula={`net ${flow.completed - flow.created >= 0 ? "▲" : "▼"}${Math.abs(flow.completed - flow.created)} done − created`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="By day" aside={`Σ ${total}`}>
          <ol className="space-y-2">
            {byDay.map((d) => (
              <li key={d.day} className="grid grid-cols-[3rem_minmax(0,1fr)_4rem] items-center gap-3 font-mono text-sm tabular-nums">
                <span className={d.day === today ? "font-semibold text-[#0A0A0A]" : "text-[#52525B]"}>{weekday(d.day)}</span>
                <span className="app-field h-2.5 overflow-hidden rounded-full">
                  <span className="block h-full origin-left animate-grow-x rounded-full bg-accent" style={{ transform: `scaleX(${d.execution / maxDay})` }} />
                </span>
                <span className="text-right">
                  <span className="font-semibold text-accent">+{d.execution}</span> <span className="text-[#71717A]">{d.commits}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="By project">
          {projectParts.length === 0 ? <EmptyState title="No commits" /> : <MixBar label="Execution by project" parts={projectParts} />}
        </Panel>
      </div>

      <Panel title="Ledger" aside={`${commits.length}${commits.length === WEEK_LIMIT ? "+" : ""}`}>
        {commits.length === 0 ? (
          <EmptyState title="Quiet week" />
        ) : (
          <div className="-mx-3">
            <CommitLedger commits={commits} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam("/platform/review", params, "commit", id)} />
          </div>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}
