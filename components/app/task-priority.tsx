"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setTaskPriorityAction } from "@/app/(app)/actions";
import { PRIORITIES, type Priority } from "@/lib/validation";
import { useNotice } from "./notice";

const LABEL: Record<Priority, string> = { none: "None", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/** Priority select in the task panel. Saves on change; rolls back if the save fails. */
export function TaskPriority({ taskId, priority }: { taskId: string; priority: string }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(priority);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Follow server updates (another tab, a revalidated save) without remounting
  const [serverPriority, setServerPriority] = React.useState(priority);
  if (priority !== serverPriority) {
    setServerPriority(priority);
    if (!pending) setValue(priority);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          name="priority"
          aria-label="Priority"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "task-priority-error" : undefined}
          value={value}
          disabled={pending}
          onChange={(e) => {
            const previous = value;
            const next = e.target.value as Priority;
            setValue(next);
            setError(null);
            startTransition(async () => {
              const result = await setTaskPriorityAction({ taskId, priority: next });
              if (!result.ok) {
                setValue(previous);
                setError(result.error);
                return;
              }
              notify(`Priority set to ${LABEL[next].toLowerCase()}.`);
            });
          }}
          className="app-field h-9 min-w-0 rounded-[12px] bg-[#000000] px-2.5 text-base text-[#F2F2EF] focus:border-white/45 focus:outline-none disabled:opacity-60"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {LABEL[p]}
            </option>
          ))}
        </select>
        {pending && <Loader2 className="size-4 animate-spin text-[#9A9A96]" aria-label="Saving…" />}
      </div>
      {error && (
        <p id="task-priority-error" aria-live="polite" className="mt-1.5 text-sm text-[#F0A39B]">
          {error}
        </p>
      )}
    </div>
  );
}
