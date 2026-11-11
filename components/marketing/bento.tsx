import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/app/count-up";

/**
 * How State works, as a bento grid: each tile is one idea and one small piece of the real
 * interface. Flat tiles on the page, no cards inside cards; fragments sit on inset fields.
 */

const tile = "app-panel mi-lift flex flex-col rounded-[24px] p-6";
const label = "font-mono text-[12px] uppercase tracking-[0.16em] text-accent";
const title = "mt-2 font-display text-[clamp(1.25rem,2.2vw,1.75rem)] font-extrabold uppercase leading-[1] tracking-[-0.02em] [font-stretch:125%]";
const body = "mt-2 max-w-[44ch] text-[15px] leading-relaxed text-[#B4BEDB]";

const RAMP = ["#0B2A48", "#55306E", "#8C347C", "#C53985", "#D92B74"];

function Tile({ className, kicker, heading, text, children }: { className?: string; kicker: string; heading: string; text: string; children: React.ReactNode }) {
  return (
    <li className={cn(tile, className)}>
      <p className={label}>{kicker}</p>
      <h3 className={title}>{heading}</h3>
      <p className={body}>{text}</p>
      <div className="mt-6 flex flex-1 flex-col justify-end">{children}</div>
    </li>
  );
}

export interface Formula {
  name: string;
  value: string;
  unit?: string;
  formula: string;
}

export function Bento({ heat, formulas }: { heat: number[]; formulas: Formula[] }) {
  const max = Math.max(1, ...heat);
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  return (
    <ul className="grid gap-3 md:grid-cols-6">
      <Tile className="md:col-span-4" kicker="01 · Capture" heading="One line in, structure out." text="Type a task the way you think it. Project, priority and due day are parsed as you type.">
        <div className="app-field rounded-[16px] px-4 py-3 font-mono text-[14px]">
          Outline discussion <span className="text-accent">#thesis</span> <span className="text-accent">!high</span> fri
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {["Thesis", "High priority", "Due Fri 13 Nov"].map((chip) => (
            <span key={chip} className="rounded-full bg-accent-soft px-3 py-1 text-white ring-1 ring-accent-line">
              {chip}
            </span>
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-2" kicker="02 · Weight" heading="Weights, not guesses." text="Four fixed sizes. No story points to argue about.">
        <ul className="space-y-2">
          {[
            ["Small", 1],
            ["Normal", 2],
            ["Major", 4],
            ["Milestone", 8],
          ].map(([name, w]) => (
            <li key={name} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[14px]">
              <span className="text-[#DCE2F2]">{name}</span>
              <span className="app-field h-2 overflow-hidden rounded-full">
                <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${Number(w) / 8})` }} />
              </span>
              <span className="text-right font-mono font-semibold text-accent">+{w}</span>
            </li>
          ))}
        </ul>
      </Tile>

      <Tile className="md:col-span-2" kicker="03 · Commit" heading="Done becomes a commit." text="Move a task to Done and its weight is logged. Commits never change their time or value.">
        <div className="flex items-center gap-2 text-[14px]">
          <span className="app-field flex-1 truncate rounded-[12px] px-3 py-2 text-[#B4BEDB] line-through">Draft methods section</span>
          <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="shrink-0 rounded-[12px] bg-accent px-3 py-2 font-mono font-semibold text-white">+4</span>
        </div>
        <p className="mt-3 font-mono text-[12px] text-[#8E9AC0]">14:32 · Thesis · task completion</p>
      </Tile>

      <Tile className="md:col-span-4" kicker="04 · History" heading="Your work has a history." text="Every commit lands on the graph. A year of execution at a glance.">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] [grid-auto-columns:minmax(0,1fr)]" aria-hidden="true">
          {heat.map((v, i) => (
            <span key={i} className="aspect-square rounded-[2px]" style={{ backgroundColor: RAMP[level(v)] }} />
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-4" kicker="05 · Measure" heading="Formulas, not scores." text="Six metrics, each with the math beside it. Last 30 days of demo data.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {formulas.map((f) => (
            <div key={f.name}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#B4BEDB]">{f.name}</dt>
              <dd className="mt-1">
                <span className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums [font-stretch:125%]">
                  <CountUp value={f.value} duration={900} />
                </span>
                {f.unit && <span className="ml-1 font-mono text-[12px] text-[#8E9AC0]">{f.unit}</span>}
                <span className="mt-1 block font-mono text-[11px] text-accent">{f.formula}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Tile>

      <Tile className="md:col-span-2" kicker="06 · Private" heading="The demo keeps nothing." text="A throwaway workspace with sample data, just for you.">
        <ul className="space-y-2 text-[14px]">
          {["Survives a refresh", "Deleted on sign-out", "Deleted on tab close"].map((line) => (
            <li key={line} className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-white">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-[#DCE2F2]">{line}</span>
            </li>
          ))}
        </ul>
      </Tile>
    </ul>
  );
}
