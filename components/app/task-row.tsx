import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { TaskCard } from "@/db/queries";
import { dueState, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, DueLabel, PriorityMark, WeightMark } from "./primitives";

/** Level 0 task row: flat, dense, opens the task panel via ?task=. */
export function TaskRow({
  task,
  tz,
  now,
  href,
  showAssignee = false,
}: {
  task: TaskCard;
  tz: string;
  now: Date;
  href: string;
  showAssignee?: boolean;
}) {
  const done = Boolean(task.completedAt);
  return (
    <li>
      <Link
        href={href as Route}
        scroll={false}
        className="mi-row group flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] px-3 py-2.5 sm:flex-nowrap"
      >
        <span
          aria-hidden="true"
          className={cn("size-3 shrink-0 rounded-full", done ? "mi-pop bg-accent" : "app-field border border-black/[0.06]")}
        />
        <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
          <span className={cn("block truncate text-base font-medium", done ? "text-[#52525B]" : "text-[#0A0A0A]")}>
            {task.title}
            {done && <span className="sr-only"> (done)</span>}
          </span>
          {task.projectName && <span className="block truncate text-sm text-[#71717A]">{task.projectName}</span>}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pl-6 sm:pl-0">
          {task.dueAt && !done && <DueLabel due={dueState(task.dueAt, now, tz)} />}
          <PriorityMark priority={task.priority} />
          <WeightMark weight={task.weight} />
          {showAssignee && task.assigneeName && <Avatar name={task.assigneeName} initials={initials(task.assigneeName)} />}
        </span>
      </Link>
    </li>
  );
}

export function withParam(path: string, params: Record<string, string | undefined>, key: string, value: string) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== key) next.set(k, v);
  next.set(key, value);
  return `${path}?${next.toString()}`;
}
