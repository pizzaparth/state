import * as React from "react";
import { getProjects, getToday } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader, Panel, EmptyState } from "@/components/app/primitives";
import { TaskRow, withParam } from "@/components/app/task-row";
import { CommitLedger } from "@/components/app/commit-ledger";
import { QuickCapture } from "@/components/app/quick-capture";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Today — State" };

export default async function TodayPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const now = new Date();
  const [today, projects] = await Promise.all([
    getToday({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz),
    getProjects(viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []),
  ]);
  const target = viewer.dailyExecutionTarget;
  const done = today.executionToday;
  const href = (key: string) => (id: string) => withParam("/today", params, key, id);
  const pct = target ? Math.min(100, (done / target) * 100) : 0;

  return (
    <>
      <PageHeader label={formatDate(now, viewer.tz, { weekday: "long", day: "numeric", month: "long" })} title="Today" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Focal instrument: the one inverse (near-white) surface on this page */}
        <section aria-labelledby="execution-today" className="app-inverse rounded-[28px] p-6">
          <h2 id="execution-today" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#55554F]">
            Execution today
          </h2>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="text-6xl font-semibold leading-none tracking-[-0.03em] tabular-nums">{done}</span>
            {target && <span className="text-xl tabular-nums text-[#55554F]">/ {target}</span>}
          </p>
          {target ? (
            <>
              <div
                role="progressbar"
                aria-label="Execution toward today's target"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={done}
                className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/10"
              >
                <div className="h-full origin-left animate-grow-x rounded-full bg-[#0A0A0A]" style={{ transform: `scaleX(${pct / 100})` }} />
              </div>
              <p className="mt-3 text-base text-[#55554F]">
                {done >= target ? "Target reached." : `${formatNumber(target - done)} to today’s target.`}{" "}
                {today.commits.length} {today.commits.length === 1 ? "commit" : "commits"}, {today.completed.length} tasks completed.
              </p>
            </>
          ) : (
            <p className="mt-3 text-base text-[#55554F]">Set a daily target in Settings to track progress here.</p>
          )}
        </section>

        <Panel title="Capture">
          <QuickCapture projects={projects.map((p) => ({ slug: p.slug, name: p.name }))} />
          <p className="mt-1 px-2 text-sm text-[#85857F]">
            Press <kbd className="font-mono">C</kbd> to record a commit, <kbd className="font-mono">⌘&nbsp;K</kbd> for everything else.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {today.overdue.length > 0 && (
            <Panel title="Overdue" aside={`${today.overdue.length}`}>
              <ul className="-mx-3">
                {today.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Active" aside={`${today.active.length}`}>
            {today.active.length === 0 ? (
              <EmptyState title="Nothing active">Move a task to Active on your board to start it.</EmptyState>
            ) : (
              <ul className="-mx-3">
                {today.active.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Queued" aside="Next by due date and priority">
            {today.queued.length === 0 ? (
              <EmptyState title="Queue empty">Backlog tasks assigned to you appear here.</EmptyState>
            ) : (
              <ul className="-mx-3">
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
              <EmptyState title="None yet">Tasks you finish today are listed here.</EmptyState>
            ) : (
              <ul className="-mx-3">
                {today.completed.map((t) => (
                  <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={href("task")(t.id)} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Today’s commits" aside={`+${done}`}>
            {today.commits.length === 0 ? (
              <EmptyState title="No commits yet">Complete a task or record a manual commit to begin today’s history.</EmptyState>
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
