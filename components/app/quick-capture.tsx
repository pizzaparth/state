"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { captureTaskAction } from "@/app/(app)/actions";
import { parseQuickCapture } from "@/lib/validation";
import { dayIn } from "@/lib/recurrence";
import { useNotice } from "./notice";

/**
 * One-field capture with a live preview of what the deterministic parser understood
 * (#project, !priority, due day). Saves to the Inbox; the field keeps its text if saving fails.
 */
export function QuickCapture({
  projects,
  tz,
  autoFocus = false,
  showRecent = true,
  placeholder = "Add a task… #project !high fri",
}: {
  /** Projects the person can capture to. */
  projects: { slug: string; name: string }[];
  /** The person's timezone, so "today" in the preview is the server's today. */
  tz: string;
  autoFocus?: boolean;
  /** List this session's captures under the field (off where the Inbox list is already shown). */
  showRecent?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = React.useState("");
  const [captured, setCaptured] = React.useState<{ id: string; title: string; project?: string; priority?: string }[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const notify = useNotice();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Desktop with a single primary input: focus it; leave mobile keyboards closed
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = value.trim() ? parseQuickCapture(value, dayIn(new Date(), tz)) : null;
  const slug = parsed?.projectSlug?.toLowerCase();
  const project = slug ? projects.find((p) => p.slug === slug) : undefined;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed?.title || pending) return;
          const text = value;
          startTransition(async () => {
            const result = await captureTaskAction({ text });
            if (!result.ok) {
              setError(result.error);
              inputRef.current?.focus();
              return;
            }
            setError(null);
            setValue("");
            setCaptured((c) => [{ id: result.data.id, title: result.data.title, project: result.data.projectName ?? undefined, priority: parsed.priority }, ...c].slice(0, 5));
            notify(`Captured “${result.data.title}” to Inbox.`);
          });
        }}
        className="app-field flex items-center gap-2 rounded-[18px] p-1.5 pl-4"
      >
        <label htmlFor="quick-capture" className="sr-only">
          Capture a task
        </label>
        <input
          ref={inputRef}
          id="quick-capture"
          name="task"
          autoComplete="off"
          value={value}
          onChange={(e) => (setValue(e.target.value), setError(null))}
          maxLength={500}
          aria-invalid={Boolean(error)}
          aria-describedby="quick-capture-status"
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-[#FFFFFF] placeholder:text-[#8E9AC0] focus:outline-none max-md:text-base"
        />
        <button
          type="submit"
          disabled={!parsed?.title || pending}
          className="app-btn inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 text-base font-medium disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          Capture
        </button>
      </form>

      <p id="quick-capture-status" aria-live="polite" className="mt-2 min-h-5 px-2 text-sm text-[#B4BEDB]">
        {error ? (
          <span className="text-[#F0A39B]">{error}</span>
        ) : parsed?.title && (
          <>
            Task <span className="font-medium text-[#FFFFFF]">“{parsed.title}”</span>
            {parsed.projectSlug && (project ? `, project ${project.name}` : `, unknown project #${parsed.projectSlug}`)}
            {parsed.priority && `, ${parsed.priority} priority`}
            {parsed.dueDate && `, due ${new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${parsed.dueDate}T00:00:00Z`))}`}
          </>
        )}
      </p>

      {showRecent && captured.length > 0 && (
        <ul className="mt-2 space-y-1">
          {captured.map((c) => (
            <li key={c.id} className="flex animate-row-in items-center gap-3 rounded-[12px] px-3 py-2 text-base">
              <span aria-hidden="true" className="app-field size-3 rounded-full" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <span className="text-sm text-[#8E9AC0]">{[c.project, c.priority].filter(Boolean).join(", ") || "Unsorted"}</span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#B4BEDB]">In Inbox</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
