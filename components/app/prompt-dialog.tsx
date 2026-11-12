"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";

/**
 * One-field dialog for small edits ("Rename…", "Limit…"). Enter saves; the field keeps
 * its text and shows the error inline when saving fails.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initial,
  inputMode,
  placeholder,
  hint,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initial: string;
  inputMode?: "text" | "numeric";
  placeholder?: string;
  hint?: string;
  submitLabel?: string;
  /** Returns an error message, or null when saved. */
  onSubmit: (value: string) => Promise<string | null>;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (setError(null), onOpenChange(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="app-overlay fixed left-1/2 top-[18vh] z-50 w-[min(24rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overscroll-contain rounded-[24px] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
          <form
            noValidate
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const value = (inputRef.current?.value ?? "").trim();
              startTransition(async () => {
                const message = await onSubmit(value);
                if (message) {
                  setError(message);
                  inputRef.current?.focus();
                  return;
                }
                onOpenChange(false);
              });
            }}
          >
            <label htmlFor={id} className="text-sm font-medium text-[#52525B]">
              {label}
            </label>
            <input
              ref={inputRef}
              id={id}
              name="value"
              defaultValue={initial}
              autoFocus
              autoComplete="off"
              inputMode={inputMode}
              placeholder={placeholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
              onChange={() => setError(null)}
              className="app-input h-11 w-full rounded-[14px] px-3 text-base"
            />
            {hint && !error && (
              <p id={`${id}-hint`} className="font-mono text-[12px] text-[#71717A]">
                {hint}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} aria-live="polite" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close className="app-btn h-10 rounded-[12px] px-4 text-base font-medium">Cancel</Dialog.Close>
              <button type="submit" disabled={pending} className="app-inverse inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-base font-semibold disabled:opacity-70">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
