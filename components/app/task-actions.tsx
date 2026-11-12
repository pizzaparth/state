"use client";

import * as React from "react";
import { ArrowRight, Check, Copy, Loader2, Trash2 } from "lucide-react";
import { completeTaskAction, deleteTaskAction, duplicateTaskAction, placeTaskAction, restoreTaskAction } from "@/app/(app)/client-actions";
import type { BoardTarget } from "@/db/queries";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";
import { useClosePanel } from "./detail-drawer";
import { TICK } from "./primitives";


/**
 * Writes available from the task panel: Inbox triage onto a board, and delete with an
 * Undo window. Rendered only for viewers who can write to the task's workspace.
 */
export function TaskActions({
  task,
  targets,
}: {
  task: { id: string; title: string; completed: boolean; inInbox: boolean };
  /** Boards in the task's workspace; empty when the task is already on a board. */
  targets: BoardTarget[];
}) {
  const notify = useNotice();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"move" | "delete" | "copy" | "done" | null>(null);
  const [, startTransition] = React.useTransition();

  const defaultColumn = targets[0]?.columns.find((c) => c.stateType === "backlog")?.id ?? targets[0]?.columns[0]?.id ?? "";

  const closePanel = useClosePanel();

  const remove = () => {
    if (pending) return;
    setPending("delete");
    startTransition(async () => {
      const result = await deleteTaskAction({ taskId: task.id });
      setPending(null);
      if (!result.ok) return setError(result.error);
      closePanel();
      notify(`Deleted “${result.data.title}”.`, {
        label: "Undo",
        run: async () => {
          const restored = await restoreTaskAction({ taskId: task.id });
          notify(restored.ok ? `Restored “${restored.data.title}”.` : restored.error);
        },
      });
    });
  };

  return (
    <section aria-labelledby="task-actions-heading" className="mt-8 border-t border-black/[0.06] pt-6">
      <h3 id="task-actions-heading" className={cn(TICK, "text-[11px] text-[#71717A]")}>
        Actions
      </h3>

      {task.inInbox && !task.completed && targets.length > 0 && (
        <form
          className="mt-4 space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const columnId = String(new FormData(e.currentTarget).get("column") ?? "");
            if (!columnId || pending) return;
            setPending("move");
            startTransition(async () => {
              const result = await placeTaskAction({ taskId: task.id, columnId });
              setPending(null);
              if (!result.ok) return setError(result.error);
              setError(null);
              notify(`Moved “${task.title}” to ${result.data.boardName}, ${result.data.columnName}.`);
            });
          }}
        >
          <label htmlFor="task-move-column" className={cn(TICK, "text-[11px] text-[#71717A]")}>
            Move to board
          </label>
          <div className="flex gap-2">
            <select id="task-move-column" name="column" defaultValue={defaultColumn} className="app-select">
              {targets.map((b) => (
                <optgroup key={b.id} label={b.name}>
                  {b.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {targets.length > 1 ? `${b.name}, ${c.name}` : c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending !== null}
              className="app-btn inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium disabled:opacity-50"
            >
              {pending === "move" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              Move
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => {
            setPending("copy");
            startTransition(async () => {
              const r = await duplicateTaskAction({ taskId: task.id });
              setPending(null);
              if (!r.ok) return setError(r.error);
              notify(`Copied “${r.data.title}”.`);
            });
          }}
          className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium disabled:opacity-50"
        >
          {pending === "copy" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          Duplicate
        </button>
        {task.inInbox && !task.completed && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setPending("done");
              startTransition(async () => {
                const r = await completeTaskAction({ taskId: task.id });
                setPending(null);
                if (!r.ok) return setError(r.error);
                notify(`Logged as done. +${r.data.committed}.`);
              });
            }}
            className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium disabled:opacity-50"
          >
            {pending === "done" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            Log as done
          </button>
        )}
      </div>

      {task.completed ? (
        <p className="mt-3 font-mono text-[12px] text-[#71717A]">done = history · move out of Done to delete</p>
      ) : (
        <button
          type="button"
          onClick={remove}
          disabled={pending !== null}
          className="app-btn mt-4 inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium text-danger disabled:opacity-50"
        >
          {pending === "delete" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
          Delete
        </button>
      )}

      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-danger">
        {error}
      </p>
    </section>
  );
}
