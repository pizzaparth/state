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
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { NoticeProvider, useLocalOnlyNotice } from "./notice";

export interface ShellData {
  user: { name: string; email: string; initials: string };
  inboxCount: number;
  orgs: { name: string; slug: string }[];
  projects: { name: string; href: string }[];
  dateLabel: string;
}

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: number; shortcut?: string };

function navSections(data: ShellData): { title?: string; items: NavItem[] }[] {
  return [
    {
      items: [
        { name: "Today", href: "/today", icon: Calendar, shortcut: "G T" },
        { name: "Inbox", href: "/inbox", icon: Inbox, badge: data.inboxCount, shortcut: "G I" },
      ],
    },
    {
      title: "Execution",
      items: [
        { name: "Activity", href: "/activity", icon: Activity, shortcut: "G A" },
        { name: "History", href: "/history", icon: History, shortcut: "G H" },
        { name: "Metrics", href: "/metrics", icon: BarChart3, shortcut: "G M" },
      ],
    },
    {
      title: "Work",
      items: [
        { name: "Personal", href: "/personal", icon: User, shortcut: "G P" },
        ...data.orgs.map((o) => ({ name: o.name, href: `/org/${o.slug}`, icon: Users, shortcut: "G O" })),
        { name: "Projects", href: "/projects", icon: FolderKanban },
      ],
    },
  ];
}

const TITLES: [RegExp, string][] = [
  [/^\/today/, "Today"],
  [/^\/inbox/, "Inbox"],
  [/^\/activity/, "Activity"],
  [/^\/history/, "History"],
  [/^\/metrics/, "Metrics"],
  [/^\/personal/, "Personal"],
  [/^\/projects/, "Projects"],
  [/^\/org/, "Organisation"],
  [/^\/settings/, "Settings"],
];

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
      t: "/today",
      i: "/inbox",
      a: "/activity",
      h: "/history",
      m: "/metrics",
      p: "/personal",
      o: data.orgs[0] ? `/org/${data.orgs[0].slug}` : "/org",
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
        router.push("/inbox?capture=1" as Route);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, data.orgs]);

  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "State";

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
                <p className="truncate text-sm font-semibold text-[#F2F2EF]">
                  {title}
                  <span className="ml-3 hidden font-normal text-[#9A9A96] sm:inline">{data.dateLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="app-field hidden h-10 items-center gap-2 rounded-[12px] px-3 text-xs text-[#9A9A96] transition-colors hover:text-[#F2F2EF] sm:flex"
                >
                  <Search className="size-3.5" aria-hidden="true" />
                  <span className="w-28 text-left">Search…</span>
                  <kbd className="rounded-[6px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px]">⌘&nbsp;K</kbd>
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
                  className="app-inverse inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-xs font-semibold tracking-[0.06em] hover:bg-white"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  COMMIT
                </button>
              </div>
            </header>

            <main id="content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">{children}</div>
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

// ------------------------------------------------------------------ sidebar
function SidebarContent({ data, pathname, scope }: { data: ShellData; pathname: string; scope: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  return (
    <LayoutGroup id={`nav-${scope}`}>
      <div className="px-5 pb-4 pt-5">
        <Link href="/today" className="block rounded-[8px]">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9A96]">Ksan Relay</span>
          <span className="block text-xl font-bold tracking-[-0.03em]">STATE</span>
        </Link>
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3">
        {navSections(data).map((section, i) => (
          <div key={i}>
            {section.title && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9A96]">{section.title}</p>}
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
                        <span className={cn("font-mono text-[11px] tabular-nums", active ? "text-[#55554F]" : "text-[#9A9A96]")}>{item.badge}</span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/[0.08] p-3">
        <NavLink href="/settings" active={isActive(pathname, "/settings")}>
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </NavLink>
        <div className="flex items-center gap-3 px-3 pt-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[11px] font-semibold border border-white/15" aria-hidden="true">
            {data.user.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{data.user.name}</span>
            <span className="block truncate text-xs text-[#9A9A96]">{data.user.email}</span>
          </span>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await authClient.signOut();
              router.replace("/login" as Route);
              router.refresh();
            }}
            aria-label="Sign out"
            className="grid size-8 place-items-center rounded-full text-[#9A9A96] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2EF] disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </LayoutGroup>
  );
}

/** Nav item whose near-white active pill slides between items (shared layout animation). */
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-medium transition-colors duration-150",
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
type Command = { id: string; label: string; group: string; hint?: string; run: () => void };

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
    { id: "capture", label: "Capture task", group: "Actions", hint: "N", run: go("/inbox?capture=1") },
    ...navSections(data).flatMap((s) => s.items.map((i) => ({ id: i.href, label: `Open ${i.name}`, group: "Go to", hint: i.shortcut, run: go(i.href) }))),
    { id: "/settings", label: "Open settings", group: "Go to", run: go("/settings") },
    ...data.projects.map((p) => ({ id: p.href, label: p.name, group: "Projects", run: go(p.href) })),
  ];
  const q = query.trim().toLowerCase();
  const results = q ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)) : commands;

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);
  React.useEffect(() => setIndex(0), [query]);

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
              placeholder="Type a command or project…"
              className="h-14 flex-1 bg-transparent text-base text-[#F2F2EF] placeholder:text-[#6F6F6B] focus:outline-none"
            />
            <kbd className="rounded-[6px] bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#A9A9A6]">esc</kbd>
          </div>
          <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-[#A9A9A6]">No matches.</li>}
            {results.map((c, i) => (
              <li
                key={`${c.group}-${c.id}`}
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === index}
                onPointerMove={() => setIndex(i)}
                onClick={() => run(c)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm", i === index ? "bg-white/10 text-white" : "text-[#C9C9C5]")}
              >
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6F6B]">{c.group}</span>
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint && <kbd className="font-mono text-[10px] text-[#85857F]">{c.hint}</kbd>}
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
  "app-field h-11 w-full rounded-[14px] bg-[#000000] px-3 text-sm text-[#F2F2EF] focus:border-white/45 focus:outline-none";

function CommitDialog({
  open,
  onOpenChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ShellData["projects"];
}) {
  const notify = useLocalOnlyNotice();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (setError(null), onOpenChange(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 origin-top data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 overscroll-contain rounded-[28px] bg-[#0A0A0A] p-6 border border-white/10 outline-none">
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Record a commit</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[#9A9A96]">
            For executed work that never started as a task.
          </Dialog.Description>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const message = String(form.get("message") ?? "").trim();
              if (!message) {
                setError("Describe what you did.");
                e.currentTarget.querySelector<HTMLTextAreaElement>("textarea")?.focus();
                return;
              }
              onOpenChange(false);
              notify(`Commit drafted: “${message}” +${form.get("weight")}.`);
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="commit-message" className="text-xs font-medium text-[#9A9A96]">
                What did you do?
              </label>
              <textarea
                id="commit-message"
                name="message"
                rows={3}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "commit-message-error" : undefined}
                placeholder="Reviewed pull request #38…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
                className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-sm max-md:text-base"
              />
              {error && (
                <p id="commit-message-error" className="text-xs text-[#F0A39B]">
                  {error}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="commit-project" className="text-xs font-medium text-[#9A9A96]">
                  Project
                </label>
                <select id="commit-project" name="project" className={selectClass} defaultValue="">
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.href} value={p.href}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="commit-weight" className="text-xs font-medium text-[#9A9A96]">
                  Execution
                </label>
                <select id="commit-weight" name="weight" className={selectClass} defaultValue="2">
                  <option value="1">Small, 1</option>
                  <option value="2">Normal, 2</option>
                  <option value="4">Major, 4</option>
                  <option value="8">Milestone, 8</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[#9A9A96]">
                <kbd className="font-mono">⌘&nbsp;Enter</kbd> to commit
              </p>
              <div className="flex gap-2">
                <Dialog.Close className="app-btn h-10 rounded-[12px] px-4 text-sm font-medium">Cancel</Dialog.Close>
                <button type="submit" className="app-inverse h-10 rounded-[12px] px-4 text-sm font-semibold">
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
