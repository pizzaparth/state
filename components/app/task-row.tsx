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
        className="group flex min-w-0 items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
      >
        <span
          aria-hidden="true"
          className={cn("size-3 shrink-0 rounded-full", done ? "bg-[#F2F2EF]" : "app-field border border-white/10")}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", done ? "text-[#9A9A96]" : "text-[#F2F2EF]")}>
            {task.title}
            {done && <span className="sr-only"> (done)</span>}
          </span>
          {task.projectName && <span className="block truncate text-xs text-[#85857F]">{task.projectName}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
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
