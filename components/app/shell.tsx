"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarRange,
  FolderKanban,
  History,
  Inbox,
  LayoutGrid,
  ListPlus,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  SquarePen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTHOR, BYLINE } from "@/lib/site";
import { ACTION_KEYS, JUMPS, shortcutFor } from "@/lib/shortcuts";
import { watchPanelLinks } from "@/lib/panel-history";
import { CHANNEL, saveStore } from "@/lib/save-state";
import { nextMidnight } from "@/lib/tz";
import { CountUp } from "./count-up";
import { DemoGuard } from "./demo-guard";
import { ParallaxBackdrop } from "@/components/motion/parallax";
import { SignOutButton } from "./sign-out-button";
import { NoticeProvider } from "./notice";
import { TimezoneCheck } from "./timezone-check";
import { ShortcutSheet } from "./shortcut-sheet";
import { CommandPalette, type PaletteCommand } from "./command-palette";
import { CommitDialog } from "./commit-dialog";
import { CaptureDialog } from "./capture-dialog";

export interface ShellData {
  inboxCount: number;
  projects: { id: string; name: string; slug: string; href: string }[];
  dateLabel: string;
  ticker: { today: number; last7: number; prev7: number; activeDays7: number; eligible7: number };
  /** Set for a throwaway demo session (the user id); null for the owner. */
  demoUserId: string | null;
  /** The viewer's saved time zone. */
  tz: string;
  /** Sidebar shown as an icon rail (cookie, so the server renders it right). */
  sidebarCollapsed: boolean;
  /** Last manual commit messages, for Log work suggestions. */
  recentMessages: string[];
  tagNames: string[];
}

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: number };

const SIDEBAR_PROJECTS = 8;
const SIDEBAR_COOKIE = "sidebar";

function navSections(data: ShellData): { title?: string; items: NavItem[] }[] {
  return [
    {
      items: [
        { name: "Today", href: "/platform/today", icon: Calendar },
        { name: "Inbox", href: "/platform/inbox", icon: Inbox, badge: data.inboxCount },
      ],
    },
    {
      title: "Execution",
      items: [
        { name: "Metrics", href: "/platform/metrics", icon: BarChart3 },
        { name: "Activity", href: "/platform/activity", icon: Activity },
        { name: "History", href: "/platform/history", icon: History },
        { name: "Review", href: "/platform/review", icon: CalendarRange },
      ],
    },
    {
      title: "Work",
      items: [
        { name: "Board", href: "/platform/board", icon: LayoutGrid },
        { name: "Projects", href: "/platform/projects", icon: FolderKanban },
      ],
    },
  ];
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// ------------------------------------------------------------------ shell
const ShellContext = React.createContext<{ openPalette: () => void; openCommit: () => void; openCapture: () => void }>({
  openPalette: () => {},
  openCommit: () => {},
  openCapture: () => {},
});
export const useShell = () => React.useContext(ShellContext);

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitPrefill, setCommitPrefill] = React.useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(data.sidebarCollapsed);
  const router = useRouter();
  const pathname = usePathname();

  const openCommit = React.useCallback((message: string | null = null) => {
    setCommitPrefill(message);
    setCommitOpen(true);
  }, []);
  const toggleSidebar = React.useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  React.useEffect(() => setNavOpen(false), [pathname]);
  // Panels opened from in-app links close with Back (lib/panel-history.ts)
  React.useEffect(() => watchPanelLinks(), []);

  // Fresh data without a reload: at the next local midnight (the date and "today"
  // change), after a tab was hidden for 5+ minutes, and when another tab writes
  React.useEffect(() => {
    const midnight = window.setTimeout(() => router.refresh(), Math.max(1000, nextMidnight(data.tz) - Date.now() + 1000));
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    let channel: BroadcastChannel | null = null;
    let pending: number | undefined;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => {
        window.clearTimeout(pending);
        pending = window.setTimeout(() => router.refresh(), 250);
      };
    } catch {
      channel = null;
    }
    return () => {
      window.clearTimeout(midnight);
      window.clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [router, data.tz, data.dateLabel]);

  // Keyboard-first, from lib/shortcuts.ts: ⌘K / Ctrl+K palette, single-key actions, G then a letter to jump
  React.useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && JUMPS[key]) {
        e.preventDefault();
        pendingG = 0;
        router.push(JUMPS[key] as Route);
        return;
      }
      pendingG = key === "g" ? Date.now() : 0;
      if (key === "[") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      const action = ACTION_KEYS[key];
      if (!action || action === "undo" || (action === "palette" && key !== "/")) return;
      e.preventDefault();
      if (action === "palette") setPaletteOpen(true);
      else if (action === "commit") openCommit();
      else if (action === "shortcuts") setSheetOpen(true);
      else if (action === "capture") setCaptureOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openCommit, toggleSidebar]);

  const go = (href: string) => () => router.push(href as Route);
  const commands: PaletteCommand[] = [
    { id: "commit", label: "Log work", group: "Actions", hint: "C", run: () => openCommit() },
    { id: "capture", label: "Add task", group: "Actions", hint: "N", run: () => setCaptureOpen(true) },
    { id: "shortcuts", label: "Keyboard shortcuts", group: "Actions", hint: "?", run: () => setSheetOpen(true) },
    { id: "sidebar", label: collapsed ? "Expand sidebar" : "Collapse sidebar", group: "Actions", hint: "[", run: toggleSidebar },
    ...navSections(data).flatMap((s) => s.items.map((i) => ({ id: i.href, label: `Open ${i.name}`, group: "Go to", hint: shortcutFor(i.href), run: go(i.href) }))),
    { id: "/platform/settings", label: "Open settings", group: "Go to", hint: shortcutFor("/platform/settings"), run: go("/platform/settings") },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <NoticeProvider>
        <ShellContext.Provider value={{ openPalette: () => setPaletteOpen(true), openCommit: () => openCommit(), openCapture: () => setCaptureOpen(true) }}>
          {data.demoUserId && <DemoGuard userId={data.demoUserId} />}
          <TimezoneCheck tz={data.tz} demo={Boolean(data.demoUserId)} />
          <ParallaxBackdrop scroller="#content" tone="light" />
          <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden text-[#0A0A0A]">
            <aside className={cn("hidden shrink-0 p-3 lg:block", collapsed ? "w-[5.25rem]" : "w-64")}>
              <div className="app-panel flex h-full flex-col rounded-[28px]">
                <SidebarContent data={data} pathname={pathname} scope="rail" collapsed={collapsed} onToggle={toggleSidebar} />
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" onClick={() => setNavOpen(true)} aria-label="Open navigation" className="app-btn grid size-11 place-items-center rounded-[12px] lg:hidden">
                    <MenuIcon className="size-4" aria-hidden="true" />
                  </button>
                  <TickerStrip ticker={data.ticker} dateLabel={data.dateLabel} />
                </div>
                <div className="flex items-center gap-2">
                  <SaveIndicator />
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    className="app-field hidden h-10 items-center gap-2 rounded-[12px] px-3 text-sm text-[#52525B] transition-colors hover:text-[#0A0A0A] sm:flex"
                  >
                    <Search className="size-3.5" aria-hidden="true" />
                    <span className="w-28 text-left">Search…</span>
                    <kbd className="rounded-[6px] bg-black/[0.05] px-1.5 py-0.5 font-mono text-[12px]">⌘&nbsp;K</kbd>
                  </button>
                  <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search and commands" className="app-btn grid size-11 place-items-center rounded-[12px] sm:hidden">
                    <Search className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureOpen(true)}
                    title="Add task (N)"
                    className="app-btn mi-press hidden h-10 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium lg:inline-flex"
                  >
                    <ListPlus className="size-4" aria-hidden="true" />
                    Task
                  </button>
                  <button
                    type="button"
                    onClick={() => openCommit()}
                    className="app-inverse mi-lift mi-spin hidden h-10 items-center gap-1.5 rounded-[12px] px-4 text-sm font-semibold tracking-[0.06em] sm:inline-flex"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    COMMIT
                  </button>
                </div>
              </header>

              <main id="content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-16">
                <div className="mx-auto max-w-6xl">
                  {data.demoUserId && (
                    <div role="status" className="app-accent-panel mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[16px] px-4 py-3">
                      <span className="min-w-0">
                        <span className="mi-live mr-2.5 align-middle" aria-hidden="true" />
                        <span className="font-mono text-sm font-semibold uppercase tracking-[0.14em]">Demo</span>
                        <span className="ml-3 text-base">Sample data. Deleted on sign-out, tab close or after 6 hours idle.</span>
                      </span>
                      <SignOutButton demo className="app-btn inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-medium disabled:opacity-70" />
                    </div>
                  )}
                  {children}
                </div>
              </main>
            </div>
          </div>

          <BottomBar pathname={pathname} inboxCount={data.inboxCount} onAdd={() => setAddSheetOpen(true)} />

          {/* Mobile navigation drawer */}
          <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-3 left-3 z-50 flex w-[17rem] flex-col overscroll-contain rounded-[28px] border border-black/[0.06] bg-white outline-none data-[state=closed]:animate-nav-out data-[state=open]:animate-nav-in lg:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Dialog.Close aria-label="Close navigation" className="app-btn absolute right-3 top-3 grid size-11 place-items-center rounded-full">
                  <X className="size-4" aria-hidden="true" />
                </Dialog.Close>
                <SidebarContent data={data} pathname={pathname} scope="drawer" collapsed={false} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Phone + sheet: Task or Commit */}
          <Dialog.Root open={addSheetOpen} onOpenChange={setAddSheetOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
              <Dialog.Content
                aria-describedby={undefined}
                className="app-overlay fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 rounded-[24px] p-3 outline-none data-[state=closed]:animate-overlay-out data-[state=open]:animate-toast-in"
              >
                <Dialog.Title className="px-2 pb-2 pt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[#71717A]">Add</Dialog.Title>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => (setAddSheetOpen(false), setCaptureOpen(true))} className="app-btn mi-press flex h-16 items-center justify-center gap-2 rounded-[16px] text-base font-semibold">
                    <ListPlus aria-hidden="true" className="size-5" />
                    Task
                  </button>
                  <button type="button" onClick={() => (setAddSheetOpen(false), openCommit())} className="app-inverse mi-press flex h-16 items-center justify-center gap-2 rounded-[16px] text-base font-semibold">
                    <SquarePen aria-hidden="true" className="size-5" />
                    Commit
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} projects={data.projects} onLogWork={(m) => openCommit(m)} />
          <ShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />
          <CommitDialog open={commitOpen} onOpenChange={setCommitOpen} projects={data.projects} recentMessages={data.recentMessages} tagNames={data.tagNames} initialMessage={commitPrefill} />
          <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} projects={data.projects} tz={data.tz} />
        </ShellContext.Provider>
      </NoticeProvider>
    </MotionConfig>
  );
}

// ------------------------------------------------------------------ saving state
/** saving… while writes are in flight, then saved; offline · n pending while retrying. */
function SaveIndicator() {
  const state = React.useSyncExternalStore(saveStore.subscribe, saveStore.get, saveStore.server);
  const [recent, setRecent] = React.useState(false);
  React.useEffect(() => {
    if (!state.savedAt) return;
    setRecent(true);
    const t = window.setTimeout(() => setRecent(false), 2000);
    return () => window.clearTimeout(t);
  }, [state.savedAt]);
  const label = state.waiting > 0 ? `offline · ${state.waiting} pending` : state.inFlight > 0 ? "saving…" : recent ? "saved" : "";
  return (
    <span role="status" aria-live="polite" className={cn("hidden min-w-[4.5rem] text-right font-mono text-[12px] tabular-nums md:inline", state.waiting > 0 ? "text-[#0A0A0A]" : "text-[#71717A]")}>
      {label}
    </span>
  );
}

// ------------------------------------------------------------------ ticker
/**
 * Stat strip in the top bar on every page: today's execution, the last 7 days against the
 * 7 before, velocity and active days. Plain sums of the viewer's commits; the arrow and sign
 * carry direction, so colour is never the only cue. Narrow screens keep Today only.
 */
function TickerStrip({ ticker, dateLabel }: { ticker: ShellData["ticker"]; dateLabel: string }) {
  const change = ticker.prev7 > 0 ? Math.round(((ticker.last7 - ticker.prev7) / ticker.prev7) * 100) : null;
  const up = change !== null && change >= 0;
  const items: { label: string; value: React.ReactNode; title: string; className?: string }[] = [
    { label: "Today", value: <CountUp value={`+${ticker.today}`} />, title: "Execution recorded today" },
    {
      label: "7D",
      value: (
        <>
          <CountUp value={String(ticker.last7)} />
          {change !== null && (
            <span className={cn("ml-1.5", up ? "text-[#0A0A0A]" : "text-[#52525B]")}>
              {up ? "▲" : "▼"}
              {Math.abs(change)}%
            </span>
          )}
        </>
      ),
      title: change === null ? "Execution in the last 7 days" : `Execution in the last 7 days: ${ticker.last7}, ${up ? "up" : "down"} ${Math.abs(change)}% on the 7 days before (${ticker.prev7})`,
      className: "hidden sm:flex",
    },
    { label: "Vel", value: <CountUp value={`${(ticker.last7 / 7).toFixed(1)}/d`} />, title: "Velocity: last 7 days' execution ÷ 7", className: "hidden md:flex" },
    {
      label: "Active",
      value: <CountUp value={`${ticker.activeDays7}/${ticker.eligible7}`} />,
      title: `Days with at least one commit, of the last ${ticker.eligible7} eligible days`,
      className: "hidden xl:flex",
    },
  ];
  return (
    <dl aria-label="Your execution, last 7 days" className="flex min-w-0 items-center gap-x-5 overflow-hidden font-mono text-[13px] uppercase tabular-nums">
      <div className="hidden shrink-0 text-[#52525B] sm:block">
        <dt className="sr-only">Date</dt>
        <dd>{dateLabel}</dd>
      </div>
      {items.map((item) => (
        <div key={item.label} title={item.title} className={cn("flex shrink-0 items-baseline gap-2 border-l border-black/[0.08] pl-5 first:border-l-0 first:pl-0 sm:first:border-l sm:first:pl-5", item.className)}>
          <dt className="text-[11px] tracking-[0.16em] text-[#71717A]">{item.label}</dt>
          <dd className="font-semibold text-[#0A0A0A]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ sidebar
function SidebarContent({
  data,
  pathname,
  scope,
  collapsed,
  onToggle,
}: {
  data: ShellData;
  pathname: string;
  scope: string;
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const projects = data.projects.slice(0, SIDEBAR_PROJECTS);
  return (
    <LayoutGroup id={`nav-${scope}`}>
      <div className={cn("flex items-start justify-between gap-2 pb-4 pt-5", collapsed ? "px-3" : "px-5")}>
        <Link href="/platform/today" className="block min-w-0 rounded-[8px]" aria-label={collapsed ? "State, Today" : undefined}>
          {!collapsed && (
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[#71717A]" translate="no">
              {AUTHOR}
            </span>
          )}
          <span className={cn("block font-sans font-semibold leading-none tracking-[-0.04em]", collapsed ? "pl-2 text-2xl" : "text-2xl")} translate="no">
            {collapsed ? "S" : "State"}
          </span>
        </Link>
        {onToggle && !collapsed && (
          <button type="button" onClick={onToggle} aria-label="Collapse sidebar" title="Collapse sidebar ([)" className="mi-press -mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-[#71717A] hover:bg-black/[0.05] hover:text-[#0A0A0A]">
            <PanelLeftClose aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3">
        {navSections(data).map((section, i) => (
          <div key={i}>
            {section.title && !collapsed && <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#71717A]">{section.title}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <NavLink href={item.href} active={active} label={collapsed ? item.name : undefined}>
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                      {item.badge && !collapsed ? (
                        <span className={cn("font-mono text-[13px] tabular-nums", active ? "text-accent-muted" : "text-[#52525B]")}>{item.badge}</span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            {section.title === "Work" && !collapsed && projects.length > 0 && (
              <ul aria-label="Projects" className="mt-1 space-y-0.5 border-l border-black/[0.06] pl-2 ml-5">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.href as Route}
                      aria-current={isActive(pathname, p.href) ? "page" : undefined}
                      className={cn(
                        "mi-nudge block truncate rounded-[10px] px-3 py-1.5 text-[14px] transition-colors",
                        isActive(pathname, p.href) ? "bg-black/[0.05] font-semibold text-[#0A0A0A]" : "text-[#52525B] hover:bg-black/[0.03] hover:text-[#0A0A0A]"
                      )}
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
                {data.projects.length > SIDEBAR_PROJECTS && (
                  <li>
                    <Link href="/platform/projects" className="block rounded-[10px] px-3 py-1.5 font-mono text-[12px] text-[#71717A] hover:text-[#0A0A0A]">
                      All projects · {data.projects.length}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-black/[0.05] p-3">
        <NavLink href="/platform/settings" active={isActive(pathname, "/platform/settings")} label={collapsed ? "Settings" : undefined}>
          <Settings className="size-4" aria-hidden="true" />
          {!collapsed && "Settings"}
        </NavLink>
        {collapsed && onToggle ? (
          <button type="button" onClick={onToggle} aria-label="Expand sidebar" title="Expand sidebar ([)" className="mi-press grid h-10 w-full place-items-center rounded-[12px] text-[#71717A] hover:bg-black/[0.05] hover:text-[#0A0A0A]">
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <p className="px-3 font-mono text-[11px] leading-snug text-[#71717A]">{BYLINE}</p>
        )}
      </div>
    </LayoutGroup>
  );
}

/** Nav item whose black active pill slides between items (shared layout animation). */
function NavLink({ href, active, label, children }: { href: string; active: boolean; label?: string; children: React.ReactNode }) {
  const router = useRouter();
  // Intent prefetch: fetch the full page on hover/focus so the click renders instantly.
  const prefetch = () => {
    if (!active) router.prefetch(href as Route);
  };
  return (
    <Link
      href={href as Route}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "mi-nudge mi-press relative flex items-center gap-3 rounded-[12px] px-3 py-2 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-150",
        label && "justify-center",
        active ? "text-accent-ink" : "text-[#27272A] hover:bg-black/[0.03] hover:text-[#0A0A0A]"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          aria-hidden="true"
          className="absolute inset-0 rounded-[12px] bg-[#0A0A0A]"
          transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}
        />
      )}
      <span className={cn("relative z-[1] flex min-w-0 flex-1 items-center gap-3", label && "justify-center")}>{children}</span>
    </Link>
  );
}

// ------------------------------------------------------------------ phone bottom bar
const BOTTOM_ITEMS = [
  { name: "Today", href: "/platform/today", icon: Calendar },
  { name: "Inbox", href: "/platform/inbox", icon: Inbox },
  { name: "Board", href: "/platform/board", icon: LayoutGrid },
  { name: "History", href: "/platform/history", icon: History },
];

/** Below lg: four destinations and a centre + (Task or Commit). Hidden while the keyboard is open. */
function BottomBar({ pathname, inboxCount, onAdd }: { pathname: string; inboxCount: number; onAdd: () => void }) {
  const [keyboard, setKeyboard] = React.useState(false);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboard(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  if (keyboard) return null;
  const item = (i: (typeof BOTTOM_ITEMS)[number]) => {
    const active = isActive(pathname, i.href);
    const Icon = i.icon;
    return (
      <li key={i.href} className="flex-1">
        <Link
          href={i.href as Route}
          aria-current={active ? "page" : undefined}
          className={cn("mi-press relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-semibold", active ? "text-[#0A0A0A]" : "text-[#71717A]")}
        >
          <Icon aria-hidden="true" className="size-5" />
          {i.name}
          {i.name === "Inbox" && inboxCount > 0 && <span className="absolute right-[calc(50%-1.25rem)] top-1.5 font-mono text-[10px] tabular-nums text-accent">{inboxCount}</span>}
          {active && <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-[#0A0A0A]" />}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="app-overlay fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-lg items-center">
        {BOTTOM_ITEMS.slice(0, 2).map(item)}
        <li className="flex-1">
          <button type="button" onClick={onAdd} aria-label="Add task or commit" className="app-inverse mi-press mx-auto grid size-12 place-items-center rounded-full">
            <Plus aria-hidden="true" className="size-5" />
          </button>
        </li>
        {BOTTOM_ITEMS.slice(2).map(item)}
      </ul>
    </nav>
  );
}
