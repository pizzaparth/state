"use client";

import * as React from "react";
import { completeTaskAction, moveTaskAction } from "@/app/(app)/client-actions";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";

/**
 * The leading circle on a task: one click finishes the task and records its commit.
 * Shows done at once; a refused save restores it. The notice offers Undo, which reopens
 * the task in the column it came from (Queued for an Inbox task).
 */
export function CompleteButton({ taskId, title, done = false, className }: { taskId: string; title: string; done?: boolean; className?: string }) {
  const notify = useNotice();
  const [optimistic, setOptimistic] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const shown = done || optimistic;

  if (done) {
    return (
      <span className={cn("grid size-6 shrink-0 place-items-center", className)} title="Done">
        <span aria-hidden="true" className="mi-pop size-3 rounded-full bg-accent" />
        <span className="sr-only">Done</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Mark “${title}” done`}
      title="Mark done"
      disabled={pending || optimistic}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOptimistic(true);
        startTransition(async () => {
          const result = await completeTaskAction({ taskId });
          if (!result.ok) {
            setOptimistic(false);
            notify(result.error);
            return;
          }
          const back = result.data.previousColumnId ?? result.data.queuedColumnId;
          notify(
            `Done. +${result.data.committed}.${result.data.recurred ? " Next one queued." : ""}`,
            back
              ? {
                  label: "Undo",
                  run: async () => {
                    const undone = await moveTaskAction({ taskId, columnId: back, afterTaskId: null });
                    notify(undone.ok ? `Reopened “${result.data.title}”.` : undone.error);
                  },
                }
              : undefined
          );
        });
      }}
      className={cn(
        "group/done relative z-[2] grid size-6 shrink-0 place-items-center rounded-full [@media(pointer:coarse)]:size-11",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-3 rounded-full transition-[transform,background-color] duration-150",
          shown ? "mi-pop bg-accent" : "app-field border border-black/[0.10] group-hover/done:scale-125 group-hover/done:border-accent"
        )}
      />
    </button>
  );
}
