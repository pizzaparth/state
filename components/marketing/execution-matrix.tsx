"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DEMO_DAYS, INTENSITY_FILL, formatDay, formatNumber, intensity } from "./demo-data";

const RANGES = [
  { id: "90d", label: "90 days", weeks: 13 },
  { id: "1y", label: "1 year", weeks: 53 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/**
 * The signature graph, rendered as a horizontal matrix of days (columns = weeks).
 * Pointer hover or arrow keys inspect a day; the readout states exactly what it counts.
 */
export function ExecutionMatrix() {
  const [rangeId, setRangeId] = React.useState<RangeId>("1y");
  const range = RANGES.find((r) => r.id === rangeId)!;
  const days = React.useMemo(() => DEMO_DAYS.slice(-range.weeks * 7), [range.weeks]);
  const [active, setActive] = React.useState(days.length - 1);
  const day = days[Math.min(active, days.length - 1)];

  const totals = React.useMemo(
    () => ({
      commits: days.reduce((s, d) => s + d.commits, 0),
      execution: days.reduce((s, d) => s + d.execution, 0),
      activeDays: days.filter((d) => d.commits > 0).length,
    }),
    [days]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7, Home: -Infinity, End: Infinity }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setActive((i) => Math.max(0, Math.min(days.length - 1, i + delta)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {[
            { label: "Commits", value: totals.commits },
            { label: "Execution", value: totals.execution },
            { label: "Active days", value: `${totals.activeDays}/${days.length}` },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm text-[#6F6F6B]">{stat.label}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums [font-stretch:110%] text-[#F4F4F2]">
                {typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <div role="radiogroup" aria-label="Range" className="flex rounded-full border border-white/[0.12] p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={rangeId === r.id}
              onClick={() => {
                setRangeId(r.id);
                setActive(r.weeks * 7 - 1);
              }}
              className={cn(
                "h-8 min-w-[5.5rem] rounded-full px-3 text-sm transition-[background-color,color]",
                rangeId === r.id ? "bg-[#F1F1EE] font-semibold text-[#090909]" : "text-[#A9A9A6] hover:text-white"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-label="Execution graph. Use arrow keys to inspect days."
        onKeyDown={onKeyDown}
        className="mt-8 overflow-x-auto overscroll-x-contain rounded-sm p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
      >
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${range.weeks}, minmax(${range.weeks > 13 ? "10px" : "22px"}, 1fr))` }}
          onPointerLeave={() => setActive(days.length - 1)}
        >
          {days.map((d, i) => (
            <span
              key={d.date}
              onPointerEnter={() => setActive(i)}
              className={cn(
                "aspect-square rounded-[2px] transition-transform duration-150",
                i === active && "scale-[1.35] outline outline-1 outline-[#F4F4F2]"
              )}
              style={{ backgroundColor: INTENSITY_FILL[intensity(d.execution)] }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-4 text-base">
        <p aria-live="polite" className="tabular-nums text-[#A9A9A6]">
          <span className="font-semibold text-[#F4F4F2]">{formatDay(day.date)}</span>
          <span className="ml-4">{day.commits} commits</span>
          <span className="ml-4">{day.tasks} tasks completed</span>
          <span className="ml-4">{day.execution} execution</span>
          <span className="ml-4">{day.projects} projects</span>
        </p>
        <div className="flex items-center gap-1.5 text-sm text-[#6F6F6B]" aria-hidden="true">
          <span className="mr-1">0</span>
          {INTENSITY_FILL.map((fill) => (
            <span key={fill} className="size-2.5 rounded-[2px]" style={{ backgroundColor: fill }} />
          ))}
          <span className="ml-1">21+ execution</span>
        </div>
      </div>
    </div>
  );
}
