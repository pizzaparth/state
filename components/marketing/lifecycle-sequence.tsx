"use client";

import * as React from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { DEMO_DAYS, INTENSITY_FILL, formatNumber, intensity } from "./demo-data";

const STEPS = [
  {
    title: "A task is intent",
    body: "Capture it with a title and a weight. It moves across the board as you work on it.",
  },
  {
    title: "Done becomes a commit",
    body: "The moment a task reaches Done, State writes an immutable commit with its time and execution value.",
  },
  {
    title: "Commits fill the graph",
    body: "Each day's commits add up in one cell of your execution graph. Nothing is estimated.",
  },
  {
    title: "The graph becomes measurement",
    body: "Execution, velocity and throughput update from the same records, with the arithmetic in plain view.",
  },
] as const;

const COLUMNS = ["Backlog", "Active", "Done"] as const;
const TASK = { title: "Implement temporal indexing", project: "RelayDB", weight: 4 };

const LEDGER = [
  { time: "17:51", message: "Finished market microstructure notes", value: 2 },
  { time: "16:08", message: "Fixed auth middleware", value: 2 },
  { time: "14:21", message: "Reviewed PR #38", value: 1 },
];

// Story numbers derive from the same seeded history the graph renders
const LAST_30 = DEMO_DAYS.slice(-30);
const BASE_EXECUTION = LAST_30.reduce((sum, d) => sum + d.execution, 0);
const BASE_TASKS = LAST_30.reduce((sum, d) => sum + d.tasks, 0);
const TODAY = DEMO_DAYS[DEMO_DAYS.length - 1];
const STRIP_WEEKS = 26;
const STRIP = DEMO_DAYS.slice(-STRIP_WEEKS * 7);

function stageFor(progress: number) {
  if (progress < 0.25) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.75) return 2;
  return 3;
}

function stratumClass(stage: number, own: number) {
  if (stage === own) return "opacity-100";
  return stage > own ? "opacity-50" : "opacity-20";
}

export function LifecycleSequence() {
  const ref = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = React.useState(0);
  const [column, setColumn] = React.useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setStage(stageFor(p));
    setColumn(p < 0.08 ? 0 : p < 0.18 ? 1 : 2);
  });

  // The wrapper spans the rail; translating it by a third moves the task one column
  const taskX = useTransform(scrollYProgress, [0.03, 0.08, 0.13, 0.18], ["0%", "33.333%", "33.333%", "66.666%"]);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const committed = stage >= 1;
  const counted = stage >= 2;
  const measured = stage >= 3;
  const todayExecution = TODAY.execution + (counted ? TASK.weight : 0);
  const execution = BASE_EXECUTION + (measured ? TASK.weight : 0);
  const tasks = BASE_TASKS + (measured ? 1 : 0);

  return (
    <section ref={ref} id="how-it-works" aria-labelledby="how-it-works-title" className="relative h-[400vh] scroll-mt-0">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden pt-16">
        <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:px-12">
          <div className="flex gap-6">
            <div className="relative hidden w-px shrink-0 bg-white/[0.08] sm:block" aria-hidden="true">
              <motion.div style={{ scaleY: progressScale }} className="absolute inset-0 origin-top bg-[#F4F4F2]" />
            </div>
            <div className="min-w-0">
              <h2 id="how-it-works-title" className="font-display text-[clamp(1.75rem,3.4vw,2.75rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] [font-stretch:125%] text-balance">
                From intent to measurement
              </h2>
              <ol className="mt-8 space-y-5 sm:mt-10">
                {STEPS.map((step, i) => (
                  <li
                    key={step.title}
                    aria-current={stage === i ? "step" : undefined}
                    className={cn(
                      "grid grid-cols-[2.25rem_minmax(0,1fr)] transition-opacity duration-300",
                      stage === i ? "opacity-100" : "opacity-35",
                      stage !== i && "max-sm:hidden"
                    )}
                  >
                    <span className="pt-0.5 font-mono text-xs tabular-nums text-[#6F6F6B]">{i + 1}</span>
                    <div>
                      <p className="text-lg font-semibold text-[#F4F4F2]">{step.title}</p>
                      <p
                        className={cn(
                          "mt-1 max-w-[46ch] text-sm leading-relaxed text-[#A9A9A6] transition-opacity duration-300",
                          stage === i ? "opacity-100" : "opacity-0 max-lg:hidden"
                        )}
                      >
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Instrument: a live slice of the product, driven by scroll */}
          <div aria-hidden="true" className="min-w-0 space-y-7 text-sm sm:space-y-9">
            {/* Board rail */}
            <div className={cn("transition-opacity duration-300", stratumClass(stage, 0))}>
              <div className="grid grid-cols-3 border-b border-white/[0.08] pb-2 text-xs text-[#6F6F6B]">
                {COLUMNS.map((name, i) => (
                  <span key={name} className={cn("transition-colors duration-200", column === i && "text-[#F4F4F2]")}>
                    {name}
                  </span>
                ))}
              </div>
              <div className="relative h-14">
                <motion.div style={{ x: taskX }} className="absolute inset-x-0 top-3 will-change-transform">
                  <div className="flex w-1/3 min-w-0 items-center gap-2 pr-3">
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-200",
                        column === 2 ? "border-[#F4F4F2] bg-[#F4F4F2]" : "border-white/40"
                      )}
                    >
                      {column === 2 && (
                        <svg viewBox="0 0 12 12" className="size-2.5 text-[#050505]">
                          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-[#F4F4F2]">{TASK.title}</span>
                      <span className="block truncate text-[11px] text-[#6F6F6B]">
                        {TASK.project}, major ({TASK.weight})
                      </span>
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Commit ledger */}
            <div className={cn("transition-opacity duration-300", stratumClass(stage, 1))}>
              <p className="border-b border-white/[0.08] pb-2 text-xs text-[#6F6F6B]">History, today</p>
              <ul className="mt-2">
                {committed && (
                  <motion.li
                    key="new"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-[3.25rem_1rem_minmax(0,1fr)_2.5rem] items-center py-1.5 text-[#F4F4F2]"
                  >
                    <span className="font-mono text-xs tabular-nums">18:42</span>
                    <span className="size-1.5 rounded-full bg-[#F4F4F2]" />
                    <span className="truncate">{TASK.title}</span>
                    <span className="text-right font-mono text-xs tabular-nums">+{TASK.weight}</span>
                  </motion.li>
                )}
                {LEDGER.map((row) => (
                  <motion.li
                    layout="position"
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    key={row.time}
                    className="grid grid-cols-[3.25rem_1rem_minmax(0,1fr)_2.5rem] items-center py-1.5 text-[#A9A9A6]"
                  >
                    <span className="font-mono text-xs tabular-nums text-[#6F6F6B]">{row.time}</span>
                    <span className="size-1.5 rounded-full bg-[#6F6F6B]" />
                    <span className="truncate">{row.message}</span>
                    <span className="text-right font-mono text-xs tabular-nums">+{row.value}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Execution graph strip */}
            <div className={cn("transition-opacity duration-300 max-sm:hidden", stratumClass(stage, 2))}>
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2 text-xs text-[#6F6F6B]">
                <span>Execution graph, 26 weeks</span>
                <span className="tabular-nums text-[#F4F4F2]">Today {todayExecution}</span>
              </div>
              <div
                className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${STRIP_WEEKS}, minmax(0, 14px))` }}
              >
                {STRIP.map((day, i) => {
                  const isToday = i === STRIP.length - 1;
                  const level = intensity(isToday ? todayExecution : day.execution);
                  return (
                    <span
                      key={day.date}
                      className={cn("aspect-square w-full rounded-[2px] transition-colors duration-300", isToday && counted && "ring-1 ring-[#F4F4F2] ring-offset-2 ring-offset-[#050505]")}
                      style={{ backgroundColor: INTENSITY_FILL[level] }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Measurement */}
            <dl className={cn("grid grid-cols-3 gap-4 transition-opacity duration-300", stratumClass(stage, 3))}>
              {[
                { label: "Execution, 30d", value: formatNumber(execution), formula: "Σ weights" },
                { label: "Velocity", value: `${formatNumber(execution / 30, 2)}/d`, formula: `${execution} ÷ 30` },
                { label: "Throughput", value: `${formatNumber(tasks / 30, 2)}/d`, formula: `${tasks} tasks ÷ 30` },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0 border-t border-white/[0.08] pt-2">
                  <dt className="truncate text-xs text-[#6F6F6B]">{metric.label}</dt>
                  <dd className="mt-1 font-display text-[clamp(1.25rem,2.6vw,2rem)] font-bold tabular-nums leading-none [font-stretch:110%] text-[#F4F4F2]">
                    {metric.value}
                  </dd>
                  <dd className="mt-1 truncate font-mono text-[11px] tabular-nums text-[#6F6F6B]">{metric.formula}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
