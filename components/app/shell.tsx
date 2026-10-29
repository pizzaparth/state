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
  FolderKanban,
  History,
  Inbox,
  Loader2,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createCommitAction } from "@/app/(app)/actions";
import { WEIGHT_LEVELS, weightHint } from "@/lib/weights";
import { CountUp } from "./count-up";
import { NoticeProvider, useNotice } from "./notice";

export interface ShellData {
  inboxCount: number;
  orgs: { name: string; slug: string }[];
  projects: { id: string; name: string; href: string }[];
  dateLabel: string;
  ticker: { today: number; last7: number; prev7: number; activeDays7: number };
  /** Set when the plan is overdue past its grace period or has ended: reads only. */
  readOnly: "past_due" | "ended" | null;
}

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: number; shortcut?: string };

function navSections(data: ShellData): { title?: string; items: NavItem[] }[] {
  return [
    {
      items: [
        { name: "Today", href: "/platform/today", icon: Calendar, shortcut: "G T" },
        { name: "Inbox", href: "/platform/inbox", icon: Inbox, badge: data.inboxCount, shortcut: "G I" },
      ],
    },
    {
      title: "Execution",
      items: [
        { name: "Metrics", href: "/platform/metrics", icon: BarChart3, shortcut: "G M" },
        { name: "Activity", href: "/platform/activity", icon: Activity, shortcut: "G A" },
        { name: "History", href: "/platform/history", icon: History, shortcut: "G H" },
      ],
    },
    {
      title: "Work",
      items: [
        { name: "Personal", href: "/platform/personal", icon: User, shortcut: "G P" },
        ...data.orgs.map((o) => ({ name: o.name, href: `/platform/org/${o.slug}`, icon: Users, shortcut: "G O" })),
        { name: "Projects", href: "/platform/projects", icon: FolderKanban },
      ],
    },
  ];
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// ------------------------------------------------------------------ shell
const ShellContext = React.createContext<{ openPalette: () => void; openCommit: () => void }>({
  openPalette: () => {},
  openCommit: () => {},
});
export const useShell = () => React.useContext(ShellContext);

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => setNavOpen(false), [pathname]);

  // Keyboard-first: ⌘K / Ctrl+K palette, "/" search, C commit, N capture, G then a letter to jump
  React.useEffect(() => {
    let pendingG = 0;
    const jumps: Record<string, string> = {
      t: "/platform/today",
      i: "/platform/inbox",
      a: "/platform/activity",
      h: "/platform/history",
      m: "/platform/metrics",
      p: "/platform/personal",
      o: data.orgs[0] ? `/platform/org/${data.orgs[0].slug}` : "/platform/org",
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && jumps[key]) {
        e.preventDefault();
        pendingG = 0;
        router.push(jumps[key] as Route);
        return;
      }
      pendingG = key === "g" ? Date.now() : 0;
      if (key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === "c") {
        e.preventDefault();
        setCommitOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        router.push("/platform/inbox?capture=1" as Route);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, data.orgs]);

  return (
    <MotionConfig reducedMotion="user">
    <NoticeProvider>
      <ShellContext.Provider value={{ openPalette: () => setPaletteOpen(true), openCommit: () => setCommitOpen(true) }}>
        <div className="flex h-[100dvh] w-full overflow-hidden bg-[#000000] text-[#F2F2EF]">
          <aside className="hidden w-64 shrink-0 p-3 lg:block">
            <div className="app-panel flex h-full flex-col rounded-[28px]">
              <SidebarContent data={data} pathname={pathname} scope="rail" />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  aria-label="Open navigation"
                  className="app-btn grid size-10 place-items-center rounded-[12px] lg:hidden"
                >
                  <MenuIcon className="size-4" aria-hidden="true" />
                </button>
                <TickerStrip ticker={data.ticker} dateLabel={data.dateLabel} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="app-field hidden h-10 items-center gap-2 rounded-[12px] px-3 text-sm text-[#9A9A96] transition-colors hover:text-[#F2F2EF] sm:flex"
                >
                  <Search className="size-3.5" aria-hidden="true" />
                  <span className="w-28 text-left">Search…</span>
                  <kbd className="rounded-[6px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[12px]">⌘&nbsp;K</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search and commands"
                  className="app-btn grid size-10 place-items-center rounded-[12px] sm:hidden"
                >
                  <Search className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setCommitOpen(true)}
                  className="app-inverse inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-sm font-semibold tracking-[0.06em] hover:bg-white"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  COMMIT
                </button>
              </div>
            </header>

            <main id="content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">
                {data.readOnly && (
                  <p role="status" className="app-panel mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[16px] px-4 py-3 text-base">
                    <span>
                      <span className="font-mono text-sm uppercase tracking-[0.14em] text-[#9A9A96]">Read-only</span>
                      <span className="ml-3 text-[#F2F2EF]">{data.readOnly === "past_due" ? "Payment overdue. Changes are paused." : "Plan ended. Changes are paused."}</span>
                    </span>
                    <Link href={data.readOnly === "past_due" ? "/platform/settings/billing" : "/subscribe"} className="text-sm font-medium text-[#F2F2EF] underline underline-offset-4 hover:text-white">
                      {data.readOnly === "past_due" ? "Update billing" : "Subscribe again"}
                    </Link>
                  </p>
                )}
                {children}
              </div>
            </main>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-3 left-3 z-50 flex data-[state=closed]:animate-nav-out data-[state=open]:animate-nav-in w-[17rem] flex-col overscroll-contain rounded-[28px] bg-[#0A0A0A] border border-white/10 outline-none lg:hidden"
            >
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Dialog.Close aria-label="Close navigation" className="app-btn absolute right-3 top-3 grid size-9 place-items-center rounded-full">
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
              <SidebarContent data={data} pathname={pathname} scope="drawer" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} data={data} onCommit={() => setCommitOpen(true)} />
        <CommitDialog open={commitOpen} onOpenChange={setCommitOpen} projects={data.projects} />
      </ShellContext.Provider>
    </NoticeProvider>
    </MotionConfig>
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
            <span className={cn("ml-1.5", up ? "text-[#F2F2EF]" : "text-[#9A9A96]")}>
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
    { label: "Active", value: <CountUp value={`${ticker.activeDays7}/7`} />, title: "Days with at least one commit, last 7 days", className: "hidden xl:flex" },
  ];
  return (
    <dl aria-label="Your execution, last 7 days" className="flex min-w-0 items-center gap-x-5 overflow-hidden font-mono text-[13px] uppercase tabular-nums">
      <div className="hidden shrink-0 text-[#9A9A96] sm:block">
        <dt className="sr-only">Date</dt>
        <dd>{dateLabel}</dd>
      </div>
      {items.map((item) => (
        <div key={item.label} title={item.title} className={cn("flex shrink-0 items-baseline gap-2 border-l border-white/[0.1] pl-5 first:border-l-0 first:pl-0 sm:first:border-l sm:first:pl-5", item.className)}>
          <dt className="text-[11px] tracking-[0.16em] text-[#85857F]">{item.label}</dt>
          <dd className="font-semibold text-[#F2F2EF]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ sidebar
function SidebarContent({ data, pathname, scope }: { data: ShellData; pathname: string; scope: string }) {
  return (
    <LayoutGroup id={`nav-${scope}`}>
      <div className="px-5 pb-4 pt-5">
        <Link href="/platform/today" className="block rounded-[8px]">
          <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[#85857F]">Ksan Relay</span>
          <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-[-0.03em] [font-stretch:125%]">State</span>
        </Link>
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3">
        {navSections(data).map((section, i) => (
          <div key={i}>
            {section.title && <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#85857F]">{section.title}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <NavLink href={item.href} active={active}>
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {item.badge ? (
                        <span className={cn("font-mono text-[13px] tabular-nums", active ? "text-[#55554F]" : "text-[#9A9A96]")}>{item.badge}</span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.08] p-3">
        <NavLink href="/platform/settings" active={isActive(pathname, "/platform/settings")}>
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </NavLink>
      </div>
    </LayoutGroup>
  );
}

/** Nav item whose near-white active pill slides between items (shared layout animation). */
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  const router = useRouter();
  // Intent prefetch: fetch the full page on hover/focus so the click renders instantly.
  // (Link's own viewport prefetch only loads the shell and loading skeleton for dynamic pages.)
  const prefetch = () => {
    if (!active) router.prefetch(href as Route);
  };
  return (
    <Link
      href={href as Route}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[12px] px-3 py-2 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-150",
        active ? "text-[#0A0A0A]" : "text-[#BDBDB9] hover:bg-white/[0.05] hover:text-[#F2F2EF]"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          aria-hidden="true"
          className="absolute inset-0 rounded-[12px] bg-[#F2F2EF]"
          transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}
        />
      )}
      <span className="relative z-[1] flex min-w-0 flex-1 items-center gap-3">{children}</span>
    </Link>
  );
}

// ------------------------------------------------------------------ command palette
type Command = { id: string; label: string; group: string; hint?: string; detail?: string; run: () => void };

type SearchHit = { id: string; kind: "task" | "commit"; title: string; context: string; href: string; done: boolean };

/**
 * Tasks and commits matching the query, fetched as the person types (debounced; a newer
 * query cancels the older request). Empty below 2 characters.
 */
function useWorkSearch(query: string) {
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.slice(0, 100))}`, { signal: controller.signal });
        const body = res.ok ? ((await res.json()) as { hits: SearchHit[] }) : { hits: [] };
        setHits(body.hits);
      } catch {
        if (!controller.signal.aborted) setHits([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);
  return { hits, loading };
}

function CommandPalette({
  open,
  onOpenChange,
  data,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShellData;
  onCommit: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);

  const go = (href: string) => () => router.push(href as Route);
  const commands: Command[] = [
    { id: "commit", label: "Create commit", group: "Actions", hint: "C", run: onCommit },
    { id: "capture", label: "Capture task", group: "Actions", hint: "N", run: go("/platform/inbox?capture=1") },
    ...navSections(data).flatMap((s) => s.items.map((i) => ({ id: i.href, label: `Open ${i.name}`, group: "Go to", hint: i.shortcut, run: go(i.href) }))),
    { id: "/platform/settings", label: "Open settings", group: "Go to", run: go("/platform/settings") },
    ...data.projects.map((p) => ({ id: p.href, label: p.name, group: "Projects", run: go(p.href) })),
  ];
  const q = query.trim().toLowerCase();
  const search = useWorkSearch(open ? query : "");
  const found: Command[] = search.hits.map((h) => ({
    id: `${h.kind}-${h.id}`,
    label: h.title,
    group: h.kind === "task" ? "Task" : "Commit",
    detail: h.context,
    hint: h.kind === "task" && h.done ? "done" : undefined,
    run: go(h.href),
  }));
  const results = q ? [...commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)), ...found] : commands;

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);
  React.useEffect(() => setIndex(0), [query]);
  // Results arriving later can shorten the list under the cursor
  React.useEffect(() => setIndex((i) => Math.min(i, Math.max(0, results.length - 1))), [results.length]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onOpenChange(false);
    c.run();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="app-overlay fixed left-1/2 top-[12vh] z-50 origin-top data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[24px] outline-none"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-white/10 px-5">
            <Search className="size-4 text-[#A9A9A6]" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(results.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  run(results[index]);
                }
              }}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant={results[index] ? `cmd-${index}` : undefined}
              placeholder="Search tasks, commits, commands…"
              className="h-14 flex-1 bg-transparent text-base text-[#F2F2EF] placeholder:text-[#6F6F6B] focus:outline-none"
            />
            {search.loading && <Loader2 className="size-4 animate-spin text-[#85857F]" aria-hidden="true" />}
            <kbd className="rounded-[6px] bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-[#A9A9A6]">esc</kbd>
          </div>
          <p role="status" className="sr-only">
            {q.length >= 2 && !search.loading ? `${results.length} results` : ""}
          </p>
          <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-base text-[#A9A9A6]">{search.loading ? "Searching…" : "No matches."}</li>}
            {results.map((c, i) => (
              <li
                key={`${c.group}-${c.id}`}
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === index}
                onPointerMove={() => setIndex(i)}
                onClick={() => run(c)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-base", i === index ? "bg-white/10 text-white" : "text-[#C9C9C5]")}
              >
                <span className="w-16 shrink-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6F6F6B]">{c.group}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.label}</span>
                  {c.detail && <span className="block truncate text-sm text-[#85857F]">{c.detail}</span>}
                </span>
                {c.hint && <kbd className="font-mono text-[12px] text-[#85857F]">{c.hint}</kbd>}
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ------------------------------------------------------------------ manual commit
const selectClass =
  "app-field h-11 w-full rounded-[14px] bg-[#000000] px-3 text-base text-[#F2F2EF] focus:border-white/45 focus:outline-none";

function CommitDialog({
  open,
  onOpenChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ShellData["projects"];
}) {
  const notify = useNotice();
  const [error, setError] = React.useState<string | null>(null);
  const [weight, setWeight] = React.useState(2);
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (setError(null), setWeight(2), onOpenChange(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 origin-top data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 overscroll-contain rounded-[28px] bg-[#0A0A0A] p-6 border border-white/10 outline-none">
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Log work</Dialog.Title>
          <Dialog.Description className="mt-1 text-base text-[#9A9A96]">
            Done something unplanned? Log it.
          </Dialog.Description>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const message = String(form.get("message") ?? "").trim();
              const textarea = e.currentTarget.querySelector<HTMLTextAreaElement>("textarea");
              if (!message) {
                setError("Describe what you did.");
                textarea?.focus();
                return;
              }
              if (pending) return;
              startTransition(async () => {
                const result = await createCommitAction({ message, projectId: String(form.get("project") ?? "") || null, weight });
                if (!result.ok) {
                  setError(result.error);
                  textarea?.focus();
                  return;
                }
                onOpenChange(false);
                notify(`Commit recorded: “${message}” +${weight}.`);
              });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="commit-message" className="text-sm font-medium text-[#9A9A96]">
                What did you do?
              </label>
              <textarea
                id="commit-message"
                name="message"
                rows={3}
                maxLength={500}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "commit-message-error" : undefined}
                placeholder="Finished chapter 4…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
                className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-base max-md:text-base"
              />
              {error && (
                <p id="commit-message-error" className="text-sm text-[#F0A39B]">
                  {error}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="commit-project" className="text-sm font-medium text-[#9A9A96]">
                  Project
                </label>
                <select id="commit-project" name="project" className={selectClass} defaultValue="">
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="commit-weight" className="text-sm font-medium text-[#9A9A96]">
                  Weight
                </label>
                <select
                  id="commit-weight"
                  name="weight"
                  className={selectClass}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  aria-describedby="commit-weight-hint"
                >
                  {WEIGHT_LEVELS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}, {w.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p id="commit-weight-hint" className="-mt-1 text-sm leading-relaxed text-[#9A9A96]">
              {weightHint(weight)}
            </p>
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-[#9A9A96]">
                <kbd className="font-mono">⌘&nbsp;Enter</kbd> to commit
              </p>
              <div className="flex gap-2">
                <Dialog.Close className="app-btn h-10 rounded-[12px] px-4 text-base font-medium">Cancel</Dialog.Close>
                <button
                  type="submit"
                  disabled={pending}
                  className="app-inverse inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-base font-semibold disabled:opacity-70"
                >
                  {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Commit
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
