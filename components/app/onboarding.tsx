"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { addBoardTaskAction, finishOnboardingAction, moveTaskAction } from "@/app/(app)/actions";
import { addBoardTaskSchema } from "@/lib/validation";
import { WEIGHT_LEVELS, type Weight } from "@/lib/weights";
import { cn } from "@/lib/utils";
import { DISPLAY, TICK } from "./primitives";
import { NewOrganisation } from "./organisation-dialog";
import { useNotice } from "./notice";

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "next"; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-t border-white/[0.08] py-6 first:border-t-0 first:pt-0">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 place-items-center rounded-full font-mono text-sm tabular-nums",
          state === "done" ? "app-inverse" : state === "current" ? "app-card text-[#F2F2EF]" : "app-field text-[#85857F]"
        )}
      >
        {state === "done" ? "✓" : n}
      </span>
      <div className="min-w-0">
        <h2 className={cn("text-lg font-semibold", state === "next" ? "text-[#85857F]" : "text-[#F2F2EF]")}>
          {title}
          <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
        </h2>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </li>
  );
}

/** Leaves setup for Today, remembering that it was finished or skipped. */
function useFinish() {
  const router = useRouter();
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  const finish = () =>
    startTransition(async () => {
      const result = await finishOnboardingAction({});
      if (!result.ok) return notify(result.error);
      router.push("/platform/today" as Route);
    });
  return { finish, pending };
}

export function SkipSetup() {
  const { finish, pending } = useFinish();
  return (
    <button type="button" onClick={finish} disabled={pending} className="inline-flex min-h-9 items-center gap-1.5 text-sm text-[#9A9A96] underline-offset-4 hover:text-[#F2F2EF] hover:underline disabled:opacity-60">
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      Skip setup
    </button>
  );
}

/**
 * First-run setup (docs/state_desc.md §38): optional organisation, one task, then Done,
 * which records the first commit. Each step's state comes from the server's data.
 */
export function Onboarding({
  canCreateOrganisation,
  organisations,
  task,
  doneColumnId,
  commit,
}: {
  canCreateOrganisation: boolean;
  organisations: string[];
  task: { id: string; title: string; weight: number } | null;
  doneColumnId: string | null;
  commit: { message: string; executionValue: number } | null;
}) {
  const router = useRouter();
  const notify = useNotice();
  const { finish, pending: finishing } = useFinish();
  const [title, setTitle] = React.useState("");
  const [weight, setWeight] = React.useState<Weight>(2);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!task && !commit && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [task, commit]);

  const taskState = commit || task ? "done" : "current";
  const doneState = commit ? "done" : task ? "current" : "next";

  return (
    <ol>
      <Step n={1} title="Workspace" state="done">
        <p className="text-base text-[#9A9A96]">
          Personal{organisations.length > 0 && ` + ${organisations.join(", ")}`}
        </p>
        {canCreateOrganisation && organisations.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <NewOrganisation openAfter={false} />
            <span className="font-mono text-sm text-[#85857F]">optional · shared board + metrics</span>
          </div>
        )}
      </Step>

      <Step n={2} title="Plan one task" state={taskState}>
        {task || commit ? (
          <p className="text-base text-[#9A9A96]">
            <span className="text-[#F2F2EF]">{task?.title ?? commit?.message}</span> · +{task?.weight ?? commit?.executionValue} on done
          </p>
        ) : (
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const parsed = addBoardTaskSchema.safeParse({ title, weight });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Give the task a title.");
                inputRef.current?.focus();
                return;
              }
              startTransition(async () => {
                const result = await addBoardTaskAction(parsed.data);
                if (!result.ok) return setError(result.error);
                setError(null);
                router.refresh();
              });
            }}
          >
            <label htmlFor="first-task" className="sr-only">
              Task title
            </label>
            <input
              ref={inputRef}
              id="first-task"
              name="title"
              autoComplete="off"
              maxLength={500}
              value={title}
              onChange={(e) => (setTitle(e.target.value), setError(null))}
              placeholder="Read chapter 7, ship the login page…"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "first-task-error" : "first-task-hint"}
              className="app-input h-11 w-full rounded-[14px] px-3 text-base"
            />
            <fieldset>
              <legend className="sr-only">Weight</legend>
              <div className="app-field grid grid-cols-2 gap-1 rounded-[14px] p-1 sm:grid-cols-4">
                {WEIGHT_LEVELS.map((w) => (
                  <label
                    key={w.value}
                    className={cn(
                      "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-white",
                      weight === w.value ? "bg-[#F2F2EF] text-[#0A0A0A]" : "text-[#9A9A96] hover:text-[#F2F2EF]"
                    )}
                  >
                    <input type="radio" name="weight" value={w.value} checked={weight === w.value} onChange={() => setWeight(w.value as Weight)} className="sr-only" />
                    {w.label} <span className="font-mono tabular-nums">{w.value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p id="first-task-hint" className="font-mono text-sm text-[#85857F]">
                goes to your board · Queued
              </p>
              <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Add task
              </button>
            </div>
            {error && (
              <p id="first-task-error" aria-live="polite" className="text-sm text-[#F0A39B]">
                {error}
              </p>
            )}
          </form>
        )}
      </Step>

      <Step n={3} title="Finish it" state={doneState}>
        {commit ? (
          <div aria-live="polite">
            <p className="text-base text-[#F2F2EF]">Your first commit has been recorded.</p>
            <div className="app-inverse mt-4 flex items-baseline justify-between rounded-[20px] px-5 py-4">
              <span className={cn(TICK, "text-[#55554F]")}>Execution</span>
              <span className={cn(DISPLAY, "text-5xl leading-none tabular-nums")}>+{commit.executionValue}</span>
            </div>
            <p className="mt-2 font-mono text-sm text-[#85857F]">execution = Σ weights of done tasks</p>
            <button type="button" onClick={finish} disabled={finishing} className="app-btn mt-5 inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
              {finishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Open Today
            </button>
          </div>
        ) : task && doneColumnId ? (
          <>
            <p className="font-mono text-sm text-[#85857F]">done → commit, automatically</p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await moveTaskAction({ taskId: task.id, columnId: doneColumnId, afterTaskId: null });
                  if (!result.ok) return notify(result.error);
                  router.refresh();
                })
              }
              className="app-btn mt-3 inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Move to Done
            </button>
          </>
        ) : (
          <p className="font-mono text-sm text-[#85857F]">done → commit, automatically</p>
        )}
      </Step>
    </ol>
  );
}
