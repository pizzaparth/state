"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setTaskPriorityAction, setTaskRecurrenceAction, setTaskWeightAction, type ActionResult } from "@/app/(app)/actions";
import { RECURRENCE_OPTIONS, recurrenceLabel } from "@/lib/recurrence";
import { PRIORITIES, type Priority } from "@/lib/validation";
import { WEIGHT_LEVELS, weightHint, weightLabel, type Weight } from "@/lib/weights";
import { useNotice } from "./notice";

/** Select in the task panel that saves on change and rolls back if the save fails. */
function InlineSelect<T extends string | number>({
  name,
  label,
  value: saved,
  options,
  save,
  savedMessage,
  describe,
}: {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  save: (value: T) => Promise<ActionResult<unknown>>;
  savedMessage: (value: T) => string;
  /** Help line under the select for the current value. */
  describe?: (value: T) => string;
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
  const hintId = `task-${name}-hint`;
  const describedBy = [describe && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          name={name}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
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
      {describe && (
        <p id={hintId} className="mt-1.5 text-sm leading-relaxed text-[#9A9A96]">
          {describe(value)}
        </p>
      )}
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

const WEIGHT_OPTIONS = WEIGHT_LEVELS.map((w) => ({ value: w.value as Weight, label: `${w.label}, ${w.value}` }));

/** Weight of an open task; completed tasks show it read-only (their commit fixed it). */
export function TaskWeight({ taskId, weight }: { taskId: string; weight: number }) {
  return (
    <InlineSelect
      name="weight"
      label="Weight"
      value={weight as Weight}
      options={WEIGHT_OPTIONS}
      save={(next) => setTaskWeightAction({ taskId, weight: next })}
      savedMessage={(next) => `Weight set to ${weightLabel(next).toLowerCase()}, ${next} execution.`}
      describe={weightHint}
    />
  );
}

/** How an open task repeats; finishing it queues the next one. */
export function TaskRecurrence({ taskId, rule }: { taskId: string; rule: string | null }) {
  const current = rule ?? "none";
  const options = [
    { value: "none", label: "Never" },
    ...RECURRENCE_OPTIONS,
    // An imported custom interval stays selectable
    ...(RECURRENCE_OPTIONS.some((o) => o.value === current) || current === "none" ? [] : [{ value: current, label: recurrenceLabel(current) }]),
  ];
  return (
    <InlineSelect
      name="recurrence"
      label="Repeats"
      value={current}
      options={options}
      save={(next) => setTaskRecurrenceAction({ taskId, rule: next === "none" ? null : next })}
      savedMessage={(next) => (next === "none" ? "Stops repeating." : `Repeats ${recurrenceLabel(next).toLowerCase()}. Done queues the next.`)}
    />
  );
}
