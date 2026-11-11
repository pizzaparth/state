"use client";

import * as React from "react";
import type { DailyExecution } from "@/db/queries";
import { cn } from "@/lib/utils";

// Lightness ramp from the card layer to the accent: readable without colour vision
const FILL = ["#12324F", "#55306E", "#8C347C", "#C53985", "#FF3D8B"] as const;

function level(execution: number): 0 | 1 | 2 | 3 | 4 {
  if (execution === 0) return 0;
  if (execution <= 4) return 1;
  if (execution <= 9) return 2;
  if (execution <= 16) return 3;
  return 4;
}

const label = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
};

/**
 * Horizontal execution graph: columns are weeks, rows Monday to Sunday. Hover or focus
 * and use arrow keys to read a day; the dark readout states exactly what it counts.
 */
export function ExecutionGraph({ days }: { days: DailyExecution[] }) {
  // Pad so the first column starts on Monday
  const firstWeekday = (new Date(`${days[0].day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (DailyExecution | null)[] = [...Array(firstWeekday).fill(null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  const [active, setActive] = React.useState<number | null>(null);
  const shown = active === null ? null : cells[active];

  const months: { week: number; text: string }[] = [];
  let previousMonth = "";
  for (let w = 0; w < weeks; w++) {
    const first = cells.slice(w * 7, w * 7 + 7).find(Boolean);
    if (!first) continue;
    const month = first.day.slice(0, 7);
    if (month !== previousMonth) {
      // Skip a label that would collide with the next one (partial first month)
      if (months.length && w - months[months.length - 1].week < 3) months.pop();
      months.push({ week: w, text: label(first.day, { month: "short" }) });
      previousMonth = month;
    }
  }

  const move = (event: React.KeyboardEvent) => {
    const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setActive((i) => {
      let next = (i ?? cells.length - 1) + delta;
      next = Math.max(firstWeekday, Math.min(cells.length - 1, next));
      return next;
    });
  };

  const gap = 3;
  const col = active === null ? 0 : Math.floor(active / 7);
  const row = active === null ? 0 : active % 7;

  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain pb-2">
        {/* Fluid: cells are square and share the width; capped so short ranges stay compact */}
        <div
          className="relative pl-8 pt-5"
          style={{ minWidth: `calc(${weeks} * 0.8rem + 2rem)`, maxWidth: `calc(${weeks} * 2rem + 2rem)` }}
        >
          <div aria-hidden="true" className="absolute left-8 right-0 top-0 h-4 text-[12px] text-[#B4BEDB]">
            {months.map((m) => (
              <span key={`${m.week}-${m.text}`} className="absolute" style={{ left: `${(m.week / weeks) * 100}%` }}>
                {m.text}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <div aria-hidden="true" className="-ml-8 grid w-6 py-2 text-[12px] leading-none text-[#B4BEDB]" style={{ gridTemplateRows: "repeat(7, 1fr)", rowGap: gap }}>
              {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
                <span key={i} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>

            <div
              role="group"
              tabIndex={0}
              aria-label="Execution graph. Use arrow keys to read a day."
              onKeyDown={move}
              onFocus={() => setActive((i) => i ?? cells.length - 1)}
              onBlur={() => setActive(null)}
              onPointerLeave={() => setActive(null)}
              className="app-field relative grid flex-1 grid-flow-col rounded-[10px] p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFFFF]/70"
              style={{ gridTemplateRows: "repeat(7, auto)", gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap }}
            >
              {cells.map((d, i) =>
                d ? (
                  <span
                    key={d.day}
                    onPointerEnter={() => setActive(i)}
                    // Active day: a crisp ring in the 3px gap, raised above its neighbours so no
                    // side is painted over (scaling the cell blurred and clipped the outline)
                    className={cn(
                      "relative aspect-square animate-cell-in rounded-[3px]",
                      active === i && "z-[1] outline outline-2 outline-offset-1 outline-[#FFFFFF]"
                    )}
                    style={{ backgroundColor: FILL[level(d.execution)], animationDelay: `${Math.floor(i / 7) * Math.min(14, 420 / weeks)}ms` }}
                  />
                ) : (
                  <span key={`pad-${i}`} className="aspect-square" />
                )
              )}

              {shown && (
                <div
                  aria-hidden="true"
                  className="app-inverse pointer-events-none absolute z-10 w-max rounded-[12px] px-3 py-2 text-sm"
                  style={{
                    left: `calc(0.5rem + (100% - 1rem) * ${(col + 0.5) / weeks})`,
                    top: `calc(0.5rem + (100% - 1rem) * ${row / 7} - 6px)`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <p className="font-semibold">{label(shown.day, { weekday: "short", day: "numeric", month: "short" })}</p>
                  <p className="mt-1 tabular-nums text-accent-muted">
                    {shown.execution} execution, {shown.commits} {shown.commits === 1 ? "commit" : "commits"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="tabular-nums text-[#B4BEDB]">
          {shown ? (
            <>
              <span className="font-semibold text-[#FFFFFF]">{label(shown.day, { weekday: "long", day: "numeric", month: "long" })}</span>
              {`: ${shown.commits} ${shown.commits === 1 ? "commit" : "commits"}, ${shown.tasks} done, ${shown.execution} execution, ${shown.projects} ${shown.projects === 1 ? "project" : "projects"}`}
            </>
          ) : (
            "Hover a day · or ← → keys"
          )}
        </p>
        <span className="flex items-center gap-1.5 text-[#B4BEDB]" aria-hidden="true">
          0
          {FILL.map((f) => (
            <span key={f} className="size-2.5 rounded-[2px]" style={{ backgroundColor: f }} />
          ))}
          17+ execution
        </span>
      </div>
    </div>
  );
}
