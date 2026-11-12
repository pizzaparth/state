import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { TaskCard } from "@/db/queries";
import { dueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DueLabel, PriorityMark, WeightMark } from "./primitives";
import { CompleteButton } from "./complete-button";

/** Level 0 task row: flat, dense, opens the task panel via ?task=. */
export function TaskRow({
  task,
  tz,
  now,
  href,
  actions,
  age,
}: {
  task: TaskCard;
  tz: string;
  now: Date;
  href: string;
  /** Row actions shown after the link (Today, Inbox). */
  actions?: React.ReactNode;
  /** Short age shown last ("4d"), for Inbox captures. */
  age?: string;
}) {
  const done = Boolean(task.completedAt);
  return (
    <li data-task-id={task.id} data-title={task.title} data-project={task.projectSlug ?? ""} className="mi-row group flex min-w-0 items-center gap-x-1.5 rounded-[12px] pl-1.5 data-[selected=true]:bg-accent-soft">
      <CompleteButton taskId={task.id} title={task.title} done={done} />
      <Link
        href={href as Route}
        scroll={false}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] py-2.5 pr-3 sm:flex-nowrap"
      >
        <span className="min-w-0 flex-1 basis-full sm:basis-auto">
          <span className={cn("block truncate text-base font-medium", done ? "text-[#52525B]" : "text-[#0A0A0A]")}>
            {task.title}
            {done && <span className="sr-only"> (done)</span>}
          </span>
          {task.projectName && <span className="block truncate text-sm text-[#71717A]">{task.projectName}</span>}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          {task.dueAt && !done && <DueLabel due={dueState(task.dueAt, now, tz)} />}
          <PriorityMark priority={task.priority} />
          <WeightMark weight={task.weight} />
          {age && (
            <span title="Time since capture" className="w-8 text-right font-mono text-[12px] tabular-nums text-[#71717A]">
              {age}
            </span>
          )}
        </span>
      </Link>
      {actions}
    </li>
  );
}

/** Params that open a panel or a one-off action; a new panel link drops them all. */
const TRANSIENT = new Set(["task", "commit", "objective", "metric", "capture"]);

/** `path` with the page's params kept (filters, sort, period), any open panel dropped, and `key` set. */
export function withParam(path: string, params: Record<string, string | undefined>, key: string, value: string) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== key && !TRANSIENT.has(k)) next.set(k, v);
  next.set(key, value);
  return `${path}?${next.toString()}`;
}
