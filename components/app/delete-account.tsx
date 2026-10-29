"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { deleteAccountAction } from "@/app/(app)/actions";

type Field = "confirm" | "password";

/**
 * Permanent account deletion behind a dialog: the person types their email and, for
 * password accounts, their password. The server re-checks both (app/(app)/actions.ts).
 */
export function DeleteAccount({ email, needsPassword }: { email: string; needsPassword: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<Field | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const focus = (field: Field) => formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    const confirm = String(data.get("confirm") ?? "").trim();
    const password = needsPassword ? String(data.get("password") ?? "") : undefined;
    const next: typeof errors = {};
    if (confirm.toLowerCase() !== email.toLowerCase()) next.confirm = "Type your email exactly as shown.";
    if (needsPassword && !password) next.password = "Enter your password.";
    if (next.confirm || next.password) {
      setErrors(next);
      focus(next.confirm ? "confirm" : "password");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await deleteAccountAction({ confirm, password });
      if (result.ok) {
        // Full navigation: every cached product page belonged to the deleted account
        window.location.replace("/home");
        return;
      }
      if (result.field) {
        setErrors({ [result.field]: result.error });
        focus(result.field);
      } else setErrors({ form: result.error });
    });
  };

  const fieldError = (field: Field) =>
    errors[field] && (
      <p id={`delete-${field}-error`} className="text-sm text-[#F0A39B]">
        {errors[field]}
      </p>
    );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        setErrors({});
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="app-btn inline-flex h-10 items-center rounded-[12px] px-4 text-base font-medium text-[#F0A39B]">
          Delete account…
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            if (!window.matchMedia("(pointer: fine)").matches) e.preventDefault();
          }}
          className="fixed left-1/2 top-[10vh] z-50 max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[#0A0A0A] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Delete account</Dialog.Title>
          <Dialog.Description className="mt-1 text-base text-[#9A9A96]">
            Permanent. Tasks, commits, projects and history go now; the plan is cancelled. Export first.
          </Dialog.Description>

          <form ref={formRef} onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="delete-confirm" className="text-sm font-medium text-[#9A9A96]">
                Type <span className="font-mono text-[#F2F2EF]" translate="no">{email}</span>
              </label>
              <input
                id="delete-confirm"
                name="confirm"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? "delete-confirm-error" : undefined}
                placeholder={`${email}…`}
                className="app-input h-11 w-full rounded-[14px] px-3 text-base"
              />
              {fieldError("confirm")}
            </div>
            {needsPassword && (
              <div className="space-y-1.5">
                <label htmlFor="delete-password" className="text-sm font-medium text-[#9A9A96]">
                  Password
                </label>
                <input
                  id="delete-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "delete-password-error" : undefined}
                  className="app-input h-11 w-full rounded-[14px] px-3 text-base"
                />
                {fieldError("password")}
              </div>
            )}
            <p aria-live="polite" className="text-sm text-[#F0A39B]">
              {errors.form}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" disabled={pending} className="app-btn inline-flex h-10 items-center rounded-[12px] px-4 text-base font-medium">
                  Keep account
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#F0A39B]/50 bg-[#000] px-4 text-base font-semibold text-[#F0A39B] transition-colors hover:border-[#F0A39B] disabled:opacity-70"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Delete permanently
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
