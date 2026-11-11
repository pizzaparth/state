"use client";

import * as React from "react";
import { Pause, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/app/count-up";

/**
 * A scripted walkthrough of the product loop, played like a screen recording: a task is
 * typed into capture, lands in Queued, is dragged to Active and then Done, and the commit,
 * the day's execution and the heat strip update. It loops while on screen, pauses when
 * scrolled away, has a Pause control, and shows the finished state without motion under
 * prefers-reduced-motion. Nothing here talks to the server.
 */

const TYPED = "Draft methods section #thesis !high";
const WEIGHT = 4;

type Place = "none" | "queued" | "active" | "done";

// Each step: how long it holds, then what the scene looks like during it
const STEPS: { ms: number; typed?: number; place: Place; cursor: "field" | "card" | "active" | "done" | "rest"; dragging?: boolean; committed?: boolean }[] = [
  { ms: 700, typed: 0, place: "none", cursor: "field" },
  { ms: 1500, typed: TYPED.length, place: "none", cursor: "field" },
  { ms: 700, typed: TYPED.length, place: "queued", cursor: "field" },
  { ms: 800, place: "queued", cursor: "card" },
  { ms: 900, place: "active", cursor: "active", dragging: true },
  { ms: 600, place: "active", cursor: "active" },
  { ms: 900, place: "done", cursor: "done", dragging: true },
  { ms: 2600, place: "done", cursor: "rest", committed: true },
];

const QUEUED = [
  { title: "Write discussion chapter", project: "Thesis", weight: 8 },
  { title: "Document the CLI", project: "Relay", weight: 2 },
];
const ACTIVE = [{ title: "Implement snapshot reader", project: "Relay", weight: 4 }];
const DONE = [
  { title: "Long run 18 km", project: "Marathon", weight: 2 },
  { title: "Type scale pass", project: "Portfolio", weight: 2 },
];
const LEDGER = [
  { time: "11:42", message: "Ran 18 km long run", weight: 2 },
  { time: "09:15", message: "Finished type scale pass", weight: 2 },
  { time: "08:30", message: "Notes: read three papers", weight: 1 },
];
const HEAT = [2, 3, 0, 4, 3, 1, 2, 4, 3, 2, 0, 3, 4];
const HEAT_FILL = ["#0B2A48", "#55306E", "#8C347C", "#C53985", "#E8357F"];

function Card({ title, project, weight, done, className, style, refProp }: { title: string; project: string; weight: number; done?: boolean; className?: string; style?: React.CSSProperties; refProp?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={refProp} style={style} className={cn("app-card rounded-[14px] px-3 py-2.5", className)}>
      <p className={cn("truncate text-[13px] font-medium", done ? "text-[#B4BEDB] line-through decoration-[#8E9AC0]" : "text-white")}>{title}</p>
      <p className="mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[#8E9AC0]">
        {project}
        <span className="text-[12px] font-semibold text-accent">+{weight}</span>
      </p>
    </div>
  );
}

export function LiveDemo() {
  const [step, setStep] = React.useState(STEPS.length - 1);
  const [typed, setTyped] = React.useState(TYPED.length);
  const [playing, setPlaying] = React.useState(false);
  const [userPaused, setUserPaused] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [geo, setGeo] = React.useState<Record<string, { x: number; y: number; w: number }>>({});

  const root = React.useRef<HTMLDivElement>(null);
  const field = React.useRef<HTMLDivElement>(null);
  const slots = { queued: React.useRef<HTMLDivElement>(null), active: React.useRef<HTMLDivElement>(null), done: React.useRef<HTMLDivElement>(null) };

  const s = STEPS[step];

  // Start from the top on first view; reduced motion keeps the finished frame
  React.useEffect(() => {
    const motionOff = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(motionOff);
    if (motionOff || !root.current) return;
    setStep(0);
    setTyped(0);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => setPlaying(visible && !userPaused && !reduced), [visible, userPaused, reduced]);

  // Where the moving card and the cursor go: measured from the slots in each column
  const measure = React.useCallback(() => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const at = (el: HTMLElement | null) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left - box.left, y: r.top - box.top, w: r.width } : { x: 0, y: 0, w: 0 };
    };
    setGeo({ field: at(field.current), queued: at(slots.queued.current), active: at(slots.active.current), done: at(slots.done.current) });
    // Slots are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, [measure]);

  // Advance the script
  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setStep((n) => (n + 1) % STEPS.length), s.ms);
    return () => window.clearTimeout(timer);
  }, [playing, step, s.ms]);

  // Typing: one character at a time while the typing step plays
  React.useEffect(() => {
    if (!playing) return;
    if (step === 0) setTyped(0);
    if (step !== 1) return;
    const id = window.setInterval(() => setTyped((n) => Math.min(TYPED.length, n + 1)), Math.floor(1300 / TYPED.length));
    return () => window.clearInterval(id);
  }, [playing, step]);

  const place = s.place;
  const committed = Boolean(s.committed);
  const today = 16 + (committed ? WEIGHT : 0);
  const target = place === "none" ? null : geo[place];
  const cursorAt =
    s.cursor === "field"
      ? { x: (geo.field?.x ?? 0) + 24 + Math.min(typed, TYPED.length) * 6.4, y: (geo.field?.y ?? 0) + 22 }
      : s.cursor === "rest"
        ? { x: (geo.done?.x ?? 0) + (geo.done?.w ?? 0) * 0.7, y: (geo.done?.y ?? 0) + 90 }
        : { x: (geo[s.cursor === "card" ? "queued" : s.cursor]?.x ?? 0) + (geo.queued?.w ?? 0) * 0.55, y: (geo[s.cursor === "card" ? "queued" : s.cursor]?.y ?? 0) + 26 };
  const shownText = TYPED.slice(0, typed);

  return (
    <div>
      <div ref={root} className="relative select-none" aria-label="Animated walkthrough: capture a task, move it to Done, and see the commit and metrics update" role="img">
        {/* Top strip: capture and the day's execution */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div ref={field} className="app-field flex h-11 items-center gap-2 rounded-[14px] pl-4 pr-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
              {shownText ? (
                <>
                  {shownText.split(" ").map((word, i) => (
                    <span key={i} className={cn(word.startsWith("#") || word.startsWith("!") ? "text-accent" : "text-white")}>
                      {i > 0 && " "}
                      {word}
                    </span>
                  ))}
                  {step === 1 && <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-accent" />}
                </>
              ) : (
                <span className="text-[#8E9AC0]">Add a task… #project !high fri</span>
              )}
            </span>
            <span className={cn("app-btn inline-flex h-8 items-center gap-1 rounded-[10px] px-3 text-[13px] transition-transform", step === 2 && "scale-95")}>
              <Plus className="size-3.5" aria-hidden="true" />
              Capture
            </span>
          </div>
          <div className={cn("app-inverse flex h-11 items-center gap-3 rounded-[14px] px-4 transition-transform duration-300", committed && "scale-[1.04]")}>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-muted">Today</span>
            <span className="font-display text-xl font-extrabold tabular-nums [font-stretch:125%]">
              <CountUp value={`+${today}`} duration={700} />
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {/* Board */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["queued", "Queued", QUEUED],
                ["active", "Active", ACTIVE],
                ["done", "Done", DONE],
              ] as const
            ).map(([key, name, cards]) => (
              <div key={key} className={cn("app-panel rounded-[18px] p-2.5 transition-[border-color] duration-300", s.dragging && place === key && "border-accent")}>
                <p className="mb-2 flex items-center justify-between px-1 font-display text-[13px] font-extrabold uppercase [font-stretch:125%]">
                  {name}
                  <span className="font-mono text-[11px] font-normal text-[#8E9AC0]">
                    {cards.length + (place === key ? 1 : 0)}
                  </span>
                </p>
                <div className="space-y-2">
                  {/* Slot the moving card lands in; holds its height so the column grows */}
                  <div ref={slots[key]} className={cn("transition-[height] duration-300", place === key ? "h-[58px]" : "h-0")} />
                  {cards.map((c) => (
                    <Card key={c.title} {...c} done={key === "done"} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Ledger and heat strip */}
          <div className="app-panel hidden rounded-[18px] p-3 lg:block">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#B4BEDB]">Commits</p>
            <ul className="space-y-1">
              {committed && (
                <li className="mi-pop flex items-center gap-2 rounded-[10px] bg-accent-soft px-2 py-1.5 text-[12px]">
                  <span className="font-mono text-[#8E9AC0]">now</span>
                  <span className="size-1.5 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1 truncate text-white">Drafted methods section</span>
                  <span className="font-mono font-semibold text-accent">+{WEIGHT}</span>
                </li>
              )}
              {LEDGER.map((row) => (
                <li key={row.message} className="flex items-center gap-2 px-2 py-1.5 text-[12px]">
                  <span className="font-mono text-[#8E9AC0]">{row.time}</span>
                  <span className="size-1.5 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1 truncate text-[#DCE2F2]">{row.message}</span>
                  <span className="font-mono font-semibold text-accent">+{row.weight}</span>
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#B4BEDB]">Last 14 days</p>
            <div className="grid grid-cols-7 gap-1">
              {[...HEAT, committed ? 4 : 2].map((level, i) => (
                <span
                  key={i}
                  className={cn("aspect-square rounded-[3px] transition-[background-color,transform] duration-500", i === HEAT.length && committed && "scale-110")}
                  style={{ backgroundColor: HEAT_FILL[level] }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* The card being moved */}
        {target && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-10"
            style={{
              width: target.w,
              transform: `translate3d(${target.x}px, ${target.y}px, 0)`,
              transition: reduced ? "none" : "transform 820ms cubic-bezier(0.65, 0, 0.35, 1)",
            }}
          >
            <Card
              title="Draft methods section"
              project="Thesis"
              weight={WEIGHT}
              done={place === "done"}
              className={cn("transition-[transform,border-color] duration-300", step === 2 && "mi-pop", s.dragging ? "rotate-[2deg] scale-[1.05] border-accent" : place === "done" ? "border-accent-line" : "")}
            />
            {committed && (
              <span className="mi-float absolute -top-3 right-2 rounded-full bg-accent px-2 py-0.5 font-mono text-[12px] font-bold text-accent-ink">+{WEIGHT}</span>
            )}
          </div>
        )}

        {/* Cursor */}
        {!reduced && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-0 top-0 z-20 size-5 drop-shadow-none"
            style={{
              transform: `translate3d(${cursorAt.x}px, ${cursorAt.y}px, 0) scale(${s.dragging || step === 3 ? 0.88 : 1})`,
              transition: step === 1 ? "transform 60ms linear" : "transform 820ms cubic-bezier(0.65, 0, 0.35, 1)",
            }}
          >
            <path d="M2 1.5 13.5 8.2 8.4 9.3 6.1 14.2Z" fill="#FFFFFF" stroke="#000E1C" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Moving content needs a way to stop it */}
      {!reduced && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            className="app-btn mi-press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium"
          >
            {userPaused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
            {userPaused ? "Play walkthrough" : "Pause walkthrough"}
          </button>
        </div>
      )}
    </div>
  );
}
