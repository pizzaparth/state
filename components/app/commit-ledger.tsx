import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { CommitRow } from "@/db/queries";
import { dayKey, dayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Technical event stream: aligned times, a commit marker on a thin connector, message,
 * project and execution value. Grouped by local day. Level 0 rows.
 */
export function CommitLedger({
  commits,
  tz,
  now,
  hrefFor,
  showAuthor = false,
  grouped = true,
}: {
  commits: CommitRow[];
  tz: string;
  now: Date;
  /** Opens a commit's detail; without it rows are plain (landing page demo). */
  hrefFor?: (commitId: string) => string;
  showAuthor?: boolean;
  grouped?: boolean;
}) {
  const today = dayKey(now, tz);
  const groups: { key: string; rows: CommitRow[] }[] = [];
  for (const c of commits) {
    const key = grouped ? dayKey(c.createdAt, tz) : "all";
    const last = groups.at(-1);
    if (last && last.key === key) last.rows.push(c);
    else groups.push({ key, rows: [c] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const total = group.rows.reduce((s, r) => s + r.executionValue, 0);
        return (
          <section key={group.key} aria-label={grouped ? dayLabel(group.key, today) : undefined}>
            {grouped && (
              <h3 className="mb-1 flex items-baseline justify-between px-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#B4BEDB]">
                <span>{dayLabel(group.key, today)}</span>
                <span className="font-mono tabular-nums normal-case tracking-normal">
                  {group.rows.length} {group.rows.length === 1 ? "commit" : "commits"}, +{total}
                </span>
              </h3>
            )}
            <ol className="app-stagger relative">
              {/* Thin connector behind the markers */}
              <span aria-hidden="true" className="absolute bottom-3 left-[4.4rem] top-3 w-px bg-white/[0.08]" />
              {group.rows.map((c) => (
                <li key={c.id}>
                  <Row href={hrefFor?.(c.id)}>
                    <time dateTime={c.createdAt.toISOString()} className="font-mono text-sm tabular-nums text-[#B4BEDB]">
                      {formatTime(c.createdAt, tz)}
                    </time>
                    <span
                      aria-hidden="true"
                      className={cn("relative z-[1] mx-auto size-2 rounded-full", c.source === "manual" ? "border border-accent bg-[#001A33]" : "bg-accent")}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-[#FFFFFF]">{c.message}</span>
                      <span className="block truncate text-sm text-[#8E9AC0]">
                        {[c.projectName, showAuthor ? c.authorName : null, c.source === "manual" ? "manual" : null].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent">+{c.executionValue}</span>
                  </Row>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

const ROW = "grid grid-cols-[3.25rem_1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-[12px] px-3 py-2";

function Row({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href as Route} scroll={false} className={cn(ROW, "mi-row")}>
      {children}
    </Link>
  ) : (
    <div className={ROW}>{children}</div>
  );
}
