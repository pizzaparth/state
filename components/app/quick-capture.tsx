"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { parseQuickCapture } from "@/lib/validation";
import { useLocalOnlyNotice } from "./notice";

/**
 * One-field capture with a live preview of what the deterministic parser understood
 * (#project, !priority). Captured items appear immediately in this session.
 */
export function QuickCapture({
  projects,
  autoFocus = false,
  placeholder = "Capture a task… (#project !high)",
}: {
  projects: { slug: string; name: string }[];
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = React.useState("");
  const [captured, setCaptured] = React.useState<{ title: string; project?: string; priority?: string }[]>([]);
  const notify = useLocalOnlyNotice();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Desktop with a single primary input: focus it; leave mobile keyboards closed
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = value.trim() ? parseQuickCapture(value) : null;
  const slug = parsed?.projectSlug?.toLowerCase();
  const project = slug ? projects.find((p) => p.slug === slug) : undefined;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed?.title) return;
          setCaptured((c) => [{ title: parsed.title, project: project?.name, priority: parsed.priority }, ...c]);
          setValue("");
          notify(`Captured “${parsed.title}”.`);
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
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-[#F2F2EF] placeholder:text-[#85857F] focus:outline-none max-md:text-base"
        />
        <button
          type="submit"
          disabled={!parsed?.title}
          className="app-btn inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 text-base font-medium disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Capture
        </button>
      </form>

      <p aria-live="polite" className="mt-2 min-h-5 px-2 text-sm text-[#9A9A96]">
        {parsed?.title && (
          <>
            Task <span className="font-medium text-[#F2F2EF]">“{parsed.title}”</span>
            {parsed.projectSlug && (project ? `, project ${project.name}` : `, unknown project #${parsed.projectSlug}`)}
            {parsed.priority && `, ${parsed.priority} priority`}
          </>
        )}
      </p>

      {captured.length > 0 && (
        <ul className="mt-2 space-y-1">
          {captured.map((c, i) => (
            <li key={captured.length - i} className="flex animate-row-in items-center gap-3 rounded-[12px] px-3 py-2 text-base">
              <span aria-hidden="true" className="app-field size-3 rounded-full" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <span className="text-sm text-[#85857F]">{[c.project, c.priority].filter(Boolean).join(", ") || "Unsorted"}</span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">Unsaved</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
