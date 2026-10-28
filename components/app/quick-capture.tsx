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
        className="neu-inset flex items-center gap-2 rounded-[18px] p-1.5 pl-4"
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
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#171717] placeholder:text-[#62625E] focus:outline-none max-md:text-base"
        />
        <button
          type="submit"
          disabled={!parsed?.title}
          className="neu-btn-raised inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 text-sm font-medium disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Capture
        </button>
      </form>

      <p aria-live="polite" className="mt-2 min-h-5 px-2 text-xs text-[#5F5F5B]">
        {parsed?.title && (
          <>
            Task <span className="font-medium text-[#171717]">“{parsed.title}”</span>
            {parsed.projectSlug && (project ? `, project ${project.name}` : `, unknown project #${parsed.projectSlug}`)}
            {parsed.priority && `, ${parsed.priority} priority`}
          </>
        )}
      </p>

      {captured.length > 0 && (
        <ul className="mt-2 space-y-1">
          {captured.map((c, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm">
              <span aria-hidden="true" className="neu-inset-sm size-3 rounded-full" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <span className="text-xs text-[#62625E]">{[c.project, c.priority].filter(Boolean).join(", ") || "Unsorted"}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5F5F5B]">Unsaved</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
