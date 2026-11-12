import * as React from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/app/count-up";

/**
 * Small pieces of the real product drawn in its white theme, for the landing page. Each
 * one loops a short piece of motion (typing, filling, ticking) so the cards stay alive.
 * They are pictures: every one is aria-hidden, and the section around it carries the text.
 * Reduced motion stops every loop on its first frame (styles/globals.css).
 */

const field = "rounded-[14px] border border-black/[0.08] bg-white";
const tick = "font-mono text-[11px] uppercase tracking-[0.16em] text-[#71717A]";

// Single-hue sequential ramp: grey to accent
export const RAMP = ["#EBEBEB", "#F5C6D9", "#EC94B8", "#E25F96", "#D92B74"];

export function Heatmap({ heat, className, cell = "rounded-[3px]" }: { heat: number[]; className?: string; cell?: string }) {
  const max = Math.max(1, ...heat);
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  return (
    <div aria-hidden="true" className={cn("grid grid-flow-col grid-rows-7 gap-[3px] [grid-auto-columns:minmax(0,1fr)]", className)}>
      {heat.map((v, i) => {
        const col = Math.floor(i / 7);
        return (
          <span key={i} className={cn("aspect-square animate-cell-in", cell)} style={{ animationDelay: `${Math.min(900, col * 18 + (i % 7) * 12)}ms` }}>
            <span
              className={cn("live-wave block size-full", cell)}
              style={{ backgroundColor: RAMP[level(v)], animationDelay: `${(col * 70 + (i % 7) * 40) % 2800}ms` }}
            />
          </span>
        );
      })}
    </div>
  );
}

export function CaptureLine({ className, big }: { className?: string; big?: boolean }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className={cn(field, "flex items-center gap-2 pl-4 pr-1.5 font-mono", big ? "h-14 text-[15px]" : "h-11 text-[13px]")}>
        <span className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          Outline discussion <span className="text-accent">#thesis</span> <span className="text-accent">!high</span> fri
          <span className="live-type-mask absolute inset-0 bg-white" />
        </span>
        <span className={cn("flex shrink-0 items-center gap-1 rounded-[10px] bg-[#0A0A0A] px-3 font-sans font-medium text-white", big ? "h-10 text-[14px]" : "h-8 text-[12px]")}>
          <Plus className="size-3.5" />
          Capture
        </span>
      </div>
      <div className={cn("mt-3 flex flex-wrap gap-2", big ? "text-[14px]" : "text-[12px]")}>
        {["Thesis", "High priority", "Due Fri 13 Nov"].map((chip, i) => (
          <span key={chip} className="live-chip rounded-full bg-white px-3 py-1.5 ring-1 ring-black/[0.08]" style={{ animationDelay: `${i * 140}ms` }}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

const WEIGHTS = [
  ["Small", 1],
  ["Normal", 2],
  ["Major", 4],
  ["Milestone", 8],
] as const;

export function WeightBars({ className, big }: { className?: string; big?: boolean }) {
  return (
    <ul aria-hidden="true" className={cn(big ? "space-y-4" : "space-y-2.5", className)}>
      {WEIGHTS.map(([name, w], i) => (
        <li key={name} className={cn("grid items-center gap-3", big ? "grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] text-[17px]" : "grid-cols-[5rem_minmax(0,1fr)_2rem] text-[13px]")}>
          <span className="text-[#3F3F46]">{name}</span>
          <span className={cn("overflow-hidden rounded-full bg-[#E4E4E7]", big ? "h-3" : "h-2")}>
            <span className="live-fill block h-full rounded-full bg-accent" style={{ "--to": w / 8, animationDelay: `${i * 160}ms` } as React.CSSProperties} />
          </span>
          <span className={cn("text-right font-mono font-semibold", big && "text-[18px]")}>+{w}</span>
        </li>
      ))}
    </ul>
  );
}

export function TaskToCommit({ className, big }: { className?: string; big?: boolean }) {
  return (
    <div aria-hidden="true" className={className}>
      {[
        ["Draft methods section", 4],
        ["Ran 18 km long run", 2],
      ].map(([title, w], i) => (
        <div key={title} className={cn("flex items-center gap-2", big ? "text-[16px]" : "text-[13px]", i > 0 && "mt-3")}>
          <span className={cn(field, "relative min-w-0 flex-1 truncate text-[#52525B]", big ? "px-4 py-3" : "px-3 py-2")}>
            {title}
            <span className="live-strike absolute left-4 right-4 top-1/2 h-[1.5px] bg-[#71717A]" style={{ animationDelay: `${i * 600}ms` }} />
          </span>
          <ArrowRight className="live-nudge size-5 shrink-0" style={{ animationDelay: `${i * 600}ms` }} />
          <span className={cn("live-pop shrink-0 rounded-[12px] bg-accent font-mono font-semibold text-white", big ? "px-4 py-3 text-[17px]" : "px-3 py-2")} style={{ animationDelay: `${i * 600}ms` }}>
            +{w}
          </span>
        </div>
      ))}
      <p className={cn("mt-3 font-mono text-[#71717A]", big ? "text-[13px]" : "text-[11px]")}>14:32 · Thesis · task completion</p>
    </div>
  );
}

export interface Formula {
  name: string;
  value: string;
  unit?: string;
  formula: string;
}

export function FormulaGrid({ formulas, className }: { formulas: Formula[]; className?: string }) {
  return (
    <dl aria-hidden="true" className={cn("grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3", className)}>
      {formulas.map((f) => (
        <div key={f.name} className="min-w-0">
          <dt className={cn(tick, "text-[10px]")}>{f.name}</dt>
          <dd className="mt-1">
            <span className="text-[1.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              <CountUp value={f.value} duration={1100} />
            </span>
            {f.unit && <span className="ml-1 font-mono text-[11px] text-[#71717A]">{f.unit}</span>}
            <span className="mt-1 block truncate font-mono text-[10px] text-[#71717A]">{f.formula}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const COLUMNS = [
  { name: "To do", total: 2, cards: [["Plan taper week", "Marathon", 1], ["Email supervisor", "Thesis", 1]] },
  { name: "Doing", total: 8, cards: [["Literature review", "Thesis", 4], ["Snapshot reader", "Relay", 4]] },
  { name: "Done", total: 12, cards: [["Drafted methods", "Thesis", 4]] },
] as const;

/**
 * A three-column board where the top Doing card is lifted, carried into the empty slot at
 * the top of Done, dropped, and then reset. Slots are dashed so nothing overlaps: the card
 * travels exactly one column (its own width plus the column padding and gap).
 */
export function KanbanMini({ className, big }: { className?: string; big?: boolean }) {
  const card = cn("rounded-[10px] border border-black/[0.06] bg-white", big ? "h-[3.75rem] p-2.5" : "h-[3.1rem] p-2");
  const slot = cn("rounded-[10px] border-[1.5px] border-dashed border-black/[0.12]", big ? "h-[3.75rem]" : "h-[3.1rem]");
  const body = (title: string, project: string, w: number, done?: boolean) => (
    <>
      <span className={cn("block truncate font-medium", big ? "text-[13px]" : "text-[11px]", done && "text-[#71717A] line-through")}>{title}</span>
      <span className={cn("mt-1 flex items-center justify-between text-[#71717A]", big ? "text-[11px]" : "text-[10px]")}>
        <span className="truncate">{project}</span>
        <span className="font-mono font-semibold text-accent">+{w}</span>
      </span>
    </>
  );
  return (
    <div aria-hidden="true" className={cn("grid grid-cols-3", big ? "gap-3" : "gap-2.5", className)}>
      {COLUMNS.map((col) => (
        <div key={col.name} className={cn("min-w-0 rounded-[14px] bg-[#EBEBEB]/60", big ? "p-3" : "p-2.5")}>
          <p className={cn("flex items-baseline justify-between gap-1 whitespace-nowrap px-1 pb-2 font-semibold", big ? "text-[15px]" : "text-[12px]")}>
            {col.name} <span className="font-mono text-[10px] font-normal text-[#71717A]">Σ{col.total}</span>
          </p>
          <ul className="space-y-2">
            {col.name === "Done" && (
              <li className={cn(slot, "relative")}>
                <span className="live-slot absolute -inset-[1.5px] rounded-[10px] border-[1.5px] border-accent bg-accent/[0.08]" />
              </li>
            )}
            {col.cards.map(([title, project, w], i) =>
              col.name === "Doing" && i === 0 ? (
                <li key={title} className="relative">
                  <span className={cn(slot, "absolute inset-0")} />
                  <span
                    className={cn(card, "live-drag relative z-[2] block border-accent")}
                    style={{ "--travel": big ? "calc(100% + 36px)" : "calc(100% + 30px)" } as React.CSSProperties}
                  >
                    {body(title, project, w)}
                  </span>
                </li>
              ) : (
                <li key={title} className={card}>
                  {body(title, project, w, col.name === "Done")}
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

const COMMITS = [
  ["14:32", "Drafted methods section", "Thesis", 4],
  ["11:42", "Ran 18 km long run", "Marathon", 2],
  ["09:15", "Finished type scale pass", "Portfolio", 2],
  ["08:30", "Read three papers on sampling", "Thesis", 1],
] as const;

export function CommitLedger({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <ul aria-hidden="true" className={cn("relative", className)}>
      <span className="absolute bottom-2 left-[3.35rem] top-2 w-px bg-black/[0.08]" />
      {COMMITS.slice(0, rows).map(([time, title, project, w], i) => (
        <li key={title} className="live-row relative grid grid-cols-[2.6rem_1.5rem_minmax(0,1fr)_auto] items-center gap-1 py-1.5 text-[12px]" style={{ animationDelay: `${i * 350}ms` }}>
          <span className="font-mono text-[11px] text-[#71717A]">{time}</span>
          <span className="mx-auto size-2 rounded-full bg-accent" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="text-[10px] text-[#71717A]">{project}</span>
          </span>
          <span className="font-mono font-semibold">+{w}</span>
        </li>
      ))}
    </ul>
  );
}

export function TodayCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("rounded-[18px] bg-accent p-4 text-white", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Execution today</p>
      <p className="live-breathe mt-2 text-[3.5rem] font-semibold leading-[0.9] tracking-[-0.05em] tabular-nums">
        <CountUp value="+20" duration={1200} />
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/30 pt-2.5 font-mono">
        {[
          ["Commits", "4"],
          ["Done", "4"],
          ["7D avg", "8.1"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[9px] uppercase tracking-[0.14em]">{k}</p>
            <p className="text-[14px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarsMini({ values, className, live = true }: { values: number[]; className?: string; live?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div aria-hidden="true" className={cn("flex h-28 items-end gap-1", className)}>
      {values.map((v, i) => (
        <span key={i} className="flex h-full flex-1 items-end">
          <span className="block w-full origin-bottom animate-grow-y" style={{ height: `${Math.max(4, (v / max) * 100)}%`, animationDelay: `${i * 70}ms` }}>
            <span
              className={cn("block size-full rounded-t-[3px]", live && "live-grow", i === values.length - 1 ? "bg-accent" : "bg-[#0A0A0A]")}
              style={{ animationDelay: `${i * 140}ms` }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}

export function DemoChecks({ className, big }: { className?: string; big?: boolean }) {
  return (
    <ul aria-hidden="true" className={cn(big ? "space-y-4 text-[18px]" : "space-y-2 text-[13px]", className)}>
      {["Survives a refresh", "Deleted on sign-out", "Deleted on tab close"].map((line, i) => (
        <li key={line} className="flex items-center gap-3">
          <span className={cn("grid shrink-0 place-items-center rounded-full bg-[#E4E4E7]", big ? "size-9" : "size-6")}>
            <span className={cn("live-check grid size-full place-items-center rounded-full bg-[#0A0A0A] text-white")} style={{ animationDelay: `${i * 450}ms` }}>
              <Check className={big ? "size-4" : "size-3"} />
            </span>
          </span>
          {line}
        </li>
      ))}
    </ul>
  );
}
