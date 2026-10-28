"use client";

import * as React from "react";
import type { DailyExecution } from "@/db/queries";
import { cn } from "@/lib/utils";

// docs/style.md §30 intensity ramp: lightness only, readable without colour vision
const FILL = ["#CCCCCA", "#B7B7B3", "#8D8D89", "#595956", "#191919"] as const;

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
  const cell = weeks <= 6 ? 30 : weeks <= 14 ? 24 : weeks <= 27 ? 17 : 13;
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
        <div className="relative inline-block min-w-full pl-7 pt-5">
          {/* Month labels */}
          <div aria-hidden="true" className="absolute left-7 top-0 h-4 text-[10px] text-[#5F5F5B]">
            {months.map((m) => (
              <span key={`${m.week}-${m.text}`} className="absolute" style={{ left: m.week * (cell + gap) }}>
                {m.text}
              </span>
            ))}
          </div>
          {/* Weekday labels */}
          <div aria-hidden="true" className="absolute left-0 top-5 grid text-[10px] leading-none text-[#5F5F5B]" style={{ gridTemplateRows: `repeat(7, ${cell}px)`, rowGap: gap }}>
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
            className="neu-inset-sm relative grid w-max grid-flow-col rounded-[10px] p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]/70"
            style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoColumns: `${cell}px`, gap }}
          >
            {cells.map((d, i) =>
              d ? (
                <span
                  key={d.day}
                  onPointerEnter={() => setActive(i)}
                  className={cn("rounded-[3px] transition-transform duration-100", active === i && "scale-125 outline outline-1 outline-[#171717]")}
                  style={{ backgroundColor: FILL[level(d.execution)] }}
                />
              ) : (
                <span key={`pad-${i}`} />
              )
            )}

            {shown && (
              <div
                aria-hidden="true"
                className="neu-inverse pointer-events-none absolute z-10 w-max rounded-[12px] px-3 py-2 text-xs"
                style={{ left: 8 + col * (cell + gap) + cell / 2, top: 8 + row * (cell + gap) - 8, transform: "translate(-50%, -100%)" }}
              >
                <p className="font-semibold">{label(shown.day, { weekday: "short", day: "numeric", month: "short" })}</p>
                <p className="mt-1 tabular-nums text-[#C9C9C5]">
                  {shown.execution} execution, {shown.commits} commits
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p aria-live="polite" className="tabular-nums text-[#5F5F5B]">
          {shown ? (
            <>
              <span className="font-semibold text-[#171717]">{label(shown.day, { weekday: "long", day: "numeric", month: "long" })}</span>
              {`: ${shown.commits} commits, ${shown.tasks} tasks completed, ${shown.execution} execution, ${shown.projects} projects touched`}
            </>
          ) : (
            "Hover a day, or focus the graph and use the arrow keys."
          )}
        </p>
        <span className="flex items-center gap-1.5 text-[#5F5F5B]" aria-hidden="true">
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
