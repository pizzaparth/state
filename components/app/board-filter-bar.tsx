"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { DUE_FILTERS, type BoardFilter } from "@/lib/board-filter";

const PRIORITY_LABEL: Record<string, string> = { none: "No priority", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/**
 * The board's find field, inside its toolbar (kanban.tsx). `F` focuses it. Weight,
 * priority and due filters live on each column. A link from another page can still
 * narrow the whole board (work, priority, tag, due); that shows as one chip that clears it.
 */
export function BoardFilterBar({
  filter,
  onChange,
  projects,
  textRef,
}: {
  filter: BoardFilter;
  onChange: (next: BoardFilter) => void;
  projects: { slug: string; name: string }[];
  textRef: React.RefObject<HTMLInputElement | null>;
}) {
  const linked = [
    filter.work && (projects.find((p) => p.slug === filter.work)?.name ?? filter.work),
    filter.priority && PRIORITY_LABEL[filter.priority],
    filter.tag && `#${filter.tag}`,
    filter.due && DUE_FILTERS[filter.due],
  ].filter((v): v is string => Boolean(v));
  return (
    <div role="search" aria-label="Find on the board" className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="app-field flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-3">
        <Search aria-hidden="true" className="size-4 shrink-0 text-[#4F5565]" />
        <span className="sr-only">Find a card</span>
        <input
          ref={textRef}
          type="search"
          name="q"
          value={filter.q ?? ""}
          onChange={(e) => onChange({ ...filter, q: e.target.value || undefined })}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange({ ...filter, q: undefined });
              e.currentTarget.blur();
            }
          }}
          placeholder="Find a card…"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0A0A0A] placeholder:text-[#4F5565] focus:outline-none"
        />
        <kbd aria-hidden="true" className="hidden rounded-[6px] bg-black/[0.05] px-1.5 font-mono text-[12px] text-[#4F5565] [@media(pointer:fine)]:inline">
          F
        </kbd>
      </label>
      {linked.length > 0 && (
        <button
          type="button"
          onClick={() => onChange({ q: filter.q })}
          aria-label={`Clear filter from link: ${linked.join(", ")}`}
          className="mi-press app-field inline-flex h-10 min-w-0 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-[#0A0A0A] hover:text-accent"
        >
          <span className="truncate">{linked.join(" · ")}</span>
          <X aria-hidden="true" className="size-4 shrink-0 text-[#4F5565]" />
        </button>
      )}
    </div>
  );
}
