"use client";

import * as React from "react";
import { Activity, BarChart3, Calendar, Check, FolderKanban, History, Inbox, Plus, Search, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTHOR } from "@/lib/site";
import { Sparkline } from "@/components/app/charts";
import { CountUp } from "@/components/app/count-up";

/**
 * The hero picture: State's real app shell in its white theme, drawn at 1280 × 800 and
 * scaled to fit. A scripted cursor uses it on a loop: it captures a task, finishes it,
 * opens Metrics and drags a card on the board; the camera zooms in while typing and on
 * each task action.
 * It is a picture: hidden from assistive tech, described by the caption, not interactive.
 * It runs only while on screen; reduced motion shows the still Today screen.
 */

const W = 1280;
const H = 800;

type Screen = "today" | "metrics" | "board";
interface Task {
  id: string;
  title: string;
  project: string;
  due: string;
  priority: string;
  weight: number;
}

const ACTIVE: Task[] = [
  { id: "a", title: "Finish literature review", project: "Thesis", due: "Tomorrow", priority: "High", weight: 4 },
  { id: "b", title: "Implement snapshot reader", project: "Relay", due: "15 Nov", priority: "Medium", weight: 4 },
  { id: "c", title: "Plan taper week", project: "Marathon", due: "", priority: "Low", weight: 1 },
];
const NEW_TASK: Task = { id: "n", title: "Outline discussion", project: "Thesis", due: "Fri", priority: "High", weight: 4 };
const TYPED = "Outline discussion #thesis !high fri";

const COMMITS = [
  { time: "11:42", title: "Recovery run 6 km", project: "Marathon", weight: 4 },
  { time: "09:15", title: "Revised chapter 2 intro", project: "Thesis", weight: 2 },
  { time: "08:30", title: "Read three papers on sampling", project: "Thesis", weight: 1 },
];

const NAV = [
  { name: "Today", icon: Calendar, screen: "today" as Screen },
  { name: "Inbox", icon: Inbox, badge: 3 },
  { section: "Execution" },
  { name: "Metrics", icon: BarChart3, screen: "metrics" as Screen },
  { name: "Activity", icon: Activity },
  { name: "History", icon: History },
  { section: "Work" },
  { name: "Personal", icon: User, screen: "board" as Screen },
  { name: "Projects", icon: FolderKanban },
] as const;

const SPARK = [
  [4, 6, 5, 8, 7, 9, 11, 10, 12, 14],
  [3, 4, 4, 5, 6, 5, 7, 8, 8, 9],
  [2, 3, 2, 4, 3, 4, 5, 4, 6, 6],
  [60, 64, 70, 68, 75, 80, 84, 86, 88, 89],
  [40, 38, 41, 36, 35, 37, 33, 31, 30, 29],
  [70, 72, 75, 74, 78, 80, 79, 82, 83, 83],
  [5, 7, 6, 9, 8, 10, 11, 12, 11, 13],
  [2, 3, 4, 4, 5, 6, 7, 7, 8, 9],
];
const METRICS = [
  ["Execution / 30d", "245", "▲102% vs prior 30d", "Σ task + manual weights"],
  ["Velocity", "8.17", "▲102% vs prior 30d", "245 ÷ 30 days"],
  ["Throughput", "2.20", "▲50% vs prior 30d", "66 ÷ 30 days"],
  ["Completion", "89.2%", "▲4% vs prior 30d", "58 ÷ 65 planned"],
  ["Cycle time", "37.7h", "▼21% vs prior 30d", "median(done − started)"],
  ["Consistency", "83%", "▲3.8% vs prior 30d", "25 ÷ 30 days active"],
  ["Commits", "77", "▲63% vs prior 30d", "tasks + manual"],
  ["Tasks done", "66", "▲50% vs prior 30d", "reached Done"],
];

const BOARD = {
  Queued: [
    ["Write discussion chapter", "Thesis", "28 Nov", 8],
    ["Document the CLI", "Relay", "", 2],
    ["Prototype onboarding flow", "Portfolio", "18 Nov", 2],
  ],
  Active: [
    ["Finish literature review", "Thesis", "Tomorrow", 4],
    ["Implement snapshot reader", "Relay", "15 Nov", 4],
    ["Plan taper week", "Marathon", "", 1],
  ],
  Done: [
    ["Write migration guide", "Relay", "", 1],
    ["Add range scan tests", "Relay", "", 2],
    ["Export icon set", "Portfolio", "", 4],
  ],
} as const;

const tick = "font-mono text-[11px] uppercase tracking-[0.16em]";
const panel = "rounded-[24px] border border-black/[0.06] bg-[#F5F5F5]";

function useScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PlatformDemo({ caption }: { caption: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const scale = useScale(box);

  const [screen, setScreen] = React.useState<Screen>("today");
  // Cursor position in canvas pixels, and how long its current move takes
  const [cursor, setCursor] = React.useState({ x: 980, y: 640, ms: 0 });
  const [pressed, setPressed] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  // Camera: scale about the canvas origin plus a pan, so every zoom and pan is one
  // continuous transform (no jumps from a moving transform-origin)
  const [camera, setCamera] = React.useState({ s: 1, x: 0, y: 0, ms: 900 });
  const [typed, setTyped] = React.useState("");
  const [active, setActive] = React.useState<Task[]>(ACTIVE);
  const [done, setDone] = React.useState<Task[]>([]);
  const [execution, setExecution] = React.useState(20);
  const [moved, setMoved] = React.useState(false);
  const [drag, setDrag] = React.useState<{ x: number; y: number; ms: number } | null>(null);
  const [date, setDate] = React.useState("");

  React.useEffect(() => {
    setDate(new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
  }, []);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.25 });
    if (box.current) io.observe(box.current);

    // Canvas coordinates of a target's centre; offsets ignore the camera transform
    const at = (target: string, dx = 0, dy = 0) => {
      const root = canvas.current;
      const el = root?.querySelector<HTMLElement>(`[data-target="${target}"]`);
      if (!root || !el) return { x: W / 2, y: H / 2 };
      let x = el.offsetWidth / 2;
      let y = el.offsetHeight / 2;
      let node: HTMLElement | null = el;
      while (node && node !== root) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return { x: x + dx, y: y + dy };
    };
    // Sleep, and hold the script while the demo is off screen
    const wait = async (ms: number) => {
      await sleep(ms);
      while (alive && !visible) await sleep(200);
    };
    const look = (p: { x: number; y: number }, s: number, ms = 1000) => {
      // Centre p on screen at scale s, clamped so the canvas always covers the frame
      const clamp = (v: number, lo: number) => Math.min(0, Math.max(lo, v));
      setCamera({ s, x: s === 1 ? 0 : clamp(W / 2 - p.x * s, W - W * s), y: s === 1 ? 0 : clamp(H / 2 - p.y * s, H - H * s), ms });
    };
    const point = (p: { x: number; y: number }, ms = 900) => setCursor({ ...p, ms });
    const click = async () => {
      setPressed(true);
      setClicks((c) => c + 1);
      await wait(140);
      setPressed(false);
      await wait(220);
    };

    const run = async () => {
      while (alive) {
        // The morning's Today screen
        setScreen("today");
        setActive(ACTIVE);
        setDone([]);
        setExecution(20);
        setTyped("");
        setMoved(false);
        setDrag(null);
        look({ x: 0, y: 0 }, 1, 900);
        await wait(1600);
        if (!alive) return;

        // 1. Capture: the camera closes in on the field as the cursor arrives, then types
        const field = at("capture", -160);
        point(field, 1100);
        look(at("capture"), 1.7, 1100);
        await wait(1250);
        await click();
        await wait(250);
        for (let i = 1; i <= TYPED.length && alive; i++) {
          setTyped(TYPED.slice(0, i));
          await wait(TYPED[i - 1] === " " ? 110 : 55);
        }
        await wait(650);
        point(at("capture-btn"), 650);
        await wait(750);
        await click();
        setActive([NEW_TASK, ...ACTIVE]);
        setTyped("");
        await wait(500);
        look({ x: 0, y: 0 }, 1, 1000);
        await wait(1200);

        // 2. Finish it: tick the new task; its weight lands on today's execution
        point(at("check-n"), 1000);
        look(at("active-panel"), 1.45, 1000);
        await wait(1150);
        await click();
        setActive(ACTIVE);
        setDone([NEW_TASK]);
        await wait(700);
        look(at("execution"), 1.5, 1000);
        point(at("execution", 90, 40), 1000);
        await wait(1000);
        // Count the weight in, one point at a time
        for (let v = 21; v <= 24 && alive; v++) {
          setExecution(v);
          await wait(160);
        }
        await wait(1300);
        look({ x: 0, y: 0 }, 1, 1000);
        await wait(1100);

        // 3. Metrics: open the page and let the cards and numbers land
        point(at("nav-metrics"), 1100);
        await wait(1200);
        await click();
        setScreen("metrics");
        await wait(3200);

        // 4. Board: drag the top Active card into Done
        point(at("nav-board"), 1100);
        await wait(1200);
        await click();
        setScreen("board");
        await wait(1300);
        const from = at("card-active-0");
        point(from, 1000);
        look(at("board-grid"), 1.25, 1000);
        await wait(1150);
        setPressed(true);
        setDrag({ x: 0, y: 0, ms: 0 });
        await wait(250);
        const to = at("drop-done");
        point(to, 1300);
        setDrag({ x: to.x - from.x, y: to.y - from.y, ms: 1300 });
        await wait(1400);
        setPressed(false);
        setDrag(null);
        setMoved(true);
        await wait(1500);
        look({ x: 0, y: 0 }, 1, 1000);
        await wait(1100);

        // Back to Today, then the loop starts over
        point(at("nav-today"), 1100);
        await wait(1200);
        await click();
        await wait(300);
      }
    };
    run();
    return () => {
      alive = false;
      io.disconnect();
    };
  }, []);

  const activeNav = screen;
  const boardCols = {
    Queued: BOARD.Queued,
    Active: moved ? BOARD.Active.slice(1) : BOARD.Active,
    Done: moved ? [BOARD.Active[0], ...BOARD.Done] : BOARD.Done,
  };
  const ease = "cubic-bezier(0.65, 0, 0.35, 1)";

  return (
    <figure className="relative">
      <div className="rounded-[28px] bg-[#F5F5F5] p-2 sm:rounded-[40px] sm:p-5 lg:p-6">
        <div ref={box} className="relative w-full overflow-hidden rounded-[18px] border border-black/[0.06] bg-white sm:rounded-[24px]" style={{ height: H * scale }}>
          <div aria-hidden="true" className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            {/* Camera: zooms on the cursor's target */}
            <div
              ref={canvas}
              className="relative flex h-full w-full origin-top-left bg-white text-[#0A0A0A] will-change-transform"
              style={{
                transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.s})`,
                transition: `transform ${camera.ms}ms ${ease}`,
              }}
            >
              {/* Sidebar */}
              <div className="m-3 flex w-[216px] shrink-0 flex-col rounded-[24px] border border-black/[0.06] bg-[#F5F5F5]">
                <div className="px-5 pb-4 pt-5">
                  <p className={cn(tick, "text-[10px] text-[#71717A]")}>{AUTHOR}</p>
                  <p className="text-[24px] font-semibold leading-none tracking-[-0.04em]">State</p>
                </div>
                <div className="space-y-0.5 px-3">
                  {NAV.map((item) =>
                    "section" in item ? (
                      <p key={item.section} className={cn(tick, "px-3 pb-1 pt-4 text-[10px] text-[#71717A]")}>
                        {item.section}
                      </p>
                    ) : (
                      <div
                        key={item.name}
                        data-target={"screen" in item ? `nav-${item.screen}` : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-semibold transition-colors duration-300",
                          "screen" in item && item.screen === activeNav ? "bg-[#0A0A0A] text-white" : "text-[#27272A]"
                        )}
                      >
                        <item.icon className="size-4" />
                        <span className="flex-1">{item.name}</span>
                        {"badge" in item && <span className="font-mono text-[12px] text-[#71717A]">{item.badge}</span>}
                      </div>
                    )
                  )}
                </div>
                <div className="mt-auto border-t border-black/[0.06] p-3">
                  <div className="flex items-center gap-3 px-3 py-2 text-[14px] font-semibold text-[#27272A]">
                    <Settings className="size-4" />
                    Settings
                  </div>
                </div>
              </div>

              {/* Main */}
              <div className="flex min-w-0 flex-1 flex-col px-7 py-3">
                <div className="flex h-12 items-center justify-between">
                  <div className={cn(tick, "flex items-center gap-5 text-[#52525B]")}>
                    <span>
                      Today <b className="text-[#0A0A0A]">+{execution}</b>
                    </span>
                    <span>
                      7D <b className="text-[#0A0A0A]">39 ▲26%</b>
                    </span>
                    <span>
                      Vel <b className="text-[#0A0A0A]">5.6/d</b>
                    </span>
                    <span>
                      Active <b className="text-[#0A0A0A]">5/7</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 items-center gap-2 rounded-[12px] border border-black/[0.1] px-3 text-[13px] text-[#71717A]">
                      <Search className="size-3.5" />
                      Search…
                      <span className="ml-6 rounded-[6px] bg-black/[0.05] px-1.5 font-mono text-[11px]">⌘ K</span>
                    </span>
                    <span className="flex h-9 items-center gap-1.5 rounded-[12px] bg-accent px-4 text-[13px] font-semibold tracking-[0.06em] text-white">
                      <Plus className="size-3.5" />
                      COMMIT
                    </span>
                  </div>
                </div>

                <div key={screen} className="animate-page-in mt-4 min-h-0 flex-1 [animation-duration:500ms]">
                  {screen === "today" && (
                    <TodayScreen date={date} typed={typed} active={active} done={done} execution={execution} />
                  )}
                  {screen === "metrics" && <MetricsScreen />}
                  {screen === "board" && <BoardScreen cols={boardCols} moved={moved} drag={drag} ease={ease} />}
                </div>
              </div>

              {/* Cursor */}
              <div
                className="pointer-events-none absolute left-0 top-0 z-30"
                style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`, transition: `transform ${cursor.ms}ms ${ease}` }}
              >
                {clicks > 0 && <span key={clicks} className="demo-click absolute -left-5 -top-5 size-10 rounded-full border-2 border-accent" />}
                <svg
                  width="22"
                  height="26"
                  viewBox="0 0 22 26"
                  className="relative -translate-x-[2px] -translate-y-[2px] transition-transform duration-150"
                  style={{ transform: pressed ? "scale(0.85)" : undefined, transformOrigin: "2px 2px" }}
                >
                  <path d="M2 2 L2 21 L7.5 16 L11 24 L14.5 22.5 L11 14.5 L18.5 14.5 Z" fill="#0A0A0A" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

function TodayScreen({ date, typed, active, done, execution }: { date: string; typed: string; active: Task[]; done: Task[]; execution: number }) {
  return (
    <>
      <p className={cn(tick, "text-accent")} suppressHydrationWarning>
        {date || "Today"}
      </p>
      <p className="text-[56px] font-semibold leading-[1] tracking-[-0.045em]">Today</p>
      <div className="mt-5 grid grid-cols-[300px_minmax(0,1fr)] gap-4">
        <div data-target="execution" className="rounded-[24px] bg-accent p-5 text-white">
          <p className={tick}>Execution today</p>
          <p key={execution} className={cn("mt-3 text-[88px] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums", execution > 20 && "tick-pop")}>
            +{execution}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/30 pt-3 font-mono">
            {[
              ["Commits", String(3 + done.length)],
              ["Done", String(1 + done.length)],
              ["7D avg", "5.6"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-[0.16em]">{k}</p>
                <p className="text-[17px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={cn(panel, "p-5")}>
          <p className={cn(tick, "flex items-center gap-2 text-[#27272A]")}>
            <span className="size-1.5 rounded-[2px] bg-accent" />
            Capture
          </p>
          <div data-target="capture" className="mt-3 flex h-12 items-center gap-2 rounded-[14px] border border-black/[0.1] bg-white pl-4 pr-1.5 font-mono text-[14px]">
            <span className="flex-1 truncate">
              {typed ? (
                <Highlighted text={typed} />
              ) : (
                <span className="text-[#71717A]">Add a task… #project !high fri</span>
              )}
              {typed && <span className="demo-caret ml-px inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-accent" />}
            </span>
            <span data-target="capture-btn" className={cn("flex h-9 items-center gap-1 rounded-[10px] px-3 font-sans text-[13px] transition-colors", typed ? "bg-[#0A0A0A] text-white" : "border border-black/[0.1] text-[#52525B]")}>
              <Plus className="size-3.5" />
              Capture
            </span>
          </div>
          <p className="mt-3 min-h-[18px] text-[12px] text-[#52525B]">
            {typed.length > 20 ? (
              <span className="animate-fade-in [animation-duration:300ms]">
                Task <b className="text-[#0A0A0A]">“Outline discussion”</b>, project Thesis{typed.includes("!high") && ", high priority"}
                {typed.endsWith("fri") && ", due Fri"}
              </span>
            ) : (
              <span className="font-mono text-[#71717A]">C commit · ⌘ K everything</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div data-target="active-panel" className={cn(panel, "p-5")}>
          <p className={cn(tick, "flex justify-between text-[#27272A]")}>
            Active <span className="text-[#71717A]">{active.length}</span>
          </p>
          <ul className="mt-2">
            {active.map((t) => (
              <li key={t.id} className={cn("flex items-center gap-3 py-2 text-[14px]", t.id === "n" && "animate-row-in")}>
                <span data-target={`check-${t.id}`} className="size-3 rounded-full border border-black/20 bg-white" />
                <span className="flex-1">
                  <span className="block font-medium">{t.title}</span>
                  <span className="text-[12px] text-[#71717A]">{t.project}</span>
                </span>
                <span className="text-[12px] text-[#52525B]">{t.due}</span>
                <span className="text-[12px] text-[#52525B]">{t.priority}</span>
                <span className="w-6 text-right font-mono text-[13px] font-semibold text-accent">+{t.weight}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn(panel, "p-5")}>
          <p className={cn(tick, "flex justify-between text-[#27272A]")}>
            Today’s commits <span className="text-[#71717A]">+{execution}</span>
          </p>
          <ul className="mt-2">
            {[...done.map((t) => ({ time: "Now", title: t.title, project: t.project, weight: t.weight, fresh: true })), ...COMMITS.map((c) => ({ ...c, fresh: false }))].map((c) => (
              <li key={c.title} className={cn("flex items-center gap-3 py-[7px] text-[14px]", c.fresh && "animate-row-in")}>
                <span className="w-11 font-mono text-[12px] text-[#71717A]">{c.time}</span>
                <span className={cn("grid size-4 place-items-center rounded-full", c.fresh ? "mi-pop bg-accent text-white" : "")}>
                  {c.fresh ? <Check className="size-2.5" /> : <span className="size-2 rounded-full bg-accent" />}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{c.title}</span>
                  <span className="text-[12px] text-[#71717A]">{c.project}</span>
                </span>
                <span className="font-mono text-[13px] font-semibold text-accent">+{c.weight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        part.startsWith("#") || part.startsWith("!") ? (
          <span key={i} className="text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function MetricsScreen() {
  return (
    <>
      <p className={cn(tick, "text-accent")}>Numbers</p>
      <p className="text-[56px] font-semibold leading-[1] tracking-[-0.045em]">Metrics</p>
      <div className="mt-4 flex w-fit gap-1 rounded-[12px] border border-black/[0.08] p-1 text-[13px]">
        {["7D", "30D", "90D", "180D", "1Y"].map((r) => (
          <span key={r} className={cn("rounded-[8px] px-2.5 py-1", r === "30D" ? "bg-[#0A0A0A] text-white" : "text-[#52525B]")}>
            {r}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {METRICS.map(([name, value, change, formula], i) => (
          <div
            key={name}
            className={cn("animate-row-in rounded-[20px] p-4", i === 0 ? "bg-accent text-white" : panel)}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className={cn(tick, "text-[10px]", i === 0 ? "" : "text-[#27272A]")}>{name}</p>
              <Sparkline values={SPARK[i]} inverse={i === 0} />
            </div>
            <p className="mt-2 text-[36px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              <CountUp value={value} duration={1000} />
            </p>
            <p className={cn("mt-2 font-mono text-[11px]", i === 0 ? "" : "text-[#52525B]")}>{change}</p>
            <p className={cn("mt-1 font-mono text-[10px]", i === 0 ? "text-white/90" : "text-[#71717A]")}>{formula}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function BoardScreen({
  cols,
  moved,
  drag,
  ease,
}: {
  cols: Record<string, readonly (readonly [string, string, string, number])[]>;
  moved: boolean;
  drag: { x: number; y: number; ms: number } | null;
  ease: string;
}) {
  return (
    <>
      <p className={cn(tick, "text-accent")}>Work</p>
      <p className="text-[56px] font-semibold leading-[1] tracking-[-0.045em]">Personal</p>
      <div data-target="board-grid" className="mt-4 grid grid-cols-3 gap-4">
        {Object.entries(cols).map(([name, cards]) => (
          <div key={name} className={cn(panel, "p-3 transition-colors duration-300", drag && name === "Done" && "border-accent/60 bg-[#FBEFF4]")}>
            <p className="flex items-baseline justify-between px-2 pb-2 text-[15px] font-semibold">
              {name}
              <span className="font-mono text-[12px] text-[#71717A]">
                {cards.length} Σ{cards.reduce((n, c) => n + c[3], 0)}
              </span>
            </p>
            <ul className="space-y-2">
              {/* While a card is carried, Done opens an empty slot at the top for it */}
              {drag && name === "Done" && <li data-target="drop-done" className="h-[88px] animate-row-in rounded-[16px] border-2 border-dashed border-accent/50 bg-white/60" />}
              {cards.map(([title, project, due, w], i) => {
                const fresh = moved && name === "Done" && i === 0;
                const dragging = drag && name === "Active" && i === 0;
                return (
                  <li
                    key={title}
                    data-target={name === "Active" && i === 0 ? "card-active-0" : undefined}
                    className={cn("relative rounded-[16px]", dragging && "z-20")}
                  >
                    {/* The slot a dragged card leaves behind */}
                    {dragging && <span className="absolute inset-0 rounded-[16px] border-2 border-dashed border-black/[0.12]" />}
                    <div
                      className={cn(
                        "relative h-[88px] rounded-[16px] border border-black/[0.06] bg-white p-3",
                        fresh && "animate-row-in border-accent",
                        dragging && "border-accent"
                      )}
                      style={
                        dragging
                          ? { transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.ms ? 2.5 : 0}deg) scale(1.04)`, transition: `transform ${drag.ms || 200}ms ${ease}` }
                          : undefined
                      }
                    >
                      <p className={cn("text-[14px] font-medium", name === "Done" && "text-[#71717A] line-through")}>{title}</p>
                      <p className={cn(tick, "mt-1 text-[10px] text-[#71717A]")}>{project}</p>
                      <p className="mt-2 flex justify-between text-[12px] text-[#52525B]">
                        {due || "—"}
                        <span className="font-mono font-semibold text-accent">+{w}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
