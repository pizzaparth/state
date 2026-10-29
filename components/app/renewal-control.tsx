"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setAutoRenewAction } from "@/app/(app)/actions";
import { useNotice } from "./notice";

/**
 * Auto-renew switch for the recurring subscription. Turning it off asks once inline
 * (access continues to the period end); turning it back on is a single click.
 */
export function RenewalControl({ renewing, endsLabel, canResume }: { renewing: boolean; endsLabel: string | null; canResume: boolean }) {
  const notify = useNotice();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = (renew: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await setAutoRenewAction({ renew });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      notify(renew ? "Auto-renew on" : `Auto-renew off${endsLabel ? ` · access to ${endsLabel}` : ""}`);
    });

  const button = "app-btn inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-base font-medium disabled:opacity-70";
  const spinner = pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />;

  return (
    <div className="space-y-2">
      {renewing ? (
        confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => submit(false)} className={button}>
              {spinner}
              Turn off auto-renew
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={button}>
              Keep it on
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={button}>
            Cancel auto-renew…
          </button>
        )
      ) : canResume ? (
        <button type="button" disabled={pending} onClick={() => submit(true)} className={button}>
          {spinner}
          Resume auto-renew
        </button>
      ) : null}
      {confirming && <p className="font-mono text-[12px] text-[#85857F]">No more charges. Access stays{endsLabel ? ` to ${endsLabel}` : " to the period end"}.</p>}
      <p aria-live="polite" className="text-sm text-[#F0A39B]">
        {error}
      </p>
    </div>
  );
}
