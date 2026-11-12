import * as React from "react";
import { getToday, hasCommits } from "@/db/queries";
import { redirect } from "next/navigation";
import { getCaptureProjects, getViewer, getViewerTicker } from "@/lib/viewer";
import { formatDate } from "@/lib/format";
import { DISPLAY, PageHeader, Panel, EmptyState, TICK } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { TaskRow, withParam } from "@/components/app/task-row";
import { CommitLedger } from "@/components/app/commit-ledger";
import { QuickCapture } from "@/components/app/quick-capture";
import { CountUp } from "@/components/app/count-up";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  // A new account with nothing recorded yet starts with first-run setup
  if (!viewer.onboardedAt && !(await hasCommits(viewer.id))) redirect("/platform/start");
  const now = new Date();
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id };
  const [today, projects, ticker] = await Promise.all([
    getToday(scope, viewer.tz),
    getCaptureProjects(viewer),
    getViewerTicker(viewer),
  ]);
  const done = today.executionToday;
  // Today against the 7-day average (last 7 local days, today included)
  const avg = ticker.last7 / 7;
  const href = (key: string) => (id: string) => withParam("/platform/today", params, key, id);

  return (
    <>
      <PageHeader label={formatDate(now, viewer.tz, { weekday: "long", day: "numeric", month: "long" })} title="Today" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Focal instrument: the one inverse (near-white) surface on this page */}
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
                <CountUp value={String(today.commits.length)} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-accent-muted">Done</dt>
              <dd className="mt-1 text-lg font-semibold">
                <CountUp value={String(today.completed.length)} />
              </dd>
            </div>
            <div title="Average daily execution over the last 7 days">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-accent-muted">7D avg</dt>
              <dd className="mt-1 text-lg font-semibold">
                <CountUp value={avg.toFixed(1)} />
              </dd>
            </div>
          </dl>
        </section>

        <Panel title="Capture">
          <QuickCapture projects={projects} tz={viewer.tz} />
          <p className="mt-1 px-2 font-mono text-sm text-[#71717A]">
            <kbd>C</kbd> commit · <kbd>⌘&nbsp;K</kbd> everything
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {today.overdue.length > 0 && (
            <Panel title="Overdue" aside={`${today.overdue.length}`}>
              <ul className="app-stagger -mx-3">
                {today.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Active" aside={`${today.active.length}`}>
            {today.active.length === 0 ? (
              <EmptyState title="Nothing active" />
            ) : (
              <ul className="app-stagger -mx-3">
                {today.active.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Queued" aside="Next by due date and priority">
            {today.queued.length === 0 ? (
              <EmptyState title="Queue clear" />
            ) : (
              <ul className="app-stagger -mx-3">
                {today.queued.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Completed today" aside={`${today.completed.length}`}>
            {today.completed.length === 0 ? (
              <EmptyState title="None yet" />
            ) : (
              <ul className="app-stagger -mx-3">
                {today.completed.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Today’s commits" aside={`+${done}`}>
            {today.commits.length === 0 ? (
              <EmptyState title="No commits yet" />
            ) : (
              <div className="-mx-3">
                <CommitLedger commits={today.commits} tz={viewer.tz} now={now} hrefFor={href("commit")} grouped={false} />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}
