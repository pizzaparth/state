"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { DUE_FILTERS, isFiltered, type BoardFilter, type DueFilter } from "@/lib/board-filter";
import { PRIORITIES } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

const PRIORITY_LABEL: Record<string, string> = { none: "No priority", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/** Project, priority, tag, due and text filters for the board. `F` focuses the text field. */
export function BoardFilterBar({
  filter,
  onChange,
  projects,
  tags,
  textRef,
}: {
  filter: BoardFilter;
  onChange: (next: BoardFilter) => void;
  projects: { slug: string; name: string }[];
  tags: string[];
  textRef: React.RefObject<HTMLInputElement | null>;
}) {
  const set = <K extends keyof BoardFilter>(key: K, value: BoardFilter[K] | "") => onChange({ ...filter, [key]: value || undefined });
  const select = "app-select h-10 w-auto min-w-0 max-w-[11rem] rounded-full pl-3 text-[15px]";
  return (
    <div role="search" aria-label="Filter the board" className="app-panel mb-5 flex flex-wrap items-center gap-2 rounded-[20px] p-2">
      <span className={cn(TICK, "px-2 text-[11px] text-[#71717A]")}>Filter</span>
      <label className="app-field flex h-10 min-w-0 flex-1 basis-40 items-center gap-2 rounded-full px-3">
        <Search aria-hidden="true" className="size-4 shrink-0 text-[#71717A]" />
        <span className="sr-only">Text</span>
        <input
          ref={textRef}
          type="search"
          name="q"
          value={filter.q ?? ""}
          onChange={(e) => set("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              set("q", "");
              e.currentTarget.blur();
            }
          }}
          placeholder="Find a card…"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none"
        />
        <kbd aria-hidden="true" className="hidden rounded-[6px] bg-black/[0.05] px-1.5 font-mono text-[12px] text-[#71717A] [@media(pointer:fine)]:inline">
          F
        </kbd>
      </label>
      {projects.length > 0 && (
        <select aria-label="Project" value={filter.project ?? ""} onChange={(e) => set("project", e.target.value)} className={select}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Priority" value={filter.priority ?? ""} onChange={(e) => set("priority", e.target.value)} className={select}>
        <option value="">Any priority</option>
        {[...PRIORITIES].reverse().map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      {tags.length > 0 && (
        <select aria-label="Tag" value={filter.tag ?? ""} onChange={(e) => set("tag", e.target.value)} className={select}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Due" value={filter.due ?? ""} onChange={(e) => set("due", e.target.value as DueFilter)} className={select}>
        <option value="">Any due date</option>
        {(Object.keys(DUE_FILTERS) as DueFilter[]).map((d) => (
          <option key={d} value={d}>
            {DUE_FILTERS[d]}
          </option>
        ))}
      </select>
      {isFiltered(filter) && (
        <button type="button" onClick={() => onChange({})} className="mi-press inline-flex h-10 items-center gap-1 rounded-full px-3 text-[15px] text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A]">
          <X aria-hidden="true" className="size-4" />
          Clear
        </button>
      )}
    </div>
  );
}
