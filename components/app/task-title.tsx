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

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <h2 className={`${headingClass} min-w-0 flex-1 break-words`}>{shown}</h2>
        <button
          ref={renameRef}
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename task…"
          title="Rename…"
          className="app-btn -mt-0.5 grid size-9 shrink-0 place-items-center rounded-full"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <form
      data-drawer-escape
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
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
      }}
    >
      <label htmlFor="task-title" className="sr-only">
        Task title
      </label>
      <input
        ref={inputRef}
        id="task-title"
        name="title"
        defaultValue={shown}
        maxLength={500}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "task-title-error" : undefined}
        onChange={(e) => (setDirty(e.target.value.trim() !== shown), setError(null))}
        onKeyDown={(e) => {
          if (e.key === "Escape") stop();
        }}
        className="app-input h-12 w-full rounded-[14px] px-3 text-xl font-semibold tracking-[-0.01em]"
      />
      {error && (
        <p id="task-title-error" aria-live="polite" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="app-btn inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-base font-medium disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
        <button type="button" onClick={stop} disabled={pending} className="inline-flex h-10 items-center rounded-[12px] px-4 text-base text-[#52525B] hover:text-[#0A0A0A] disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
