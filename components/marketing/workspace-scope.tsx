"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Person = { initials: string; name: string };

interface DemoTask {
  id: string;
  title: string;
  project: string;
  weight: 1 | 2 | 4 | 8;
  column: number;
  assignee?: Person;
}

const WEIGHT_LABEL = { 1: "small", 2: "normal", 4: "major", 8: "milestone" } as const;

const AARAV = { initials: "AK", name: "Aarav" };
const ISHITA = { initials: "IS", name: "Ishita" };
const PARTH = { initials: "PK", name: "Parth" };

const SCOPES = {
  personal: {
    label: "Personal",
    audience: "For one person tracking their own work.",
    facts: [
      "A private board, ready the moment you subscribe",
      "Three steps: Backlog, Active, Done",
      "Every finished task adds to your own history and metrics",
      "Nothing to set up",
    ],
    columns: ["Backlog", "Active", "Done"],
    tasks: [
      { id: "p1", title: "Read chapter 7 of OS", project: "University", weight: 1, column: 0 },
      { id: "p2", title: "Update documentation", project: "State", weight: 2, column: 0 },
      { id: "p3", title: "Finish query parser", project: "RelayDB", weight: 4, column: 1 },
      { id: "p4", title: "Review paper", project: "Research", weight: 2, column: 1 },
      { id: "p5", title: "API schema", project: "State", weight: 2, column: 2 },
    ] as DemoTask[],
  },
  organisation: {
    label: "Organisation",
    audience: "For a team working on shared projects.",
    facts: [
      "Shared boards for every project",
      "A Review step before work counts as done",
      "Tasks assigned to teammates",
      "Team metrics that show progress, never rankings",
    ],
    columns: ["Backlog", "Active", "Review", "Done"],
    tasks: [
      { id: "o1", title: "Rate limiting", project: "API", weight: 2, column: 0, assignee: AARAV },
      { id: "o2", title: "Billing export", project: "State", weight: 4, column: 0, assignee: ISHITA },
      { id: "o3", title: "As-of join tests", project: "RelayDB", weight: 2, column: 1, assignee: PARTH },
      { id: "o4", title: "Auth middleware", project: "State", weight: 2, column: 2, assignee: ISHITA },
      { id: "o5", title: "Temporal indexing", project: "RelayDB", weight: 8, column: 3, assignee: PARTH },
    ] as DemoTask[],
  },
} as const;

type Scope = keyof typeof SCOPES;

function initialState() {
  return {
    personal: SCOPES.personal.tasks.map((t) => ({ ...t })),
    organisation: SCOPES.organisation.tasks.map((t) => ({ ...t })),
  };
}

/**
 * Explains the two workspace types with a small working board: clicking a task moves
 * it one column right, and reaching Done records a commit — the product's core idea,
 * learned by doing it.
 */
export function WorkspaceScope() {
  const [scope, setScope] = React.useState<Scope>("personal");
  const [tasks, setTasks] = React.useState(initialState);
  const [lastCommit, setLastCommit] = React.useState<string | null>(null);

  const config = SCOPES[scope];
  const doneColumn = config.columns.length - 1;
  const scopeTasks = tasks[scope];
  const committed = scopeTasks.filter((t) => t.column === doneColumn);
  const execution = committed.reduce((sum, t) => sum + t.weight, 0);
  const changed = JSON.stringify(scopeTasks) !== JSON.stringify(SCOPES[scope].tasks);

  const advance = (id: string) => {
    const task = scopeTasks.find((t) => t.id === id);
    if (!task || task.column >= doneColumn) return;
    const nextColumn = task.column + 1;
    setTasks((prev) => ({
      ...prev,
      [scope]: prev[scope].map((t) => (t.id === id ? { ...t, column: nextColumn } : t)),
    }));
    setLastCommit(nextColumn === doneColumn ? `“${task.title}” committed, +${task.weight} execution.` : null);
  };

  const reset = () => {
    setTasks((prev) => ({ ...prev, [scope]: SCOPES[scope].tasks.map((t) => ({ ...t })) }));
    setLastCommit(null);
  };

  return (
    <div className="space-y-14">
      {/* Who it is for and what you get; the board below gets the full width */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <div role="radiogroup" aria-label="Workspace type" className="inline-flex rounded-full border border-white/[0.12] p-1">
            {(Object.keys(SCOPES) as Scope[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={scope === key}
                onClick={() => {
                  setScope(key);
                  setLastCommit(null);
                }}
                className={cn(
                  "h-10 min-w-[7.5rem] rounded-full px-4 text-base transition-[background-color,color]",
                  scope === key ? "bg-[#F1F1EE] font-semibold text-[#090909]" : "text-[#A9A9A6] hover:text-white"
                )}
              >
                {SCOPES[key].label}
              </button>
            ))}
          </div>

          <p className="mt-8 text-xl leading-snug text-[#F4F4F2]">{config.audience}</p>
        </div>
        <ul className="grid gap-x-10 gap-y-3 self-end text-base text-[#A9A9A6] sm:grid-cols-2">
          {config.facts.map((fact) => (
            <li key={fact} className="flex gap-3">
              <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-[0.4em] size-3 shrink-0 text-[#F4F4F2]">
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {fact}
            </li>
          ))}
        </ul>
      </div>

      {/* Working example board */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-base text-[#F4F4F2]">
            Try it: <span className="text-[#A9A9A6]">click a task to move it one step right.</span>
          </p>
          {changed && (
            <button type="button" onClick={reset} className="text-sm text-[#A9A9A6] underline underline-offset-4 hover:text-white">
              Reset example
            </button>
          )}
        </div>

        <div
          className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:[grid-template-columns:var(--board-cols)]"
          style={{ "--board-cols": `repeat(${config.columns.length}, minmax(0, 1fr))` } as React.CSSProperties}
        >
          {config.columns.map((name, columnIndex) => {
            const columnTasks = scopeTasks.filter((t) => t.column === columnIndex);
            const isDone = columnIndex === doneColumn;
            return (
              <div key={name} className="min-w-0">
                <p className="flex items-baseline justify-between border-b border-white/[0.12] pb-2 text-sm">
                  <span className={isDone ? "text-[#F4F4F2]" : "text-[#A9A9A6]"}>
                    {name}
                    {!isDone && (
                      <span aria-hidden="true" className="ml-2 text-[#6F6F6B]">
                        →
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-[#6F6F6B]">{columnTasks.length}</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {columnTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        disabled={isDone}
                        onClick={() => advance(task.id)}
                        aria-label={
                          isDone
                            ? `${task.title}, done and committed`
                            : `${task.title}. Move to ${config.columns[columnIndex + 1]}`
                        }
                        className={cn(
                          "group flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                          isDone ? "cursor-default" : "hover:bg-white/[0.05]"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 size-2.5 shrink-0 rounded-full",
                            isDone ? "bg-[#F4F4F2]" : "border border-white/50 group-hover:border-white"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-[#E4E4E1]">{task.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-[#6F6F6B]">
                            <span>
                              {task.project}, {WEIGHT_LABEL[task.weight]}
                            </span>
                            {isDone && <span className="shrink-0 font-mono tabular-nums text-[#A9A9A6]">+{task.weight}</span>}
                          </span>
                        </span>
                        {task.assignee && (
                          <span
                            title={task.assignee.name}
                            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-white/20 text-[11px] font-semibold text-[#D6D6D3]"
                          >
                            <span aria-hidden="true">{task.assignee.initials}</span>
                            <span className="sr-only">Assigned to {task.assignee.name}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {columnTasks.length === 0 && <li className="px-2 py-2.5 text-sm text-[#4A4A47]">Empty</li>}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-white/[0.12] pt-4 text-base">
          <p className="text-[#A9A9A6]">
            Commits recorded <span className="ml-2 font-semibold tabular-nums text-[#F4F4F2]">{committed.length}</span>
          </p>
          <p className="text-[#A9A9A6]">
            Execution <span className="ml-2 font-semibold tabular-nums text-[#F4F4F2]">{execution}</span>
          </p>
          <p aria-live="polite" className="text-[#F4F4F2]">
            {lastCommit}
          </p>
        </div>
      </div>
    </div>
  );
}
