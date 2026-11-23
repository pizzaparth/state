import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getDailyExecution, getDoneTasks, getOpenTasks, type Scope } from "@/db/queries";
import { QuickCapture } from "./quick-capture";
import { ProjectNotes } from "./project-notes";
import { formatDate, formatNumber } from "@/lib/format";
import { CommitLedger } from "./commit-ledger";
import { ExecutionGraph } from "./execution-graph";
import { EmptyState, Measure, Panel } from "./primitives";
import { TaskRow } from "./task-row";

/** The project page's records: 91 days of execution, recent commits, open work, a Done page. */
export async function loadProjectView(projectScope: Scope, tz: string, tab: "open" | "done", page: number) {
  const [daily, recent, open, done] = await Promise.all([
    getDailyExecution(projectScope, tz, 91),
    getCommits(projectScope, { limit: 12 }),
    getOpenTasks(projectScope),
    tab === "done" ? getDoneTasks(projectScope, page) : Promise.resolve({ rows: [], more: false }),
  ]);
  return { daily, recent, open, done };
}

/** Project page: numbers, graph, capture into it, open work by column, Done pages, notes. */
export function ProjectView({
  project,
  data,
  tz,
  taskHref,
  commitHref,
  tab,
  page,
  tabHref,
  capture,
}: {
  project: { id: string; name: string; slug: string; status: string; description: string | null; notes: string | null; archived: boolean };
  data: Awaited<ReturnType<typeof loadProjectView>>;
  tz: string;
  taskHref: (id: string) => string;
  commitHref: (id: string) => string;
  tab: "open" | "done";
  page: number;
  tabHref: (tab: "open" | "done", page?: number) => string;
  /** Capture projects (live), when the viewer can add tasks here. */
  capture: { projects: { slug: string; name: string }[] } | null;
}) {
  const { daily, recent, open, done } = data;
  const now = new Date();
  const last30 = daily.slice(-30);
  const exec30 = last30.reduce((s, d) => s + d.execution, 0);
  const commits7 = daily.slice(-7).reduce((s, d) => s + d.commits, 0);
  const completed = daily.reduce((s, d) => s + d.tasks, 0);
  const byColumn = new Map<string, typeof open>();
  for (const t of open) {
    const key = t.columnName ?? "Inbox";
    byColumn.set(key, [...(byColumn.get(key) ?? []), t]);
  }

  return (
    <>
      <div className="app-stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Measure inverse label="Execution rate" value={formatNumber(exec30 / 30, 2)} unit="/ day" formula={`${exec30} ÷ 30 days`} />
        <Measure label="Open" value={formatNumber(open.length)} formula="not done" />
        <Measure label="Done / 91d" value={formatNumber(completed)} formula="task commits" />
        <Measure label="Commits / 7d" value={formatNumber(commits7)} formula="tasks + manual" />
      </div>

      {capture && !project.archived && (
        <Panel title={`Capture into ${project.name}`}>
          <QuickCapture projects={capture.projects} tz={tz} defaultProject={project.slug} draftKey={`state:draft:project:${project.slug}`} placeholder={`Add a task to ${project.name}… !high fri`} />
        </Panel>
      )}

      <Panel title="Execution graph" aside="Last 13 weeks">
        <ExecutionGraph days={daily} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title={tab === "open" ? "Open tasks" : "Done"}
          aside={
            <span className="flex items-center gap-3">
              <Link href={tabHref("open") as Route} scroll={false} aria-current={tab === "open" ? "page" : undefined} className={tab === "open" ? "font-semibold text-[#0A0A0A]" : "hover:text-[#0A0A0A]"}>
                Open {open.length}
              </Link>
              <Link href={tabHref("done") as Route} scroll={false} aria-current={tab === "done" ? "page" : undefined} className={tab === "done" ? "font-semibold text-[#0A0A0A]" : "hover:text-[#0A0A0A]"}>
                Done
              </Link>
              <Link href={`/platform/board?work=${project.slug}` as Route} className="hover:text-[#0A0A0A]">
                Board →
              </Link>
            </span>
          }
        >
          {tab === "open" ? (
            open.length === 0 ? (
              <EmptyState title="All done" />
            ) : (
              <div className="space-y-4">
                {[...byColumn].map(([column, list]) => (
                  <section key={column} aria-label={column}>
                    <h3 className="px-0 pb-1 font-mono text-[12px] uppercase tracking-[0.16em] text-[#4F5565]">
                      {column} · {list.length}
                    </h3>
                    <ul className="app-stagger -mx-3">
                      {list.map((t) => (
                        <TaskRow key={t.id} task={t} tz={tz} now={now} href={taskHref(t.id)} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : done.rows.length === 0 ? (
            <EmptyState title="Nothing done yet" />
          ) : (
            <>
              <ul className="app-stagger -mx-3">
                {done.rows.map((t) => (
                  <TaskRow key={t.id} task={t} tz={tz} now={now} href={taskHref(t.id)} />
                ))}
              </ul>
              <div className="mt-3 flex justify-between text-sm font-medium text-[#3A3F4B]">
                {page > 0 ? <Link href={tabHref("done", page - 1) as Route} className="hover:text-[#0A0A0A]">← Newer</Link> : <span />}
                {done.more && <Link href={tabHref("done", page + 1) as Route} className="hover:text-[#0A0A0A]">Older →</Link>}
              </div>
            </>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Notes">
            <ProjectNotes projectId={project.id} notes={project.notes} editable={Boolean(capture)} />
          </Panel>
          <Panel title="Recent commits" aside={<Link href={`/platform/history?work=${project.slug}` as Route} className="hover:text-[#0A0A0A]">all</Link>}>
            {recent.length === 0 ? (
              <EmptyState title="No commits yet" />
            ) : (
              <div className="-mx-3">
                <CommitLedger commits={recent} tz={tz} now={now} hrefFor={commitHref} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Shown on an archived project's page: what archiving means and when it happened. */
export function ArchivedNotice({ archivedAt, tz }: { archivedAt: Date; tz: string }) {
  return (
    <p className="app-panel px-5 py-3 text-base text-[#3A3F4B]">
      Archived {formatDate(archivedAt, tz, { day: "numeric", month: "short", year: "numeric" })}. Its history stays here, but it is not offered for{" "}
      <span className="font-mono">#capture</span> or new commits.
    </p>
  );
}
