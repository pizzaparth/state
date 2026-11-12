"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

export const HISTORY_FILTERS = ["project", "source", "tag", "weight", "from", "to", "day", "q"] as const;

/**
 * History filters, all in the URL (deep links, Back restores them). Each change replaces
 * the URL and drops the page cursor; text waits for a pause in typing.
 */
export function HistoryFilters({
  projects,
  archived,
  tags,
}: {
  projects: { slug: string; name: string }[];
  archived: { slug: string; name: string }[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  React.useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("before");
      next.delete("commit");
      if ("from" in patch || "to" in patch) next.delete("day");
      const query = next.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
    },
    [params, pathname, router]
  );

  React.useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = window.setTimeout(() => set({ q: q.trim() || null }), 350);
    return () => window.clearTimeout(t);
  }, [q, params, set]);

  const any = HISTORY_FILTERS.some((k) => params.get(k));
  const select = "app-select h-10 w-auto min-w-0 max-w-[12rem] rounded-full pl-3 text-[15px]";
  const value = (k: string) => params.get(k) ?? "";
  return (
    <div role="search" aria-label="Filter commits" className="app-panel flex flex-wrap items-center gap-2 rounded-[20px] p-2">
      <span className={cn(TICK, "px-2 text-[11px] text-[#71717A]")}>Filter</span>
      <label className="app-field flex h-10 min-w-0 flex-1 basis-40 items-center gap-2 rounded-full px-3">
        <Search aria-hidden="true" className="size-4 shrink-0 text-[#71717A]" />
        <span className="sr-only">Message</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find in messages…" autoComplete="off" className="h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-[#71717A] focus:outline-none" />
      </label>
      <select aria-label="Project" value={value("project")} onChange={(e) => set({ project: e.target.value })} className={select}>
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
        {archived.length > 0 && (
          <optgroup label="Archived">
            {archived.map((p) => (
              <option key={p.slug} value={p.slug} className="text-[#71717A]">
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <select aria-label="Source" value={value("source")} onChange={(e) => set({ source: e.target.value })} className={select}>
        <option value="">Any source</option>
        <option value="task">From tasks</option>
        <option value="manual">Manual</option>
        <option value="imported">Imported</option>
      </select>
      {tags.length > 0 && (
        <select aria-label="Tag" value={value("tag")} onChange={(e) => set({ tag: e.target.value })} className={select}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Weight" value={value("weight")} onChange={(e) => set({ weight: e.target.value })} className={select}>
        <option value="">Any weight</option>
        {[1, 2, 4, 8].map((w) => (
          <option key={w} value={w}>
            +{w}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-[#52525B]">
        <span className="sr-only">From</span>
        <input type="date" aria-label="From" value={value("from") || value("day")} onChange={(e) => set({ from: e.target.value, to: value("to") || value("day") || null })} className="app-input h-10 rounded-full px-3 text-[15px]" />
        <span aria-hidden="true">–</span>
        <input type="date" aria-label="To" value={value("to") || value("day")} onChange={(e) => set({ to: e.target.value, from: value("from") || value("day") || null })} className="app-input h-10 rounded-full px-3 text-[15px]" />
      </label>
      {any && (
        <button type="button" onClick={() => router.replace(pathname as Route, { scroll: false })} className="mi-press inline-flex h-10 items-center gap-1 rounded-full px-3 text-[15px] text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A]">
          <X aria-hidden="true" className="size-4" />
          Clear
        </button>
      )}
    </div>
  );
}
