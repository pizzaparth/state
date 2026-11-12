"use client";

import * as React from "react";
import { Loader2, Pencil } from "lucide-react";
import { renameTaskAction } from "@/app/(app)/actions";
import { useNotice } from "./notice";

// Display face without caps: task titles are user text and can run long
const headingClass = "font-sans text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.04em] text-[#0A0A0A]";

/**
 * Task panel heading with an inline Rename… form. Enter saves, Escape cancels without
 * closing the panel (the drawer skips Escape inside [data-drawer-escape]).
 */
export function TaskTitle({ taskId, title, editable }: { taskId: string; title: string; editable: boolean }) {
  const notify = useNotice();
  const [editing, setEditing] = React.useState(false);
  const [shown, setShown] = React.useState(title);
  // Follow server updates (another tab, a revalidated save) without remounting, so focus stays put
  const [serverTitle, setServerTitle] = React.useState(title);
  if (title !== serverTitle) {
    setServerTitle(title);
    if (!editing) setShown(title);
  }
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const renameRef = React.useRef<HTMLButtonElement>(null);
  const restoreFocus = React.useRef(false);
  const cancelling = React.useRef(false);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      renameRef.current?.focus();
    }
  }, [editing]);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const stop = () => {
    restoreFocus.current = true;
    setEditing(false);
    setDirty(false);
    setError(null);
  };

  if (!editable) return <h2 className={headingClass}>{shown}</h2>;

  const save = () => {
    if (pending) return;
    const next = (inputRef.current?.value ?? "").trim();
    if (!next) {
      setError("Give the task a title.");
      inputRef.current?.focus();
      return;
    }
    if (next === shown) return stop();
    startTransition(async () => {
      const result = await renameTaskAction({ taskId, title: next });
      if (!result.ok) {
        setError(result.error);
        inputRef.current?.focus();
        return;
      }
      setShown(result.data.title);
      stop();
      notify("Title saved.");
    });
  };

  if (!editing) {
    // The heading itself is the control: click (or Enter) to edit; the pencil is the hint
    return (
      <button
        ref={renameRef}
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${shown}. Rename task…`}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-[12px] px-2 py-1 text-left transition-colors duration-150 hover:bg-[#FAFAFA]"
      >
        <span className={`${headingClass} min-w-0 flex-1 break-words`}>{shown}</span>
        <span aria-hidden="true" className="app-btn mt-0.5 grid size-9 shrink-0 place-items-center rounded-full opacity-60 transition-opacity group-hover:opacity-100">
          <Pencil className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <form
      data-drawer-escape
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="task-title" className="sr-only">
        Task title
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="task-title"
          name="title"
          defaultValue={shown}
          maxLength={500}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "task-title-error" : "task-title-hint"}
          onChange={(e) => (setDirty(e.target.value.trim() !== shown), setError(null))}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancelling.current = true;
              stop();
            }
          }}
          onBlur={() => {
            if (cancelling.current) {
              cancelling.current = false;
              return;
            }
            if (!error) save();
          }}
          className="app-input h-12 w-full rounded-[14px] px-3 pr-10 text-xl font-semibold tracking-[-0.01em]"
        />
        {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {error ? (
        <p id="task-title-error" aria-live="polite" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id="task-title-hint" className="mt-1.5 font-mono text-[12px] text-[#71717A]">
          enter or click away saves · esc cancels
        </p>
      )}
    </form>
  );
}
