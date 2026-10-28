import * as React from "react";
import type { DailyExecution } from "@/db/queries";
import { formatNumber } from "@/lib/format";

const dayText = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
};

/**
 * Daily execution as compact bars with the mean as a dashed rule. Monochrome, thin
 * axes, tabular labels (docs/style.md §31). Includes a text table for screen readers.
 */
export function VelocityBars({ days }: { days: DailyExecution[] }) {
  const max = Math.max(1, ...days.map((d) => d.execution));
  const mean = days.reduce((s, d) => s + d.execution, 0) / days.length;
  const every = Math.ceil(days.length / 8);
  return (
    <figure>
      <div className="relative h-44" aria-hidden="true">
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-white/15">
          {days.map((d, i) => (
            <div
              key={d.day}
              title={`${dayText(d.day, { day: "numeric", month: "short" })}: ${d.execution} execution`}
              className="min-w-0 flex-1 origin-bottom animate-grow-y rounded-t-[3px] bg-[#F2F2EF]"
              // Light stagger, capped so long ranges finish quickly
              style={{ height: `${(d.execution / max) * 100}%`, animationDelay: `${Math.min(i * 12, 360)}ms` }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 border-t border-dashed border-[#9A9A96]" style={{ bottom: `${(mean / max) * 100}%` }}>
          <span className="absolute -top-5 right-0 rounded-[6px] bg-[#0A0A0A]/90 px-1.5 text-[11px] tabular-nums text-[#D4D4D0]">
            mean {formatNumber(mean, 1)}/d
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-[#9A9A96]" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? dayText(d.day, { day: "numeric", month: "short" }) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Daily execution, mean {formatNumber(mean, 1)} per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.execution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const BUCKETS = [
  { label: "< 4h", max: 4 },
  { label: "4–12h", max: 12 },
  { label: "12–24h", max: 24 },
  { label: "1–2d", max: 48 },
  { label: "2–4d", max: 96 },
  { label: "4d+", max: Infinity },
];

/** Cycle-time distribution in fixed, labelled buckets. */
export function CycleHistogram({ durationsMs }: { durationsMs: number[] }) {
  const counts = BUCKETS.map(() => 0);
  for (const ms of durationsMs) {
    const h = ms / 3_600_000;
    counts[BUCKETS.findIndex((b) => h < b.max)]++;
  }
  const max = Math.max(1, ...counts);
  return (
    <ul className="space-y-2" aria-label="Cycle time distribution">
      {BUCKETS.map((b, i) => (
        <li key={b.label} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-xs">
          <span className="tabular-nums text-[#9A9A96]">{b.label}</span>
          <span className="app-field h-2.5 overflow-hidden rounded-full">
            <span className="block h-full origin-left animate-grow-x rounded-full bg-[#F2F2EF]" style={{ transform: `scaleX(${counts[i] / max})` }} />
          </span>
          <span className="text-right font-mono tabular-nums text-[#F2F2EF]">{counts[i]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Share of execution by project. */
export function Distribution({ rows }: { rows: { name: string; execution: number }[] }) {
  const total = rows.reduce((s, r) => s + r.execution, 0);
  if (total === 0) return <p className="text-sm text-[#9A9A96]">No execution in this period.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const share = r.execution / total;
        return (
          <li key={r.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[#F2F2EF]">{r.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-[#9A9A96]">
                {formatNumber(share * 100)}% <span className="text-[#85857F]">({r.execution})</span>
              </span>
            </div>
            <span className="app-field mt-1.5 block h-2 overflow-hidden rounded-full">
              <span className="block h-full origin-left animate-grow-x rounded-full bg-[#F2F2EF]" style={{ transform: `scaleX(${share})` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
