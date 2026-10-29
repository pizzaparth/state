"use client";

import * as React from "react";
import { formatNumber } from "@/lib/format";
import { niceTicks } from "@/lib/metrics/series";
import { cn } from "@/lib/utils";

/**
 * Monochrome series on one shared y-axis. Identity is lightness plus dash, never hue,
 * and every series is named in the legend and the readout. Hover, or focus and use the
 * arrow keys, to read one index; a screen-reader table carries the same numbers.
 */

// Lightness steps on #0A0A0A panels: primary ink, secondary ink, recessive fill
const TONE = { hi: "#F2F2EF", mid: "#9A9A96", lo: "#4A4A47" } as const;
export type Tone = keyof typeof TONE;

export interface Series {
  label: string;
  values: (number | null)[];
  kind: "bar" | "line" | "area";
  tone?: Tone;
  dashed?: boolean;
}

const PAD = { top: 10, right: 8, bottom: 22, left: 44 };

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

function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    open = true;
  });
  return d;
}

function Swatch({ s }: { s: Series }) {
  const color = TONE[s.tone ?? "hi"];
  return s.kind === "bar" ? (
    <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
  ) : (
    <svg width="18" height="8" aria-hidden="true">
      <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinecap="round" />
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

  const bars = series.filter((s) => s.kind === "bar");
  const gap = step > 6 ? 2 : step > 3 ? 1 : 0;
  const barW = Math.max(0.75, (step - gap) / Math.max(1, bars.length));

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
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 90), Math.max(90, width - 90));

  return (
    <figure className="min-w-0">
      {series.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-[#9A9A96]" aria-hidden="true">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
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
        className="relative rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F2F2EF]/70"
        style={{ height }}
      >
        {width > 0 && n > 0 && (
          <svg width={width} height={height} className="block touch-pan-y select-none" onPointerMove={pointer} onPointerLeave={() => setActive(null)} aria-hidden="true">
            {ticksY.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)"} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[#85857F] font-mono text-[11px] tabular-nums">
                  {formatNumber(t, Number.isInteger(t) ? 0 : 1)}
                </text>
              </g>
            ))}
            {ticks.map((t, i) =>
              t ? (
                <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-[#85857F] font-mono text-[11px]">
                  {t}
                </text>
              ) : null
            )}

            {bars.map((s, b) =>
              s.values.map((v, i) =>
                v === null || v === 0 ? null : (
                  <rect
                    key={`${s.label}-${i}`}
                    x={x(i) - (step - gap) / 2 + b * barW}
                    y={Math.min(y(v), y(0))}
                    width={barW}
                    height={Math.max(1, Math.abs(y(v) - y(0)))}
                    rx={barW > 6 ? 2 : 0}
                    fill={TONE[s.tone ?? "hi"]}
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                )
              )
            )}

            {series.map((s) => {
              if (s.kind === "bar") return null;
              const color = TONE[s.tone ?? "hi"];
              const d = linePath(s.values, x, y);
              if (!d) return null;
              return (
                <g key={s.label}>
                  {s.kind === "area" && <path d={`${d}V${y(0)}H${x(s.values.findIndex((v) => v !== null))}Z`} fill={color} opacity={0.14} />}
                  <path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}

            {refs.map((r) => (
              <g key={r.label}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke="#9A9A96" strokeDasharray="2 3" />
                <text x={width - PAD.right} y={y(r.value) - 5} textAnchor="end" className="fill-[#D4D4D0] font-mono text-[11px] tabular-nums">
                  {r.label}
                </text>
              </g>
            ))}

            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="rgba(242,242,239,.5)" />
                {series
                  .filter((s) => s.kind !== "bar")
                  .map((s) => {
                    const v = s.values[active];
                    return v === null || !Number.isFinite(v) ? null : (
                      <circle key={s.label} cx={x(active)} cy={y(v)} r={4} fill={TONE[s.tone ?? "hi"]} stroke="#0A0A0A" strokeWidth={2} />
                    );
                  })}
              </g>
            )}
          </svg>
        )}

        {active !== null && width > 0 && (
          <div
            aria-hidden="true"
            className="app-inverse pointer-events-none absolute top-0 z-10 w-max max-w-[16rem] -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-[12px] px-3 py-2 text-sm"
            style={{ left: tipLeft }}
          >
            <p className="font-semibold">{labels[active]}</p>
            <ul className="mt-1 space-y-0.5 font-mono text-[12px] tabular-nums text-[#55554F]">
              {series.map((s) => (
                <li key={s.label} className="flex justify-between gap-4">
                  <span>{s.label}</span>
                  <span className="font-semibold text-[#0A0A0A]">{fmt(s.values[active])}</span>
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
const RAMP = ["#161616", "#2E2E2C", "#5C5C59", "#A3A39F", "#F2F2EF"] as const;
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
            <div aria-hidden="true" className="grid gap-[3px] py-[3px] font-mono text-[11px] text-[#85857F]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
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
              className="grid gap-[3px] rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2F2EF]/70"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <span
                    key={`${r}-${c}`}
                    onPointerEnter={() => setActive([r, c])}
                    className={cn(
                      "relative aspect-square rounded-[3px]",
                      active?.[0] === r && active?.[1] === c && "z-[1] outline outline-2 outline-offset-1 outline-[#F2F2EF]"
                    )}
                    style={{ backgroundColor: RAMP[cell.commits === 0 ? 0 : Math.min(4, 1 + Math.floor((cell.commits / max) * 3.999))] }}
                  />
                ))
              )}
            </div>
          </div>
          <div aria-hidden="true" className="ml-[3rem] mt-1.5 grid font-mono text-[11px] text-[#85857F]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="tabular-nums text-[#9A9A96]">
          {active && shown ? (
            <>
              <span className="font-semibold text-[#F2F2EF]">
                {DOW[active[0]]} {hourText(active[1])}
              </span>
              {`: ${shown.commits} ${shown.commits === 1 ? "commit" : "commits"}, +${shown.execution}`}
            </>
          ) : (
            "Hover a cell · or arrow keys"
          )}
        </p>
        <span className="flex items-center gap-1.5 text-[#9A9A96]" aria-hidden="true">
          0
          {RAMP.map((f) => (
            <span key={f} className="size-2.5 rounded-[2px]" style={{ backgroundColor: f }} />
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
