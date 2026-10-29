"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { deleteTaskAction, placeTaskAction, restoreTaskAction } from "@/app/(app)/actions";
import type { BoardTarget } from "@/db/queries";
import { useNotice } from "./notice";

const selectClass =
  "app-field h-11 w-full min-w-0 rounded-[14px] bg-[#000000] px-3 text-base text-[#F2F2EF] focus:border-white/45 focus:outline-none";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const notify = useNotice();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"move" | "delete" | null>(null);
  const [, startTransition] = React.useTransition();

  const defaultColumn = targets[0]?.columns.find((c) => c.stateType === "backlog")?.id ?? targets[0]?.columns[0]?.id ?? "";

  const closePanel = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("task");
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
  };

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
    <section aria-labelledby="task-actions-heading" className="mt-8 border-t border-white/[0.08] pt-6">
      <h3 id="task-actions-heading" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">
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
          <label htmlFor="task-move-column" className="text-sm font-medium text-[#9A9A96]">
            Move to board
          </label>
          <div className="flex gap-2">
            <select id="task-move-column" name="column" defaultValue={defaultColumn} className={selectClass}>
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

      {task.completed ? (
        <p className="mt-3 text-sm leading-relaxed text-[#9A9A96]">
          Completed tasks are part of your history. To delete this one, move it out of Done on its board first.
        </p>
      ) : (
        <button
          type="button"
          onClick={remove}
          disabled={pending !== null}
          className="app-btn mt-4 inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium text-[#F0A39B] disabled:opacity-50"
        >
          {pending === "delete" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
          Delete task
        </button>
      )}

      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-[#F0A39B]">
        {error}
      </p>
    </section>
  );
}
