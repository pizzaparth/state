"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setTimezoneAction } from "@/app/(app)/actions";
import { useNotice } from "./notice";

/** The browser's own zone, read after mount (the server cannot know it). */
export function useDeviceZone(): string | null {
  const [zone, setZone] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      setZone(null);
    }
  }, []);
  return zone;
}

/** Time zone select that saves on change, plus a one-tap "use this device" button. */
export function TimezoneField({ timezone, zones }: { timezone: string; zones: string[] }) {
  const notify = useNotice();
  const device = useDeviceZone();
  const [value, setValue] = React.useState(timezone);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [serverValue, setServerValue] = React.useState(timezone);
  if (timezone !== serverValue) {
    setServerValue(timezone);
    if (!pending) setValue(timezone);
  }

  const save = (next: string) => {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setTimezoneAction({ timezone: next });
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
        return;
      }
      notify(result.data.moved > 0 ? `Time zone set to ${next}. ${result.data.moved} due dates kept their day.` : `Time zone set to ${next}.`);
    });
  };

  const options = zones.includes(value) ? zones : [value, ...zones];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="timezone"
          aria-label="Time zone"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "timezone-error" : undefined}
          value={value}
          disabled={pending}
          onChange={(e) => save(e.target.value)}
          className="app-select h-11 min-w-0 max-w-full flex-1 rounded-[14px] px-3 text-base sm:max-w-[20rem]"
        >
          {options.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {pending && <Loader2 className="size-4 animate-spin text-[#52525B]" aria-label="Saving…" />}
      </div>
      {device && device !== value && (
        <button type="button" onClick={() => save(device)} disabled={pending} className="app-btn mi-press inline-flex h-10 items-center rounded-[12px] px-3 text-sm font-medium disabled:opacity-60">
          Use this device: <span className="ml-1 font-mono" translate="no">{device}</span>
        </button>
      )}
      {error && (
        <p id="timezone-error" aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
