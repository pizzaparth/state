import * as React from "react";
import { formatNumber } from "@/lib/format";

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
        <li key={b.label} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
          <span className="tabular-nums text-[#B4BEDB]">{b.label}</span>
          <span className="app-field h-2.5 overflow-hidden rounded-full">
            <span className="block h-full origin-left animate-grow-x rounded-full bg-accent" style={{ transform: `scaleX(${counts[i] / max})` }} />
          </span>
          <span className="text-right font-mono tabular-nums text-[#FFFFFF]">{counts[i]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Inline trend line for a KPI card: shape only, scaled to its own min and max. */
export function Sparkline({ values, inverse }: { values: number[]; inverse?: boolean }) {
  const clipId = React.useId();
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`);
  const color = inverse ? "#00203D" : "#FF3D8B";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-24 shrink-0" preserveAspectRatio="none" aria-hidden="true">
      {/* The line draws in left to right; the end dot lands after it */}
      <defs>
        <clipPath id={clipId}>
          <rect x={-3} y={-3} width={w + 6} height={h + 6} className="app-mark origin-left animate-grow-x" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={w} cy={points.at(-1)!.split(",")[1]} r="2.5" fill={color} />
      </g>
    </svg>
  );
}

const MIX_FILL = ["#FF3D8B", "#FFFFFF", "#8E9AC0", "#3D5185"];

/** 100% stacked bar with a labelled row per part, so share never relies on fill alone. */
export function MixBar({ label, parts }: { label: string; parts: { name: string; value: number; detail?: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <p className="font-mono text-sm text-[#8E9AC0]">No data</p>;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${formatNumber((p.value / total) * 100)}%`).join(", ")}`}>
        {parts.map((p, i) =>
          p.value > 0 ? (
            <span key={p.name} className="h-full origin-left animate-grow-x first:rounded-l-full last:rounded-r-full" style={{ flexGrow: p.value, backgroundColor: MIX_FILL[i % MIX_FILL.length] }} />
          ) : null
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p, i) => (
          <li key={p.name} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_3.5rem] items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-[2px] border border-white/15" style={{ backgroundColor: MIX_FILL[i % MIX_FILL.length] }} aria-hidden="true" />
            <span className="truncate text-[#FFFFFF]">{p.name}</span>
            <span className="font-mono text-[12px] tabular-nums text-[#8E9AC0]">{p.detail}</span>
            <span className="text-right font-mono tabular-nums text-[#FFFFFF]">{formatNumber((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dense grid of named statistics, each with its formula. */
export function StatGrid({ stats }: { stats: { label: string; value: string; formula: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3 xl:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 bg-[#00203D] px-4 py-3.5">
          <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#B4BEDB]">{s.label}</dt>
          <dd className="mt-1.5 font-display text-xl font-extrabold tabular-nums tracking-[-0.02em] text-[#FFFFFF] [font-stretch:125%]">{s.value}</dd>
          <dd className="mt-1 truncate font-mono text-[11px] text-[#8E9AC0]" title={s.formula}>
            {s.formula}
          </dd>
        </div>
      ))}
    </dl>
  );
}
