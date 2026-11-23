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
          <span className="tabular-nums text-[#3A3F4B]">{b.label}</span>
          <span className="app-field h-3 overflow-hidden rounded-full">
            <span className="block h-full origin-left animate-grow-x rounded-full bg-accent" style={{ transform: `scaleX(${counts[i] / max})` }} />
          </span>
          <span className="text-right font-mono tabular-nums text-[#0A0A0A]">{counts[i]}</span>
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
  // var(--accent): pink on the landing page, blue in the product
  const color = inverse ? "#FFFFFF" : "var(--accent)";
  const ring = inverse ? "var(--accent)" : "var(--app-panel)";
  const fadeId = `${clipId}-fade`.replace(/[^a-zA-Z0-9-]/g, "");
  const lastY = points.at(-1)!.split(",")[1];
  return (
    <svg viewBox={`0 -2 ${w + 4} ${h + 4}`} className="h-8 w-24 shrink-0 overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      {/* The line draws in left to right over a wash that fades to the baseline */}
      <defs>
        <clipPath id={clipId}>
          <rect x={-3} y={-5} width={w + 10} height={h + 10} className="app-mark origin-left animate-grow-x" />
        </clipPath>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: inverse ? 0.35 : 0.28 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <polygon points={`0,${h} ${points.join(" ")} ${w},${h}`} fill={`url(#${fadeId})`} />
        <polyline points={points.join(" ")} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={w} cy={lastY} r="3.5" style={{ fill: color, stroke: ring }} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

// Lightness steps: accent gradient, navy, slate, pale slate
const MIX_FILL = ["linear-gradient(90deg, #5466F7, #2C3BC9)", "#2B3150", "#7C88AD", "#BCC4D6"];

/** 100% stacked bar with a labelled row per part, so share never relies on fill alone. */
export function MixBar({ label, parts }: { label: string; parts: { name: string; value: number; detail?: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <p className="font-mono text-sm text-[#4F5565]">No data</p>;
  return (
    <div>
      <div className="flex h-3 gap-[3px]" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${formatNumber((p.value / total) * 100)}%`).join(", ")}`}>
        {parts.map((p, i) =>
          p.value > 0 ? (
            <span key={p.name} className="h-full min-w-[3px] origin-left animate-grow-x rounded-full" style={{ flexGrow: p.value, background: MIX_FILL[i % MIX_FILL.length] }} />
          ) : null
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p, i) => (
          <li key={p.name} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_3.5rem] items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: MIX_FILL[i % MIX_FILL.length] }} aria-hidden="true" />
            <span className="truncate text-[#0A0A0A]">{p.name}</span>
            <span className="font-mono text-[12px] tabular-nums text-[#4F5565]">{p.detail}</span>
            <span className="text-right font-mono tabular-nums text-[#0A0A0A]">{formatNumber((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dense grid of named statistics, each with its formula. */
export function StatGrid({ stats }: { stats: { label: string; value: string; formula: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="app-card min-w-0 px-4 py-3.5">
          <dt className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-[#3A3F4B]">{s.label}</dt>
          <dd className="mt-1.5 font-sans text-xl font-semibold tabular-nums tracking-[-0.02em] text-[#0A0A0A]">{s.value}</dd>
          <dd className="mt-1 truncate font-mono text-[12px] text-[#4F5565]" title={s.formula}>
            {s.formula}
          </dd>
        </div>
      ))}
    </dl>
  );
}
