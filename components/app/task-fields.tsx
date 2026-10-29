"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setTaskPriorityAction, setTaskWeightAction, type ActionResult } from "@/app/(app)/actions";
import { PRIORITIES, WEIGHTS, type Priority } from "@/lib/validation";
import { useNotice } from "./notice";

/** Select in the task panel that saves on change and rolls back if the save fails. */
function InlineSelect<T extends string | number>({
  name,
  label,
  value: saved,
  options,
  save,
  savedMessage,
}: {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  save: (value: T) => Promise<ActionResult<unknown>>;
  savedMessage: (value: T) => string;
}) {
  const notify = useNotice();
  const [value, setValue] = React.useState(saved);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Follow server updates (another tab, a revalidated save) without remounting
  const [serverValue, setServerValue] = React.useState(saved);
  if (saved !== serverValue) {
    setServerValue(saved);
    if (!pending) setValue(saved);
  }
  const errorId = `task-${name}-error`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          name={name}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={String(value)}
          disabled={pending}
          onChange={(e) => {
            const previous = value;
            const next = options.find((o) => String(o.value) === e.target.value)?.value;
            if (next === undefined) return;
            setValue(next);
            setError(null);
            startTransition(async () => {
              const result = await save(next);
              if (!result.ok) {
                setValue(previous);
                setError(result.error);
                return;
              }
              notify(savedMessage(next));
            });
          }}
          className="app-field h-9 min-w-0 rounded-[12px] bg-[#000000] px-2.5 text-base text-[#F2F2EF] focus:border-white/45 focus:outline-none disabled:opacity-60"
        >
          {options.map((o) => (
            <option key={o.value} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        {pending && <Loader2 className="size-4 animate-spin text-[#9A9A96]" aria-label="Saving…" />}
      </div>
      {error && (
        <p id={errorId} aria-live="polite" className="mt-1.5 text-sm text-[#F0A39B]">
          {error}
        </p>
      )}
    </div>
  );
}

const PRIORITY_LABEL: Record<Priority, string> = { none: "None", low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }));

export function TaskPriority({ taskId, priority }: { taskId: string; priority: string }) {
  return (
    <InlineSelect
      name="priority"
      label="Priority"
      value={priority as Priority}
      options={PRIORITY_OPTIONS}
      save={(next) => setTaskPriorityAction({ taskId, priority: next })}
      savedMessage={(next) => `Priority set to ${PRIORITY_LABEL[next].toLowerCase()}.`}
    />
  );
}

const WEIGHT_LABEL: Record<(typeof WEIGHTS)[number], string> = { 1: "Small", 2: "Normal", 4: "Major", 8: "Milestone" };
const WEIGHT_OPTIONS = WEIGHTS.map((w) => ({ value: w, label: `${WEIGHT_LABEL[w]}, ${w}` }));

/** Weight of an open task; completed tasks show it read-only (their commit fixed it). */
export function TaskWeight({ taskId, weight }: { taskId: string; weight: number }) {
  return (
    <InlineSelect
      name="weight"
      label="Weight"
      value={weight as (typeof WEIGHTS)[number]}
      options={WEIGHT_OPTIONS}
      save={(next) => setTaskWeightAction({ taskId, weight: next })}
      savedMessage={(next) => `Weight set to ${WEIGHT_LABEL[next].toLowerCase()}, ${next} execution.`}
    />
  );
}
