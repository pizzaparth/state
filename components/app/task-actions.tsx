"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, CalendarCheck, Loader2, Trash2 } from "lucide-react";
import { deleteTaskAction, placeTaskAction, restoreTaskAction, setTaskDueAction } from "@/app/(app)/actions";
import type { BoardTarget } from "@/db/queries";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";
import { TICK } from "./primitives";

const selectClass =
  "app-field h-11 w-full min-w-0 rounded-[14px] bg-white px-3 text-base text-[#0A0A0A] focus:border-black/40 focus:outline-none";

/**
 * Writes available from the task panel: Inbox triage onto a board, and delete with an
 * Undo window. Rendered only for viewers who can write to the task's workspace.
 */
export function TaskActions({
  task,
  targets,
}: {
  /** `due` is the due day (YYYY-MM-DD) in the viewer's timezone. */
  task: { id: string; title: string; completed: boolean; inInbox: boolean; due: string | null };
  /** Boards in the task's workspace; empty when the task is already on a board. */
  targets: BoardTarget[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const notify = useNotice();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"due" | "clear" | "move" | "delete" | null>(null);
  const dueRef = React.useRef<HTMLInputElement>(null);
  const [, startTransition] = React.useTransition();

  const defaultColumn = targets[0]?.columns.find((c) => c.stateType === "backlog")?.id ?? targets[0]?.columns[0]?.id ?? "";

  const closePanel = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("task");
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
  };

  const saveDue = (dueDate: string | null) => {
    if (pending) return;
    if (dueDate === "") {
      setError("Pick a date.");
      dueRef.current?.focus();
      return;
    }
    setPending(dueDate === null ? "clear" : "due");
    startTransition(async () => {
      const result = await setTaskDueAction({ taskId: task.id, dueDate });
      setPending(null);
      if (!result.ok) {
        setError(result.error);
        dueRef.current?.focus();
        return;
      }
      setError(null);
      notify(dueDate === null ? "Due date cleared." : `Due ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dueDate}T00:00:00Z`))}.`);
    });
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
    <section aria-labelledby="task-actions-heading" className="mt-8 border-t border-black/[0.05] pt-6">
      <h3 id="task-actions-heading" className={cn(TICK, "text-[#52525B]")}>
        Actions
      </h3>

      {!task.completed && (
        <form
          className="mt-4 space-y-1.5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            saveDue(dueRef.current?.value ?? "");
          }}
        >
          <label htmlFor="task-due" className={cn(TICK, "text-[11px] text-[#71717A]")}>
            Due
          </label>
          <div className="flex gap-2">
            {/* Keyed by the saved day so a save or another tab's change resets the field */}
            <input
              key={task.due ?? "none"}
              ref={dueRef}
              id="task-due"
              name="due"
              type="date"
              defaultValue={task.due ?? ""}
              className="app-input h-11 w-full min-w-0 rounded-[14px] px-3 text-base"
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="app-btn inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium disabled:opacity-50"
            >
              {pending === "due" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarCheck className="size-4" aria-hidden="true" />}
              Set
            </button>
            {task.due && (
              <button
                type="button"
                onClick={() => saveDue(null)}
                disabled={pending !== null}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] px-3 text-base text-[#52525B] hover:text-[#0A0A0A] disabled:opacity-50"
              >
                {pending === "clear" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Clear
              </button>
            )}
          </div>
        </form>
      )}

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
        <p className="mt-3 font-mono text-[12px] text-[#71717A]">done = history · move out of Done to delete</p>
      ) : (
        <button
          type="button"
          onClick={remove}
          disabled={pending !== null}
          className="app-btn mt-4 inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-base font-medium text-[#B42318] disabled:opacity-50"
        >
          {pending === "delete" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
          Delete
        </button>
      )}

      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-[#B42318]">
        {error}
      </p>
    </section>
  );
}
