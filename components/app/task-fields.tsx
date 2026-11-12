"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { moveTaskAction, setTaskDeferAction, setTaskDescriptionAction, setTaskTagsAction, skipRecurrenceAction, setTaskDueAction, setTaskPriorityAction, setTaskProjectAction, setTaskRecurrenceAction, setTaskWeightAction, type ActionResult } from "@/app/(app)/client-actions";
import { cn } from "@/lib/utils";
import { RECURRENCE_OPTIONS, recurrenceLabel, ruleWeekdays } from "@/lib/recurrence";
import { checklistCount, checklistItems, toggleChecklistLine } from "@/lib/checklist";
import { PRIORITIES, type Priority } from "@/lib/validation";
import { WEIGHT_LEVELS, weightHint, weightLabel, type Weight } from "@/lib/weights";
import { useNotice } from "./notice";
import { currentLocale } from "@/lib/locale";

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
      notify(next === null ? "Due date cleared." : `Due ${new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${next}T00:00:00Z`))}.`);
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

// ------------------------------------------------------------------ description and checklist (C15)

/**
 * Notes for a task. Reads as text with "- [ ]" lines as checkboxes (ticking rewrites just
 * that line); click to edit. The editor grows with its text and saves on blur or
 * ⌘/Ctrl+Enter, showing "saved" in mono.
 */
export function TaskDescription({ taskId, description, editable }: { taskId: string; description: string | null; editable: boolean }) {
  const [text, setText] = React.useState(description ?? "");
  const [editing, setEditing] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [serverValue, setServerValue] = React.useState(description);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const savedText = React.useRef(description ?? "");
  if (description !== serverValue) {
    setServerValue(description);
    if (!editing && state !== "saving") {
      setText(description ?? "");
      savedText.current = description ?? "";
    }
  }

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  };
  React.useEffect(() => {
    if (editing) {
      grow();
      ref.current?.focus();
    }
  }, [editing]);

  const save = async (next: string) => {
    if (next === savedText.current) return true;
    setState("saving");
    const r = await setTaskDescriptionAction({ taskId, description: next });
    if (!r.ok) {
      setState("error");
      setError(r.error);
      return false;
    }
    savedText.current = next;
    setState("saved");
    setError(null);
    window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1800);
    return true;
  };

  const items = checklistItems(text);
  const count = checklistCount(text);

  if (editing) {
    return (
      <div data-drawer-escape>
        <label htmlFor="task-description" className="sr-only">
          Notes
        </label>
        <textarea
          ref={ref}
          id="task-description"
          value={text}
          maxLength={10_000}
          rows={3}
          onChange={(e) => (setText(e.target.value), grow(), setError(null))}
          onBlur={async () => {
            if (await save(text)) setEditing(false);
          }}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (await save(text)) setEditing(false);
            } else if (e.key === "Escape") {
              e.preventDefault();
              if (await save(text)) setEditing(false);
            }
          }}
          placeholder={"Notes…\n- [ ] a step"}
          className="app-input w-full resize-none rounded-[14px] px-3 py-2.5 text-[15px] leading-relaxed"
        />
        <p className="mt-1 font-mono text-[12px] text-[#71717A]" aria-live="polite">
          {state === "saving" ? "saving…" : error ? <span className="text-danger">{error}</span> : "- [ ] makes a checkbox · ⌘↵ or click away saves"}
        </p>
      </div>
    );
  }

  if (!text.trim()) {
    return editable ? (
      <button type="button" onClick={() => setEditing(true)} className="mt-3 rounded-[10px] px-0 font-mono text-[13px] text-[#71717A] hover:text-[#0A0A0A]">
        + Add notes…
      </button>
    ) : null;
  }

  const lines = text.split("\n");
  return (
    <div className="mt-3">
      {count && (
        <p className="mb-1.5 font-mono text-[12px] tabular-nums text-[#71717A]">
          checklist {count.done}/{count.total}
        </p>
      )}
      <div className="space-y-1 text-[15px] leading-relaxed text-[#52525B]">
        {lines.map((line, i) => {
          const item = items.find((x) => x.line === i);
          if (item) {
            return (
              <label key={i} className="flex cursor-pointer items-start gap-2.5 rounded-[8px] py-0.5 hover:bg-[#FAFAFA]">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!editable || state === "saving"}
                  onChange={async (e) => {
                    const next = toggleChecklistLine(text, i, e.target.checked);
                    setText(next);
                    if (!(await save(next))) setText(text);
                  }}
                  className="mt-1 size-4 shrink-0 accent-[#D92B74]"
                />
                <span className={cn("break-words", item.done && "text-[#71717A] line-through")}>{item.text || " "}</span>
              </label>
            );
          }
          return (
            <p key={i} className="min-h-[1em] whitespace-pre-wrap break-words">
              {line}
            </p>
          );
        })}
      </div>
      {editable && (
        <button type="button" onClick={() => setEditing(true)} className="mt-2 font-mono text-[12px] text-[#71717A] hover:text-[#0A0A0A]">
          edit notes{state === "saved" ? " · saved" : ""}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ tags (C16)

const splitTags = (text: string) =>
  [...new Set(text.split(",").map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))];

/** Comma-separated tags with suggestions from existing ones; saves on Enter or blur. */
export function TaskTags({ taskId, tags, suggestions }: { taskId: string; tags: string[]; suggestions: string[] }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(tags.join(", "));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const saved = React.useRef(tags.join(", "));
  const [serverValue, setServerValue] = React.useState(tags.join(","));
  if (tags.join(",") !== serverValue) {
    setServerValue(tags.join(","));
    if (!pending) {
      setValue(tags.join(", "));
      saved.current = tags.join(", ");
    }
  }
  const save = () => {
    const list = splitTags(value);
    if (list.join(", ") === splitTags(saved.current).join(", ")) return;
    startTransition(async () => {
      const r = await setTaskTagsAction({ taskId, tags: list });
      if (!r.ok) return setError(r.error);
      saved.current = list.join(", ");
      setValue(list.join(", "));
      setError(null);
      notify(list.length ? `Tags: ${list.join(", ")}.` : "Tags cleared.");
    });
  };
  const last = value.split(",").at(-1)?.trim().toLowerCase() ?? "";
  const hints = last ? suggestions.filter((t) => t.startsWith(last) && !splitTags(value).includes(t)).slice(0, 5) : [];
  return (
    <div className="-ml-2 min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <input
          aria-label="Tags"
          value={value}
          onChange={(e) => (setValue(e.target.value), setError(null))}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="reading, deep-work…"
          className="app-focus h-9 w-full min-w-0 rounded-[10px] border border-transparent bg-white px-[7px] text-base font-medium hover:border-black/[0.10]"
        />
        {pending && <Loader2 className="size-4 shrink-0 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {hints.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1.5 pl-[7px]">
          {hints.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setValue([...value.split(",").slice(0, -1).map((x) => x.trim()).filter(Boolean), t].join(", ") + ", ")}
              className="app-btn h-7 rounded-full px-2.5 font-mono text-[12px]"
            >
              {t}
            </button>
          ))}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ defer (C17)

/** "Not before" day with Clear: hidden from Today and greyed on the board until then. */
export function TaskDefer({ taskId, until, today }: { taskId: string; until: string | null; today: string }) {
  const notify = useNotice();
  const [value, setValue] = React.useState(until ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const save = (next: string | null) => {
    const previous = value;
    setValue(next ?? "");
    setError(null);
    startTransition(async () => {
      const r = await setTaskDeferAction({ taskId, until: next });
      if (!r.ok) {
        setValue(previous);
        setError(r.error);
        return;
      }
      notify(next ? `Waits until ${next}.` : "No longer deferred.");
    });
  };
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        <input
          type="date"
          aria-label="Not before"
          min={tomorrow}
          value={value}
          disabled={pending}
          onChange={(e) => (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? save(e.target.value) : setValue(e.target.value))}
          className="app-focus -ml-2 h-9 rounded-[10px] border border-transparent bg-white px-[7px] text-base font-medium hover:border-black/[0.10]"
        />
        {value ? (
          <button type="button" onClick={() => save(null)} disabled={pending} className="h-9 rounded-[10px] px-2 text-sm text-[#52525B] hover:bg-black/[0.04]">
            Clear
          </button>
        ) : (
          <button type="button" onClick={() => save(tomorrow)} disabled={pending} className="h-9 rounded-[10px] px-2 text-sm text-[#52525B] hover:bg-black/[0.04]">
            Tomorrow
          </button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ custom repeat (C18)

const WEEKDAY_BUTTONS = [
  [1, "M"],
  [2, "T"],
  [3, "W"],
  [4, "T"],
  [5, "F"],
  [6, "S"],
  [0, "S"],
] as const;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Every N days or weeks, or on chosen weekdays; plus Skip next for a repeating task. */
export function RepeatCustom({ taskId, rule }: { taskId: string; rule: string | null }) {
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  const interval = Number(rule?.match(/^interval:(\d+)$/)?.[1]) || 0;
  const [n, setN] = React.useState(interval ? (interval % 7 === 0 ? interval / 7 : interval) : 3);
  const [unit, setUnit] = React.useState<"days" | "weeks">(interval && interval % 7 === 0 ? "weeks" : "days");
  const [days, setDays] = React.useState<number[]>(ruleWeekdays(rule ?? ""));
  const apply = (next: string | null, message: string) =>
    startTransition(async () => {
      const r = await setTaskRecurrenceAction({ taskId, rule: next });
      notify(r.ok ? message : r.error);
    });
  return (
    <details className="mt-1.5 text-sm">
      <summary className="cursor-pointer font-mono text-[12px] text-[#71717A] hover:text-[#0A0A0A]">custom…</summary>
      <div className="mt-2 space-y-2">
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const total = unit === "weeks" ? n * 7 : n;
            if (!Number.isInteger(n) || n < 1 || total > 999) return notify("Pick 1 to 999 days.");
            apply(`interval:${total}`, `Repeats every ${n} ${unit}.`);
          }}
        >
          <span>Every</span>
          <input aria-label="Interval" inputMode="numeric" value={n} onChange={(e) => setN(Number(e.target.value) || 0)} className="app-input h-9 w-14 rounded-[10px] px-2 tabular-nums" />
          <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as "days" | "weeks")} className="app-select h-9 w-auto rounded-[10px] pl-2 text-sm">
            <option value="days">days</option>
            <option value="weeks">weeks</option>
          </select>
          <button type="submit" disabled={pending} className="app-btn h-9 rounded-[10px] px-3 font-medium">
            Set
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <span>On</span>
          <span role="group" aria-label="Weekdays" className="flex gap-1">
            {WEEKDAY_BUTTONS.map(([d, letter]) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                aria-label={WEEKDAY_NAMES[d]}
                onClick={() => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
                className={cn("grid size-8 place-items-center rounded-full text-[12px] font-semibold [@media(pointer:coarse)]:size-10", days.includes(d) ? "bg-[#0A0A0A] text-white" : "app-btn")}
              >
                {letter}
              </button>
            ))}
          </span>
          <button
            type="button"
            disabled={pending || days.length === 0}
            onClick={() => apply(`days:${[...days].sort().join(",")}`, "Repeats on the chosen days.")}
            className="app-btn h-9 rounded-[10px] px-3 font-medium disabled:opacity-50"
          >
            Set
          </button>
        </div>
      </div>
    </details>
  );
}

export function SkipNext({ taskId }: { taskId: string }) {
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await skipRecurrenceAction({ taskId });
          notify(r.ok ? `Skipped. Next due ${r.data.dueDay}.` : r.error);
        })
      }
      className="mt-1.5 font-mono text-[12px] text-[#71717A] hover:text-[#0A0A0A] disabled:opacity-50"
    >
      skip next →
    </button>
  );
}
