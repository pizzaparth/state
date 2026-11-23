"use client";

import * as React from "react";
import { formatNumber } from "@/lib/format";
import { niceTicks } from "@/lib/metrics/series";
import { cn } from "@/lib/utils";

/**
 * Series on one shared y-axis. Identity is lightness plus dash (blue, slate, grey), and
 * every series is named in the legend and the tooltip. Lines are smooth but monotone
 * (Fritsch–Carlson), so a curve never overshoots a value it passes through. Hover, or
 * focus and use the arrow keys, to read one index; a screen-reader table carries the same
 * numbers.
 */

// Lightness steps on the light panels: accent blue, slate (3.2:1), recessive grey
const TONE = { hi: "#3344DB", mid: "#7C88AD", lo: "#A3ACC2" } as const;
export type Tone = keyof typeof TONE;
// Bar fills: a lighter cap fading into the tone at the baseline
const BAR_TOP = { hi: "#6577F8", mid: "#9BA6C6", lo: "#C1C8D8" } as const;
const TONES = ["hi", "mid", "lo"] as const;

export interface Series {
  label: string;
  values: (number | null)[];
  kind: "bar" | "line" | "area";
  tone?: Tone;
  dashed?: boolean;
}

const PAD = { top: 14, right: 14, bottom: 26, left: 44 };
// Bars never fill their slot: capped at 24px, the rest is air
const BAR_MAX = 24;
const INK = "#0B0D12";
const MUTED = "#4F5565";
// The panel's own colour, for the ring that keeps markers legible over lines
const SURFACE = "#EEF1F6";

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

type Point = [number, number];

/** Runs of consecutive finite values as screen points; a null breaks the line. */
function runs(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (run.length) out.push(run);
      run = [];
      return;
    }
    run.push([x(i), y(v)]);
  });
  if (run.length) out.push(run);
  return out;
}

/** Monotone cubic through the points (no overshoot past a local min or max). */
function smooth(points: Point[]) {
  const n = points.length;
  const f = (v: number) => v.toFixed(1);
  if (n === 0) return "";
  if (n < 3) return points.map(([px, py], i) => `${i ? "L" : "M"}${f(px)},${f(py)}`).join("");
  const dx = points.slice(1).map(([px], i) => px - points[i][0]);
  const m = points.slice(1).map(([, py], i) => (py - points[i][1]) / (dx[i] || 1));
  const t = points.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const sq = a * a + b * b;
    if (sq > 9) {
      const tau = 3 / Math.sqrt(sq);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    d += `C${f(x0 + h)},${f(y0 + t[i] * h)},${f(x1 - h)},${f(y1 - t[i + 1] * h)},${f(x1)},${f(y1)}`;
  }
  return d;
}

/** A bar with a rounded data end and a square end on the baseline. */
function barPath(x: number, w: number, yValue: number, yBase: number) {
  const h = Math.abs(yBase - yValue);
  const r = Math.min(4, w / 2, h);
  const up = yValue <= yBase;
  const top = up ? yValue : yBase;
  const bottom = up ? yBase : yValue;
  return up
    ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
    : `M${x},${top}H${x + w}V${bottom - r}Q${x + w},${bottom} ${x + w - r},${bottom}H${x + r}Q${x},${bottom} ${x},${bottom - r}Z`;
}

function Swatch({ s }: { s: Series }) {
  const color = TONE[s.tone ?? "hi"];
  return s.kind === "bar" ? (
    <span className="size-2.5 rounded-[3px]" style={{ background: `linear-gradient(${BAR_TOP[s.tone ?? "hi"]}, ${color})` }} />
  ) : (
    <svg width="20" height="10" aria-hidden="true">
      <line x1="2" y1="5" x2="18" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinecap="round" />
      {!s.dashed && <circle cx="10" cy="5" r="2.5" fill={color} stroke={SURFACE} strokeWidth="1.5" />}
    </svg>
  );
}

export function SeriesChart({
  title,
  labels,
  ticks,
  series,
  unit = "",
  digits = 0,
  height = 200,
  refs = [],
}: {
  title: string;
  /** Full label per index, used in the readout and the table. */
  labels: string[];
  /** Axis label per index; empty strings are skipped. */
  ticks: string[];
  series: Series[];
  unit?: string;
  digits?: number;
  height?: number;
  /** Horizontal reference rules, e.g. the period mean. */
  refs?: { value: number; label: string }[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // SVG ids from useId contain colons; keep url(#…) references plain
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [active, setActive] = React.useState<number | null>(null);
  const n = labels.length;
  const fmt = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : `${formatNumber(v, digits)}${unit}`);

  const finite = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const ticksY = niceTicks(Math.min(0, ...finite, ...refs.map((r) => r.value)), Math.max(0, ...finite, ...refs.map((r) => r.value)), 4);
  const lo = ticksY[0];
  const hi = ticksY[ticksY.length - 1];
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const step = n > 0 ? innerW / n : 0;
  const x = (i: number) => PAD.left + step * (i + 0.5);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const base = y(Math.max(lo, Math.min(0, hi)));

  const bars = series.filter((s) => s.kind === "bar");
  const lines = series.filter((s) => s.kind !== "bar");
  // Grouped bars share ~62% of the slot (2px apart), each capped at 24px
  const groupW = Math.min(step * 0.62, BAR_MAX * bars.length + 2 * (bars.length - 1));
  const barW = Math.max(1, (groupW - 2 * (bars.length - 1)) / Math.max(1, bars.length));
  const slots = bars.length > 0 && step >= 14;

  // The story series: the first solid line, labelled at its end
  const primary = lines.find((s) => !s.dashed);
  const primaryEnd = primary ? primary.values.reduce<number>((last, v, i) => (v !== null && Number.isFinite(v) ? i : last), -1) : -1;

  const move = (event: React.KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      Home: () => 0,
      End: () => n - 1,
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    setActive((i) => Math.max(0, Math.min(n - 1, next(i ?? n - 1))));
  };

  const pointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.floor((event.clientX - box.left - PAD.left) / (step || 1));
    setActive(i >= 0 && i < n ? i : null);
  };

  const readout =
    active === null ? null : `${labels[active]}: ${series.map((s) => `${s.label} ${fmt(s.values[active])}`).join(", ")}`;
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 100), Math.max(100, width - 100));

  return (
    <figure className="min-w-0">
      {series.length > 1 && (
        <figcaption className="mb-4 flex flex-wrap items-center gap-2" aria-hidden="true">
          {series.map((s) => (
            <span key={s.label} className="app-field inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium text-[#1E2129]">
              <Swatch s={s} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`${title}. Use arrow keys to read a point.`}
        onKeyDown={move}
        onFocus={() => setActive((i) => i ?? n - 1)}
        onBlur={() => setActive(null)}
        className="relative rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{ height }}
      >
        {width > 0 && n > 0 && (
          <svg width={width} height={height} className="block touch-pan-y select-none overflow-visible" onPointerMove={pointer} onPointerLeave={() => setActive(null)} aria-hidden="true">
            <defs>
              {/* Lines and areas draw in left to right as the clip widens */}
              <clipPath id={`${uid}-clip`}>
                <rect x={0} y={-PAD.top} width={width} height={height + PAD.top} className="app-mark origin-left animate-grow-x" />
              </clipPath>
              {TONES.map((t) => (
                <React.Fragment key={t}>
                  {/* Area wash: strongest at the line, gone by the baseline (flipped below zero) */}
                  <linearGradient id={`${uid}-up-${t}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TONE[t]} stopOpacity={t === "hi" ? 0.34 : 0.24} />
                    <stop offset="70%" stopColor={TONE[t]} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={TONE[t]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${uid}-down-${t}`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={TONE[t]} stopOpacity={t === "hi" ? 0.34 : 0.24} />
                    <stop offset="70%" stopColor={TONE[t]} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={TONE[t]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${uid}-bar-${t}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BAR_TOP[t]} />
                    <stop offset="100%" stopColor={TONE[t]} />
                  </linearGradient>
                </React.Fragment>
              ))}
              {/* The primary line casts a soft blue shadow onto the panel */}
              <filter id={`${uid}-glow`} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height + 20}>
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor={TONE.hi} floodOpacity="0.32" />
              </filter>
              <linearGradient id={`${uid}-cross`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TONE.hi} stopOpacity={0} />
                <stop offset="30%" stopColor={TONE.hi} stopOpacity={0.55} />
                <stop offset="100%" stopColor={TONE.hi} stopOpacity={0.15} />
              </linearGradient>
            </defs>

            {/* Grid: solid hairlines, the zero line a step darker */}
            {ticksY.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(30,40,70,.3)" : "rgba(80,95,125,.12)"} />
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[#4F5565] font-mono text-[12px] font-medium tabular-nums">
                  {formatNumber(t, Number.isInteger(t) ? 0 : 1)}
                </text>
              </g>
            ))}
            {ticks.map((t, i) =>
              t ? (
                <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className={cn("font-mono text-[12px] font-medium", active === i ? "fill-[#0B0D12]" : "fill-[#4F5565]")}>
                  {t}
                </text>
              ) : null
            )}

            {/* Soft column tracks behind bars; the hovered one tints blue */}
            {slots &&
              labels.map((_, i) => (
                <rect
                  key={`slot-${i}`}
                  x={x(i) - groupW / 2 - 3}
                  y={PAD.top}
                  width={groupW + 6}
                  height={innerH}
                  rx={Math.min(8, (groupW + 6) / 2)}
                  fill={active === i ? "rgba(61,79,230,.10)" : "rgba(122,138,168,.045)"}
                  className="transition-[fill] duration-150"
                />
              ))}
            {!slots && active !== null && bars.length > 0 && (
              <rect x={x(active) - step / 2} y={PAD.top} width={step} height={innerH} fill="rgba(61,79,230,.10)" />
            )}

            {bars.map((s, b) =>
              s.values.map((v, i) =>
                v === null || !Number.isFinite(v) || v === 0 ? null : (
                  <path
                    key={`${s.label}-${i}`}
                    d={barPath(x(i) - groupW / 2 + b * (barW + 2), barW, y(v), base)}
                    fill={`url(#${uid}-bar-${s.tone ?? "hi"})`}
                    opacity={active === null || active === i ? 1 : 0.45}
                    className={cn("app-mark animate-grow-y transition-opacity duration-150", v < 0 ? "origin-top" : "origin-bottom")}
                    style={{ animationDelay: `${i * Math.min(12, 360 / n)}ms` }}
                  />
                )
              )
            )}

            {refs.map((r) => (
              <g key={r.label}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke={MUTED} strokeOpacity={0.6} strokeDasharray="1 4" strokeLinecap="round" strokeWidth={1.5} />
                <text x={width - PAD.right} y={y(r.value) - 6} textAnchor="end" className="fill-[#1E2129] font-mono text-[12px] font-medium tabular-nums">
                  {r.label}
                </text>
              </g>
            ))}

            <g clipPath={`url(#${uid}-clip)`}>
              {/* Washes first, so every line sits on top of every area */}
              {lines.map((s) => {
                if (s.kind !== "area") return null;
                const tone = s.tone ?? "hi";
                const below = Math.max(...s.values.filter((v): v is number => v !== null && Number.isFinite(v)), 0) <= 0;
                return runs(s.values, x, y).map((run, k) => (
                  <path
                    key={`${s.label}-area-${k}`}
                    d={`${smooth(run)}L${run[run.length - 1][0].toFixed(1)},${base.toFixed(1)}L${run[0][0].toFixed(1)},${base.toFixed(1)}Z`}
                    fill={`url(#${uid}-${below ? "down" : "up"}-${tone})`}
                  />
                ));
              })}
              {lines.map((s) => {
                const tone = s.tone ?? "hi";
                const lead = s === primary && tone === "hi";
                return runs(s.values, x, y).map((run, k) => (
                  <path
                    key={`${s.label}-line-${k}`}
                    d={smooth(run)}
                    fill="none"
                    stroke={TONE[tone]}
                    strokeWidth={lead ? 2.75 : 2}
                    strokeDasharray={s.dashed ? "6 5" : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter={lead ? `url(#${uid}-glow)` : undefined}
                  />
                ));
              })}
            </g>

            {/* End marker and value on the story series, while nothing is hovered */}
            {primary && primaryEnd >= 0 && active === null && (() => {
              const v = primary.values[primaryEnd] as number;
              const cx = x(primaryEnd);
              const cy = y(v);
              const text = fmt(v);
              const w = text.length * 7.4 + 16;
              const left = Math.min(cx - w / 2, width - PAD.right - w + 6);
              const top = cy - 34 < 0 ? cy + 12 : cy - 34;
              return (
                <g className="animate-fade-in" style={{ animationDelay: "500ms" }}>
                  <circle cx={cx} cy={cy} r={10} fill={TONE[primary.tone ?? "hi"]} opacity={0.14} />
                  <circle cx={cx} cy={cy} r={4.5} fill={TONE[primary.tone ?? "hi"]} stroke={SURFACE} strokeWidth={2.5} />
                  <rect x={left} y={top} width={w} height={22} rx={11} fill="#FFFFFF" stroke="rgba(80,95,125,.16)" />
                  <text x={left + w / 2} y={top + 11} dy="0.34em" textAnchor="middle" fill={INK} className="font-mono text-[12px] font-semibold tabular-nums">
                    {text}
                  </text>
                </g>
              );
            })()}

            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke={`url(#${uid}-cross)`} strokeWidth={1.5} />
                {lines.map((s) => {
                  const v = s.values[active];
                  const color = TONE[s.tone ?? "hi"];
                  return v === null || !Number.isFinite(v) ? null : (
                    <g key={s.label}>
                      <circle cx={x(active)} cy={y(v)} r={11} fill={color} opacity={0.14} />
                      <circle cx={x(active)} cy={y(v)} r={5} fill={color} stroke={SURFACE} strokeWidth={2.5} />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        )}

        {active !== null && width > 0 && (
          <div
            aria-hidden="true"
            className="app-overlay pointer-events-none absolute top-0 z-10 w-max min-w-[10rem] max-w-[17rem] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-[14px] px-3.5 py-2.5"
            style={{ left: tipLeft }}
          >
            <p className="text-[13px] font-semibold text-[#0B0D12]">{labels[active]}</p>
            <ul className="mt-1.5 space-y-1">
              {series.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-5 text-[13px]">
                  <span className="inline-flex items-center gap-2 text-[#3A3F4B]">
                    <Swatch s={s} />
                    {s.label}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#0B0D12]">{fmt(s.values[active])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {readout}
        </p>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={i}>
              <th scope="row">{l}</th>
              {series.map((s) => (
                <td key={s.label}>{fmt(s.values[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// Lightness-only ramp shared with the execution graph
const RAMP = ["#D5DBE6", "#BAC3F6", "#8F9CF4", "#6173EE", "#3344DB"] as const;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday × hour grid of commits in the period (local time). */
export function Punchcard({ cells }: { cells: { dow: number; hour: number; commits: number; execution: number }[] }) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ commits: 0, execution: 0 })));
  for (const c of cells) grid[c.dow - 1][c.hour] = { commits: c.commits, execution: c.execution };
  const max = Math.max(1, ...cells.map((c) => c.commits));
  const [active, setActive] = React.useState<[number, number] | null>(null);
  const shown = active && grid[active[0]][active[1]];
  const hourText = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const move = (event: React.KeyboardEvent) => {
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    setActive((a) => {
      const [r, c] = a ?? [0, 0];
      return [Math.max(0, Math.min(6, r + delta[0])), Math.max(0, Math.min(23, c + delta[1]))];
    });
  };

  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain pb-1">
        <div className="min-w-[30rem]">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
            <div aria-hidden="true" className="grid gap-[3px] py-2.5 font-mono text-[12px] font-medium text-[#4F5565]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
              {DOW.map((d) => (
                <span key={d} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>
            <div
              role="group"
              tabIndex={0}
              aria-label="Commits by weekday and hour. Use arrow keys to read a cell."
              onKeyDown={move}
              onFocus={() => setActive((a) => a ?? [0, 9])}
              onBlur={() => setActive(null)}
              onPointerLeave={() => setActive(null)}
              className="app-field grid gap-[3px] rounded-[14px] p-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <span
                    key={`${r}-${c}`}
                    onPointerEnter={() => setActive([r, c])}
                    className={cn(
                      "relative aspect-square animate-cell-in rounded-[4px] transition-transform duration-150",
                      active?.[0] === r && active?.[1] === c && "z-[1] scale-125 outline outline-2 outline-offset-1 outline-[#0B0D12]"
                    )}
                    style={{
                      backgroundColor: RAMP[cell.commits === 0 ? 0 : Math.min(4, 1 + Math.floor((cell.commits / max) * 3.999))],
                      animationDelay: `${c * 14}ms`,
                    }}
                  />
                ))
              )}
            </div>
          </div>
          <div aria-hidden="true" className="ml-[3.625rem] mr-2.5 mt-2 grid font-mono text-[12px] font-medium text-[#4F5565]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="tabular-nums text-[#3A3F4B]">
          {active && shown ? (
            <>
              <span className="font-semibold text-[#0A0A0A]">
                {DOW[active[0]]} {hourText(active[1])}
              </span>
              {`: ${shown.commits} ${shown.commits === 1 ? "commit" : "commits"}, +${shown.execution}`}
            </>
          ) : (
            "Hover a cell · or arrow keys"
          )}
        </p>
        <span className="flex items-center gap-1.5 text-[#3A3F4B]" aria-hidden="true">
          0
          {RAMP.map((f) => (
            <span key={f} className="size-3 rounded-[4px]" style={{ backgroundColor: f }} />
          ))}
          {max}
        </span>
      </div>
      <table className="sr-only">
        <caption>Commits by weekday and hour</caption>
        <tbody>
          {cells.map((c) => (
            <tr key={`${c.dow}-${c.hour}`}>
              <th scope="row">
                {DOW[c.dow - 1]} {hourText(c.hour)}
              </th>
              <td>{c.commits} commits</td>
              <td>{c.execution} execution</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
