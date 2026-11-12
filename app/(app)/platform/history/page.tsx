import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getArchivedProjects, getCommitTotals, getCommits, getShellProjects, getTagNames, type CommitFilters } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { dayLabel, dayKey, formatNumber } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { CommitLedger } from "@/components/app/commit-ledger";
import { withParam } from "@/components/app/task-row";
import { HistoryFilters } from "@/components/app/history-filters";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "History" };

const PAGE = 100;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = { task: "task_completion", manual: "manual", imported: "imported" } as const;

/** Commit ledger with filters in the URL, a total for the filtered set and cursor pages. */
export default async function HistoryPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const workspaceIds = viewer.workspaceIds;
  const [live, archivedAll, tags] = await Promise.all([getShellProjects(workspaceIds), getArchivedProjects(workspaceIds), getTagNames(workspaceIds)]);
  const all = [...live, ...archivedAll];

  // Old links used the project id; send them to the slug form
  const byId = params.project ? all.find((p) => p.id === params.project) : undefined;
  if (byId) {
    const next = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
    next.set("project", byId.slug);
    redirect(`/platform/history?${next}`);
  }
  const project = params.project ? all.find((p) => p.slug === params.project) : undefined;

  const day = params.day && DAY_RE.test(params.day) ? params.day : undefined;
  const from = day ?? (params.from && DAY_RE.test(params.from) ? params.from : undefined);
  const to = day ?? (params.to && DAY_RE.test(params.to) ? params.to : undefined);
  const weight = Number(params.weight);
  const cursor = params.before?.match(/^(.+)_([A-Za-z0-9_-]{1,64})$/);
  const before = cursor && !Number.isNaN(Date.parse(cursor[1])) ? { at: new Date(cursor[1]), id: cursor[2] } : undefined;
  const filters: CommitFilters = {
    tz: viewer.tz,
    from,
    to,
    source: params.source && params.source in SOURCES ? SOURCES[params.source as keyof typeof SOURCES] : undefined,
    tag: params.tag && tags.includes(params.tag) ? params.tag : undefined,
    weight: [1, 2, 4, 8].includes(weight) ? weight : undefined,
    q: params.q?.trim().slice(0, 100) || undefined,
  };
  const scope = { workspaceIds, userId: viewer.id, projectId: project?.id };
  const [commits, totals] = await Promise.all([getCommits(scope, { ...filters, before, limit: PAGE }), getCommitTotals(scope, filters)]);
  const last = commits.at(-1);
  const olderHref =
    commits.length === PAGE && last ? (withParam("/platform/history", params, "before", `${last.createdAt.toISOString()}_${last.id}`) as Route) : null;
  const today = dayKey(new Date(), viewer.tz);

  return (
    <>
      <PageHeader label={day ? dayLabel(day, today) : "Ledger"} title="History" />

      <HistoryFilters
        projects={live.map((p) => ({ slug: p.slug, name: p.name }))}
        archived={archivedAll.map((p) => ({ slug: p.slug, name: p.name }))}
        tags={tags}
      />

      <Panel
        title={before ? "Older commits" : "Your commits"}
        aside={
          <span>
            {formatNumber(totals.count)} {totals.count === 1 ? "commit" : "commits"} · <span className="font-semibold text-accent">Σ {formatNumber(totals.execution)}</span>
          </span>
        }
      >
        {commits.length === 0 ? (
          <EmptyState title={before ? "No older commits" : "No commits"} />
        ) : (
          <div className="-mx-3">
            <CommitLedger commits={commits} tz={viewer.tz} now={new Date()} hrefFor={(id) => withParam("/platform/history", params, "commit", id)} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {before ? (
            <Link href={newestHref(params)} className="text-sm font-medium text-[#52525B] hover:text-[#0A0A0A]">
              Newest
            </Link>
          ) : (
            <span />
          )}
          {olderHref && (
            <Link href={olderHref} className="app-btn mi-arrow mi-press inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-sm font-medium">
              Older
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}

/** The same filters, first page. */
function newestHref(params: Record<string, string | undefined>): Route {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "before" && k !== "commit") next.set(k, v);
  const query = next.toString();
  return `/platform/history${query ? `?${query}` : ""}` as Route;
}
