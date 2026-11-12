import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getObjectives, getToday, hasCommits, TODAY_LIMIT, type TaskCard } from "@/db/queries";
import { getCaptureProjects, getViewer, getViewerTicker } from "@/lib/viewer";
import { dayKey, formatDate, formatNumber } from "@/lib/format";
import { objectivePosition } from "@/lib/metrics";
import { DISPLAY, PageHeader, Panel, EmptyState, ProgressRail, TICK } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { TaskRow, withParam } from "@/components/app/task-row";
import { RowActions, CarryPlan, type RowAction } from "@/components/app/row-actions";
import { CommitLedger } from "@/components/app/commit-ledger";
import { QuickCapture } from "@/components/app/quick-capture";
import { CountUp } from "@/components/app/count-up";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Today" };

/** "100+" when a list hit its bound, with a link to where the rest is. */
function Count({ n, href }: { n: number; href: string }) {
  if (n < TODAY_LIMIT) return <>{n}</>;
  return (
    <Link href={href as Route} className="underline underline-offset-2 hover:text-[#0A0A0A]">
      {TODAY_LIMIT}+
    </Link>
  );
}

export default async function TodayPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  // A new account with nothing recorded yet starts with first-run setup
  if (!viewer.onboardedAt && !(await hasCommits(viewer.id))) redirect("/platform/start");
  const now = new Date();
  const today = dayKey(now, viewer.tz);
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id };
  const [data, projects, ticker, objectives] = await Promise.all([
    getToday(scope, viewer.tz),
    getCaptureProjects(viewer),
    getViewerTicker(viewer),
    viewer.personalWorkspaceId ? getObjectives([viewer.personalWorkspaceId]) : [],
  ]);
  const done = data.executionToday;
  // The seven complete days before today, so the number does not read low every morning
  const avg = ticker.prior7 / 7;
  const href = (key: string) => (id: string) => withParam("/platform/today", params, key, id);
  const plannedOpen = data.planned.filter((t) => !t.completedAt);
  const plannedSum = data.planned.reduce((s, t) => s + t.weight, 0);
  const plannedDone = data.planned.filter((t) => t.completedAt).reduce((s, t) => s + t.weight, 0);
  const plannedIds = new Set(data.planned.map((t) => t.id));
  const live = objectives.filter((o) => !o.completedAt);

  const rows = (list: TaskCard[], actions: RowAction[]) => (
    <ul className="app-stagger -mx-3">
      {list.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          tz={viewer.tz}
          now={now}
          href={href("task")(t.id)}
          actions={t.completedAt ? undefined : <RowActions taskId={t.id} title={t.title} today={today} planned={plannedIds.has(t.id)} actions={actions} />}
        />
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader label={formatDate(now, viewer.tz, { weekday: "long", day: "numeric", month: "long" })} title="Today" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Focal instrument: the one accent surface on this page */}
        <section aria-labelledby="execution-today" className="app-inverse rounded-[28px] p-6">
          <h2 id="execution-today" className={cn(TICK, "text-accent-muted")}>
            Execution today
          </h2>
          <p className={cn(DISPLAY, "mt-5 text-[clamp(4rem,9vw,6.5rem)] leading-[0.85] tabular-nums")}>
            <CountUp value={`+${done}`} />
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-black/[0.12] pt-4 font-mono text-sm tabular-nums">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-accent-muted">Commits</dt>
              <dd className="mt-1 text-lg font-semibold">
                <CountUp value={String(data.commits.length)} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-accent-muted">Done</dt>
              <dd className="mt-1 text-lg font-semibold">
                <CountUp value={String(data.completed.length)} />
              </dd>
            </div>
            <div title="Average daily execution over the seven complete days before today">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-accent-muted">Prev 7d</dt>
              <dd className="mt-1 text-lg font-semibold">
                <CountUp value={avg.toFixed(1)} />
                <span className="text-sm font-normal">/d</span>
              </dd>
            </div>
          </dl>
        </section>

        <Panel title="Capture">
          <QuickCapture projects={projects} tz={viewer.tz} draftKey="state:draft:today" />
          <p className="mt-1 px-2 font-mono text-sm text-[#71717A]">
            <kbd>C</kbd> commit · <kbd>N</kbd> task · <kbd>⌘&nbsp;K</kbd> everything
          </p>
        </Panel>
      </div>

      {(data.planned.length > 0 || data.carried.length > 0) && (
        <Panel title="Planned" aside={`Σ ${plannedSum} planned · +${plannedDone} done`}>
          {data.planned.length > 0 && (
            <ul className="app-stagger -mx-3">
              {[...plannedOpen, ...data.planned.filter((t) => t.completedAt)].map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  tz={viewer.tz}
                  now={now}
                  href={href("task")(t.id)}
                  actions={t.completedAt ? undefined : <RowActions taskId={t.id} title={t.title} today={today} planned actions={["start", "plan"]} />}
                />
              ))}
            </ul>
          )}
          {data.carried.length > 0 && (
            <div className={cn(data.planned.length > 0 && "mt-4 border-t border-black/[0.05] pt-4")}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className={cn(TICK, "text-[11px] text-[#71717A]")}>Yesterday · not done</h3>
                <CarryPlan taskIds={data.carried.map((t) => t.id)} />
              </div>
              {rows(data.carried, ["start"])}
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {data.overdue.length > 0 && (
            <Panel title="Overdue" aside={<Count n={data.overdue.length} href="/platform/board?due=overdue" />}>
              {rows(data.overdue, ["plan", "start", "tomorrow"])}
            </Panel>
          )}
          <Panel title="Active" aside={<Count n={data.active.length} href="/platform/board" />}>
            {data.active.length === 0 ? <EmptyState title="Nothing active" /> : rows(data.active, ["plan", "tomorrow"])}
          </Panel>
          <Panel title="Queued" aside="Next by due date and priority">
            {data.queued.length === 0 ? <EmptyState title="Queue clear" /> : rows(data.queued, ["plan", "start", "tomorrow"])}
          </Panel>
        </div>

        <div className="space-y-5">
          {live.length > 0 && (
            <Panel title="Objectives" aside={<Link href="/platform/metrics#objectives" className="hover:text-[#0A0A0A]">all</Link>}>
              <ul className="space-y-3">
                {live.map((o) => {
                  const pos = objectivePosition(o, now);
                  return (
                    <li key={o.id}>
                      <Link href={`/platform/metrics?objective=${o.id}` as Route} className="mi-row -mx-2 block rounded-[12px] px-2 py-1.5">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-[15px] font-medium">{o.name}</span>
                          <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#52525B]">
                            {formatNumber(o.currentValue)}/{formatNumber(o.targetValue)} · {pos.status === "behind" || pos.status === "overdue" ? "▼ " : pos.status === "ahead" ? "▲ " : ""}
                            {pos.status}
                          </span>
                        </span>
                        <span className="mt-1.5 block">
                          <ProgressRail value={o.currentValue} max={o.targetValue} label={`${o.name} progress`} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          <Panel title="Completed today" aside={<Count n={data.completed.length} href={`/platform/history?day=${today}&source=task`} />}>
            {data.completed.length === 0 ? <EmptyState title="None yet" /> : rows(data.completed, [])}
          </Panel>
          <Panel title="Today’s commits" aside={`+${done}`}>
            {data.commits.length === 0 ? (
              <EmptyState title="No commits yet" />
            ) : (
              <div className="-mx-3">
                <CommitLedger commits={data.commits} tz={viewer.tz} now={now} hrefFor={href("commit")} grouped={false} />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Drawers
        params={params}
        viewer={viewer}
        siblings={[...new Set([...data.planned, ...data.carried, ...data.overdue, ...data.active, ...data.queued, ...data.completed].map((t) => t.id))]}
      />
    </>
  );
}
