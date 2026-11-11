"use client";

import * as React from "react";
import { BarChart3, Calendar, FolderKanban, History, Inbox, Activity, Plus, Search, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A still of the product's Today screen, drawn at desktop size (1280 × 800) and scaled to
 * fit, the way product sites show a crisp screenshot instead of a busy animation. It is a
 * picture: hidden from assistive tech, described by the caption, and not interactive.
 */

const W = 1280;
const H = 800;

const NAV = [
  { name: "Today", icon: Calendar, active: true },
  { name: "Inbox", icon: Inbox, badge: 3 },
  { section: "Execution" },
  { name: "Metrics", icon: BarChart3 },
  { name: "Activity", icon: Activity },
  { name: "History", icon: History },
  { section: "Work" },
  { name: "Personal", icon: User },
  { name: "Projects", icon: FolderKanban },
] as const;

const ACTIVE = [
  { title: "Finish literature review", project: "Thesis", due: "Tomorrow", weight: 4 },
  { title: "Implement snapshot reader", project: "Relay", due: "14 Nov", weight: 4 },
  { title: "Plan taper week", project: "Marathon", due: "", weight: 1 },
];
const DONE = [
  { time: "14:32", title: "Drafted methods section", project: "Thesis", weight: 4 },
  { time: "11:42", title: "Ran 18 km long run", project: "Marathon", weight: 2 },
  { time: "09:15", title: "Finished type scale pass", project: "Portfolio", weight: 2 },
  { time: "08:30", title: "Read three papers on sampling", project: "Thesis", weight: 1 },
];

const RAMP = ["#0B2A48", "#55306E", "#8C347C", "#C53985", "#D92B74"];

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

export function ProductShot({ heat, commits, execution, caption }: { heat: number[]; commits: string; execution: string; caption: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const scale = useScale(box);
  const max = Math.max(1, ...heat);
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  return (
    <figure className="relative">
      <div ref={box} className="relative w-full overflow-hidden rounded-[22px] border border-white/[0.14] bg-[#001A33]" style={{ height: H * scale }}>
        <div aria-hidden="true" className="absolute left-0 top-0 flex origin-top-left text-white" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          {/* Sidebar */}
          <div className="m-3 flex w-[216px] shrink-0 flex-col rounded-[24px] border border-white/[0.1] bg-[#05223F]">
            <div className="px-5 pb-4 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8E9AC0]">Parth Pancholi</p>
              <p className="font-display text-[22px] font-extrabold uppercase leading-none tracking-[-0.03em] [font-stretch:125%]">State</p>
            </div>
            <div className="space-y-0.5 px-3">
              {NAV.map((item) =>
                "section" in item ? (
                  <p key={item.section} className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8E9AC0]">
                    {item.section}
                  </p>
                ) : (
                  <div
                    key={item.name}
                    className={cn("flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-semibold", "active" in item && item.active ? "bg-accent" : "text-[#DCE2F2]")}
                  >
                    <item.icon className="size-4" />
                    <span className="flex-1">{item.name}</span>
                    {"badge" in item && <span className="font-mono text-[12px] text-[#B4BEDB]">{item.badge}</span>}
                  </div>
                )
              )}
            </div>
            <div className="mt-auto border-t border-white/[0.08] p-3">
              <div className="flex items-center gap-3 px-3 py-2 text-[14px] font-semibold text-[#DCE2F2]">
                <Settings className="size-4" />
                Settings
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col px-7 py-3">
            <div className="flex h-12 items-center justify-between">
              <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#B4BEDB]">
                <span>Wed 11 Nov</span>
                <span>
                  Today <b className="text-white">+20</b>
                </span>
                <span>
                  7D <b className="text-white">57 ▲8%</b>
                </span>
                <span>
                  Vel <b className="text-white">8.1/d</b>
                </span>
                <span>
                  Active <b className="text-white">7/7</b>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 items-center gap-2 rounded-[12px] border border-white/[0.16] px-3 text-[13px] text-[#B4BEDB]">
                  <Search className="size-3.5" />
                  Search…
                  <span className="ml-6 rounded-[6px] bg-white/[0.08] px-1.5 font-mono text-[11px]">⌘ K</span>
                </span>
                <span className="flex h-9 items-center gap-1.5 rounded-[12px] bg-accent px-4 text-[13px] font-semibold tracking-[0.06em]">
                  <Plus className="size-3.5" />
                  COMMIT
                </span>
              </div>
            </div>

            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Wednesday 11 November</p>
            <p className="font-display text-[56px] font-extrabold uppercase leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">Today</p>

            <div className="mt-5 grid grid-cols-[300px_minmax(0,1fr)] gap-4">
              <div className="rounded-[24px] bg-accent p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Execution today</p>
                <p className="mt-3 font-display text-[88px] font-extrabold leading-[0.85] [font-stretch:125%]">+20</p>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/25 pt-3 font-mono">
                  {[
                    ["Commits", "4"],
                    ["Done", "4"],
                    ["7D avg", "8.1"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-[0.16em]">{k}</p>
                      <p className="text-[17px] font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-rows-[auto_minmax(0,1fr)] gap-4">
                <div className="rounded-[24px] border border-white/[0.1] bg-[#05223F] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE2F2]">Capture</p>
                  <div className="mt-3 flex h-11 items-center gap-2 rounded-[14px] border border-white/[0.16] bg-[#001A33] pl-4 pr-1.5 font-mono text-[13px]">
                    <span className="flex-1">
                      Outline discussion <span className="text-accent">#thesis</span> <span className="text-accent">!high</span> fri
                    </span>
                    <span className="flex h-8 items-center gap-1 rounded-[10px] border border-white/[0.16] bg-[#0B2A48] px-3 font-sans">
                      <Plus className="size-3.5" />
                      Capture
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-[#B4BEDB]">
                    Task <b className="text-white">“Outline discussion”</b>, project Thesis, high priority, due Fri 13 Nov
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/[0.1] bg-[#05223F] p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE2F2]">Last {Math.round(heat.length / 7)} weeks</p>
                    <p className="font-mono text-[11px] text-[#8E9AC0]">
                      {commits} commits · +{execution}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px] [grid-auto-columns:minmax(0,1fr)]">
                    {heat.map((v, i) => (
                      <span key={i} className="aspect-square rounded-[3px]" style={{ backgroundColor: RAMP[level(v)] }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-[24px] border border-white/[0.1] bg-[#05223F] p-5">
                <p className="flex justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE2F2]">
                  Active <span className="text-[#8E9AC0]">3</span>
                </p>
                <ul className="mt-2">
                  {ACTIVE.map((t) => (
                    <li key={t.title} className="flex items-center gap-3 py-2 text-[14px]">
                      <span className="size-2.5 rounded-full border border-white/20" />
                      <span className="flex-1">
                        <span className="block font-medium">{t.title}</span>
                        <span className="text-[12px] text-[#8E9AC0]">{t.project}</span>
                      </span>
                      <span className="text-[12px] text-[#B4BEDB]">{t.due}</span>
                      <span className="font-mono text-[13px] font-semibold text-accent">+{t.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-white/[0.1] bg-[#05223F] p-5">
                <p className="flex justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE2F2]">
                  Commits today <span className="text-[#8E9AC0]">+9</span>
                </p>
                <ul className="mt-2">
                  {DONE.map((c) => (
                    <li key={c.title} className="flex items-center gap-3 py-[7px] text-[14px]">
                      <span className="w-11 font-mono text-[12px] text-[#8E9AC0]">{c.time}</span>
                      <span className="size-2 rounded-full bg-accent" />
                      <span className="flex-1 font-medium">{c.title}</span>
                      <span className="font-mono text-[13px] font-semibold text-accent">+{c.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
