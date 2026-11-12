"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setPreferencesAction } from "@/app/(app)/client-actions";
import { DONE_WINDOWS, LOCALE_OPTIONS, START_PAGES, type Preferences } from "@/lib/preferences";
import { WEIGHT_LEVELS } from "@/lib/weights";
import { useNotice } from "./notice";

type Key = keyof Preferences;

/** One preference as a select that saves on change and rolls back if the save fails. */
export function PreferenceSelect<K extends Key>({
  name,
  label,
  value: saved,
  options,
  message,
}: {
  name: K;
  label: string;
  value: Preferences[K];
  options: { value: Preferences[K]; label: string }[];
  message: (v: Preferences[K]) => string;
}) {
  const notify = useNotice();
  const [value, setValue] = React.useState(saved);
  const [pending, startTransition] = React.useTransition();
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label={label}
        value={String(value)}
        disabled={pending}
        onChange={(e) => {
          const next = options.find((o) => String(o.value) === e.target.value)?.value;
          if (next === undefined) return;
          const previous = value;
          setValue(next);
          startTransition(async () => {
            const r = await setPreferencesAction({ [name]: next });
            if (!r.ok) {
              setValue(previous);
              notify(r.error);
              return;
            }
            notify(message(next));
          });
        }}
        className="app-select h-11 max-w-[20rem] rounded-[14px] px-3 text-base"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {pending && <Loader2 aria-label="Saving…" className="size-4 animate-spin text-[#52525B]" />}
    </span>
  );
}

/** One preference row's control, by name. */
export function PreferenceField({ name, prefs, detected }: { name: Key; prefs: Preferences; detected: string }) {
  const controls: Record<Key, React.ReactNode> = {
    locale: (
      <PreferenceSelect
        name="locale"
        label="Language for dates and numbers"
        value={prefs.locale}
        options={[{ value: null, label: `From the browser (${detected})` }, ...LOCALE_OPTIONS.map(([value, label]) => ({ value, label }))]}
        message={(v) => (v ? `Dates and numbers in ${v}.` : "Dates and numbers follow the browser.")}
      />
    ),
    weekStart: (
      <PreferenceSelect
        name="weekStart"
        label="Week starts"
        value={prefs.weekStart}
        options={[
          { value: "monday", label: "Monday" },
          { value: "sunday", label: "Sunday" },
        ]}
        message={(v) => `Weeks start on ${v === "monday" ? "Monday" : "Sunday"}.`}
      />
    ),
    defaultWeight: (
      <PreferenceSelect
        name="defaultWeight"
        label="Default weight"
        value={prefs.defaultWeight}
        options={WEIGHT_LEVELS.map((w) => ({ value: w.value as 1 | 2 | 4 | 8, label: `${w.label}, +${w.value}` }))}
        message={(v) => `New tasks weigh +${v} unless they say otherwise.`}
      />
    ),
    startPage: (
      <PreferenceSelect
        name="startPage"
        label="Start page"
        value={prefs.startPage}
        options={(Object.keys(START_PAGES) as (keyof typeof START_PAGES)[]).map((k) => ({ value: k, label: START_PAGES[k] }))}
        message={(v) => `Signing in opens ${START_PAGES[v]}.`}
      />
    ),
    doneWindow: (
      <PreferenceSelect
        name="doneWindow"
        label="Done window on the board"
        value={prefs.doneWindow}
        options={DONE_WINDOWS.map((d) => ({ value: d, label: `${d} days` }))}
        message={(v) => `The board shows Done from the last ${v} days.`}
      />
    ),
    motion: (
      <PreferenceSelect
        name="motion"
        label="Background motion"
        value={prefs.motion}
        options={[
          { value: true, label: "On" },
          { value: false, label: "Off" },
        ]}
        message={(v) => (v ? "Background motion on." : "Background motion off.")}
      />
    ),
  };
  return <>{controls[name]}</>;
}
