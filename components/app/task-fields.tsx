"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { moveTaskAction, setTaskDueAction, setTaskPriorityAction, setTaskProjectAction, setTaskRecurrenceAction, setTaskWeightAction, type ActionResult } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
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
        <div className="relative -ml-2 inline-flex min-w-0 max-w-[16rem] flex-1">
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
            // appearance-none drops the native inset, so the text lines up with read-only values
            className="peer h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-[10px] border border-transparent bg-white py-0 pl-[7px] pr-8 text-base font-medium text-[#0A0A0A] transition-colors duration-150 app-focus hover:border-black/[0.10] disabled:cursor-default disabled:opacity-60"
          >
            {options.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#71717A] transition-colors duration-150 peer-hover:text-[#0A0A0A]" />
        </div>
        {pending && <Loader2 className="size-4 shrink-0 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {describe && (
        <p id={hintId} className="mt-1.5 text-sm leading-relaxed text-[#52525B]">
          {describe(value)}
        </p>
      )}
      {error && (
        <p id={errorId} aria-live="polite" className="mt-1.5 text-sm text-danger">
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

/**
 * Project a task is filed under. Lists the live projects in the task's workspace; an
 * archived current project stays selectable so the select never shows the wrong one.
 */
export function TaskProject({
  taskId,
  projectId,
  projectName,
  projects,
}: {
  taskId: string;
  projectId: string | null;
  projectName: string | null;
  projects: { id: string; name: string }[];
}) {
  const current = projectId ?? "";
  const options = [
    { value: "", label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
    ...(projectId && !projects.some((p) => p.id === projectId) ? [{ value: projectId, label: projectName ?? "Archived project" }] : []),
  ];
  const nameOf = (id: string) => options.find((o) => o.value === id)?.label ?? "project";
  return (
    <InlineSelect
      name="project"
      label="Project"
      value={current}
      options={options}
      save={(next) => setTaskProjectAction({ taskId, projectId: next || null })}
      savedMessage={(next) => (next ? `Filed under ${nameOf(next)}.` : "Removed from its project.")}
    />
  );
}

/**
 * Where a board task stands, as a segmented control of its board's columns. Picking a
 * column moves the task to the top of it (Done records the commit; leaving Done reopens).
 */
export function TaskStatus({ taskId, columnId, columns }: { taskId: string; columnId: string | null; columns: { id: string; name: string; stateType: string }[] }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(columnId);
  const [pending, startTransition] = React.useTransition();
  const [serverValue, setServerValue] = React.useState(columnId);
  if (columnId !== serverValue) {
    setServerValue(columnId);
    if (!pending) setValue(columnId);
  }
  return (
    <div role="radiogroup" aria-label="Status" className="app-field inline-flex max-w-full flex-wrap gap-1 rounded-full p-1">
      {columns.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => {
              if (active) return;
              const previous = value;
              setValue(c.id);
              startTransition(async () => {
                const result = await moveTaskAction({ taskId, columnId: c.id, afterTaskId: null });
                if (!result.ok) {
                  setValue(previous);
                  notify(result.error);
                  return;
                }
                notify(
                  result.data.committed > 0
                    ? `Done. +${result.data.committed}.${result.data.recurred ? " Next one queued." : ""}`
                    : result.data.reopened
                      ? "Reopened. Its commit was withdrawn."
                      : `Moved to ${c.name}.`
                );
              });
            }}
            className={cn(
              "mi-press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-colors duration-150 disabled:cursor-default [@media(pointer:coarse)]:h-11",
              active ? (c.stateType === "done" ? "bg-accent text-white" : "bg-[#0A0A0A] text-white") : "text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A]"
            )}
          >
            {active && pending && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Due date that saves on change, with Clear. The day is the viewer's own; the server
 * stores 23:59 of it in their time zone.
 */
export function TaskDue({ taskId, due }: { taskId: string; due: string | null }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(due ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [serverValue, setServerValue] = React.useState(due);
  if (due !== serverValue) {
    setServerValue(due);
    if (!pending) setValue(due ?? "");
  }
  const save = (next: string | null) => {
    const previous = value;
    setValue(next ?? "");
    setError(null);
    startTransition(async () => {
      const result = await setTaskDueAction({ taskId, dueDate: next });
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
        return;
      }
      notify(next === null ? "Due date cleared." : `Due ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${next}T00:00:00Z`))}.`);
    });
  };
  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          name="due"
          aria-label="Due date"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "task-due-error" : undefined}
          value={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            // Partial dates while typing are left alone until they are complete
            if (/^\d{4}-\d{2}-\d{2}$/.test(next)) save(next);
            else setValue(next);
          }}
          className="app-focus -ml-2 h-9 min-w-0 rounded-[10px] border border-transparent bg-white px-[7px] text-base font-medium text-[#0A0A0A] hover:border-black/[0.10]"
        />
        {value && (
          <button type="button" onClick={() => save(null)} disabled={pending} className="h-9 rounded-[10px] px-2 text-sm text-[#52525B] hover:bg-black/[0.04] hover:text-[#0A0A0A] disabled:opacity-50">
            Clear
          </button>
        )}
        {pending && <Loader2 className="size-4 shrink-0 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {error && (
        <p id="task-due-error" aria-live="polite" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
