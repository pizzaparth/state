"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

export const METRIC_SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "series", label: "Series" },
  { id: "flow", label: "Flow" },
  { id: "cycle", label: "Cycle" },
  { id: "projects", label: "Work" },
  { id: "objectives", label: "Objectives" },
] as const;
export type MetricSectionId = (typeof METRIC_SECTIONS)[number]["id"];
export const METRICS_COLLAPSED_COOKIE = "metrics_collapsed";

/** Sticky row of anchors to each section (the Metrics page has fifteen panels). */
export function MetricAnchors({ sections }: { sections: readonly { id: string; label: string }[] }) {
  return (
    // Phones: the bar scrolls sideways, so the scroller pads out past it (sides and below)
    // to keep its raised shadow unclipped, and the padding lets clicks through. From md the
    // bar fits, so nothing clips and the nav is just the bar.
    <nav
      aria-label="Sections"
      className="pointer-events-none sticky top-2 z-20 -mx-4 -mb-10 overflow-x-auto px-4 pb-10 sm:-mx-6 sm:px-6 md:mx-0 md:mb-0 md:overflow-visible md:px-0 md:pb-0"
    >
      <ul className="app-panel pointer-events-auto inline-flex gap-1 rounded-full p-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="mi-press block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-[#3A3F4B] hover:bg-black/[0.05] hover:text-[#0A0A0A] [@media(pointer:coarse)]:py-2.5">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A collapsible group of panels. Open state is remembered in a cookie, so the server
 * renders it the same way next time.
 */
export function MetricSection({ id, title, collapsed: initial, children }: { id: string; title: string; collapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(initial);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      const current = new Set(
        decodeURIComponent(document.cookie.split("; ").find((x) => x.startsWith(`${METRICS_COLLAPSED_COOKIE}=`))?.split("=")[1] ?? "")
          .split(",")
          .filter(Boolean)
      );
      if (next) current.add(id);
      else current.delete(id);
      document.cookie = `${METRICS_COLLAPSED_COOKIE}=${encodeURIComponent([...current].join(","))}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 space-y-5">
      <h2 id={`${id}-title`} className="scroll-mt-16">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls={`${id}-body`} className={cn(TICK, "mi-press -ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2 text-[#1E2129] hover:bg-black/[0.04]")}>
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-150", collapsed && "-rotate-90")} />
          {title}
        </button>
      </h2>
      <div id={`${id}-body`} hidden={collapsed} className="space-y-5">
        {children}
      </div>
    </section>
  );
}
