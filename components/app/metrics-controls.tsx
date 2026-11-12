"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Period (7D … 1Y, All, or a from–to range) and project, all in the URL. Changing one
 * keeps the others.
 */
export function MetricsControls({
  periods,
  active,
  from,
  to,
  projects,
  project,
}: {
  periods: string[];
  /** The active period key ("30d", "all", "custom"). */
  active: string;
  from: string;
  to: string;
  projects: { slug: string; name: string }[];
  project: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("metric");
    next.delete("objective");
    const q = next.toString();
    return `${pathname}${q ? `?${q}` : ""}` as Route;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Period" className="app-field inline-flex flex-wrap gap-1 rounded-full p-1">
        {[...periods, "all"].map((key) => (
          <Link
            key={key}
            href={href({ period: key, from: null, to: null })}
            aria-current={key === active ? "page" : undefined}
            scroll={false}
            className={cn("mi-press rounded-full px-3 py-1.5 font-mono text-[13px] font-semibold uppercase [@media(pointer:coarse)]:py-2.5", key === active ? "bg-[#0A0A0A] text-white" : "text-[#52525B] hover:text-[#0A0A0A]")}
          >
            {key}
          </Link>
        ))}
      </nav>
      <form
        className={cn("app-field inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1", active === "custom" && "border-[#0A0A0A]")}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const f = String(data.get("from") ?? "");
          const t = String(data.get("to") ?? "");
          if (f && t) router.push(href({ period: null, from: f <= t ? f : t, to: f <= t ? t : f }), { scroll: false });
        }}
      >
        <label className="sr-only" htmlFor="metrics-from">
          From
        </label>
        <input id="metrics-from" name="from" type="date" defaultValue={from} className="h-8 bg-transparent font-mono text-[13px] focus:outline-none" />
        <span aria-hidden="true">–</span>
        <label className="sr-only" htmlFor="metrics-to">
          To
        </label>
        <input id="metrics-to" name="to" type="date" defaultValue={to} className="h-8 bg-transparent font-mono text-[13px] focus:outline-none" />
        <button type="submit" className="app-btn h-8 rounded-full px-3 text-[13px] font-medium">
          Apply
        </button>
      </form>
      {projects.length > 0 && (
        <select
          aria-label="Project"
          value={project ?? ""}
          onChange={(e) => router.push(href({ project: e.target.value || null }), { scroll: false })}
          className="app-select h-10 w-auto max-w-[14rem] rounded-full pl-3 text-[15px]"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
