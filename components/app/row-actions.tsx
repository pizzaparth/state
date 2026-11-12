"use client";

import * as React from "react";
import { CalendarClock, ListPlus, Loader2, Pin, PinOff, Play, Trash2 } from "lucide-react";
import { deleteTaskAction, restoreTaskAction, setTaskDeferAction, setTaskPlannedAction, setTaskStageAction, moveTaskAction } from "@/app/(app)/client-actions";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";

export type RowAction = "plan" | "queue" | "start" | "tomorrow" | "delete";

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * One-call actions on a task row, shown on hover and focus (always on touch screens).
 * Each is a button with a text label for assistive tech; the notice offers Undo where
 * there is one.
 */
export function RowActions({ taskId, title, actions, planned = false, today }: { taskId: string; title: string; actions: RowAction[]; planned?: boolean; today: string }) {
  const notify = useNotice();
  const [pending, setPending] = React.useState<RowAction | null>(null);
  const run = (action: RowAction) => {
    if (pending) return;
    setPending(action);
    void (async () => {
      if (action === "plan") {
        const r = await setTaskPlannedAction({ taskId, planned: !planned });
        notify(r.ok ? (planned ? `“${title}” unplanned.` : `Planned “${title}” for today.`) : r.error);
      } else if (action === "queue" || action === "start") {
        const r = await setTaskStageAction({ taskId, stage: action === "queue" ? "queued" : "active" });
        if (!r.ok) notify(r.error);
        else
          notify(`“${title}” → ${r.data.columnName}.`, r.data.previousColumnId ? { label: "Undo", run: async () => void (await moveTaskAction({ taskId, columnId: r.data.previousColumnId!, afterTaskId: null })) } : undefined);
      } else if (action === "tomorrow") {
        const r = await setTaskDeferAction({ taskId, until: shift(today, 1) });
        notify(r.ok ? `“${title}” waits until tomorrow.` : r.error, r.ok ? { label: "Undo", run: async () => void (await setTaskDeferAction({ taskId, until: null })) } : undefined);
      } else if (action === "delete") {
        const r = await deleteTaskAction({ taskId });
        notify(r.ok ? `Deleted “${title}”.` : r.error, r.ok ? { label: "Undo", run: async () => void (await restoreTaskAction({ taskId })) } : undefined);
      }
      setPending(null);
    })();
  };
  const meta: Record<RowAction, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    plan: { label: planned ? "Unplan" : "Plan", icon: planned ? PinOff : Pin },
    queue: { label: "Queue", icon: ListPlus },
    start: { label: "Start", icon: Play },
    tomorrow: { label: "Tomorrow", icon: CalendarClock },
    delete: { label: "Delete", icon: Trash2 },
  };
  return (
    <span className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
      {actions.map((a) => {
        const { label, icon: Icon } = meta[a];
        return (
          <button
            key={a}
            type="button"
            onClick={() => run(a)}
            disabled={pending !== null}
            data-row-action={a}
            title={label}
            aria-label={`${label} “${title}”`}
            className={cn("mi-press grid size-8 place-items-center rounded-[10px] text-[#52525B] hover:bg-black/[0.06] hover:text-[#0A0A0A] [@media(pointer:coarse)]:size-11", a === "delete" && "hover:text-danger")}
          >
            {pending === a ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Icon aria-hidden="true" className="size-4" />}
          </button>
        );
      })}
    </span>
  );
}

/** Carried-over plan: move yesterday's unfinished planned tasks to today, or clear them. */
export function CarryPlan({ taskIds }: { taskIds: string[] }) {
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  const all = (planned: boolean) =>
    startTransition(async () => {
      let failed = 0;
      for (const taskId of taskIds) if (!(await setTaskPlannedAction({ taskId, planned })).ok) failed++;
      notify(failed ? `${failed} could not be changed.` : planned ? `Moved ${taskIds.length} to today.` : `Cleared ${taskIds.length}.`);
    });
  return (
    <span className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => all(true)} className="app-btn mi-press h-9 rounded-[10px] px-3 text-sm font-medium disabled:opacity-60">
        Move to today
      </button>
      <button type="button" disabled={pending} onClick={() => all(false)} className="mi-press h-9 rounded-[10px] px-3 text-sm text-[#52525B] hover:bg-black/[0.05] disabled:opacity-60">
        Clear
      </button>
    </span>
  );
}
