import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getCommits, getDailyExecution, getDoneTasks, getOpenTasks, type Scope } from "@/db/queries";
import { QuickCapture } from "./quick-capture";
import { ProjectNotes } from "./project-notes";
import { formatDate, formatNumber } from "@/lib/format";
import { CommitLedger } from "./commit-ledger";
import { ExecutionGraph } from "./execution-graph";
import { Chip, EmptyState, Measure, Panel } from "./primitives";
import { TaskRow } from "./task-row";

/** Project page: numbers, graph, capture into it, open work by column, Done pages, notes. */
export async function ProjectView({
  project,
  scope,
  tz,
  taskHref,
  commitHref,
  tab,
  page,
  tabHref,
  capture,
}: {
  project: { id: string; name: string; slug: string; status: string; description: string | null; notes: string | null; archived: boolean };
  scope: Scope;
  tz: string;
  taskHref: (id: string) => string;
  commitHref: (id: string) => string;
  tab: "open" | "done";
  page: number;
  tabHref: (tab: "open" | "done", page?: number) => string;
  /** Capture projects (live), when the viewer can add tasks here. */
  capture: { projects: { slug: string; name: string }[] } | null;
}) {
  const projectScope = { ...scope, projectId: project.id };
  const [daily, recent, open, done] = await Promise.all([
    getDailyExecution(projectScope, tz, 91),
    getCommits(projectScope, { limit: 12 }),
    getOpenTasks(projectScope),
    tab === "done" ? getDoneTasks(projectScope, page) : Promise.resolve({ rows: [], more: false }),
  ]);
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
              <Link href={`/platform/board?project=${project.slug}` as Route} className="hover:text-[#0A0A0A]">
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
                    <h3 className="px-0 pb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[#71717A]">
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
              <div className="mt-3 flex justify-between text-sm font-medium text-[#52525B]">
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
          <Panel title="Recent commits" aside={<Link href={`/platform/history?project=${project.slug}` as Route} className="hover:text-[#0A0A0A]">all</Link>}>
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
  if (projects.length === 0) return <EmptyState title="No projects" />;
  const sorted = [...projects].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-base">
        <thead>
          <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">
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
            <tr key={p.id} className="border-t border-black/[0.05] transition-colors hover:bg-black/[0.03]">
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
              <td className="px-2 py-3 text-right text-[#52525B] tabular-nums">{p.lastCommitAt ? formatDate(p.lastCommitAt, tz) : "—"}</td>
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
    <p className="app-panel px-5 py-3 text-base text-[#52525B]">
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
    <div className="mt-5 border-t border-black/[0.05] pt-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">Archived</h3>
      <ul className="mt-2">
        {projects.map((p) => (
          <li key={p.id} className="flex min-w-0 items-baseline justify-between gap-4 py-1.5 text-base">
            <Link href={hrefFor(p.slug) as Route} className="min-w-0 truncate rounded-[6px] text-[#52525B] hover:text-[#0A0A0A] hover:underline">
              {p.name}
            </Link>
            {p.archivedAt && <span className="shrink-0 text-sm tabular-nums text-[#71717A]">{formatDate(p.archivedAt, tz)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
