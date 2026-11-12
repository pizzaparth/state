"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { completeTaskAction, captureTaskAction } from "@/app/(app)/client-actions";
import { markPanelOpen } from "@/lib/panel-history";
import { readRecent, type RecentItem } from "@/lib/recent";
import { useNotice } from "./notice";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  hint?: string;
  detail?: string;
  /** Set for task results: ⌘Enter completes, Tab shows actions. */
  taskId?: string;
  done?: boolean;
  run: () => void;
}

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

/**
 * ⌘K. Empty: recent tasks and commits, then commands. Typing searches commands, projects,
 * tasks and commits (titles, descriptions, tags, project names). `>` limits to commands,
 * `#` to projects. With a task highlighted, ⌘Enter completes it and Tab lists its
 * actions. No match offers Create task "…" and Log work "…".
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
  projects,
  onLogWork,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Actions and navigation (group "Actions" or "Go to"). */
  commands: PaletteCommand[];
  projects: { id: string; name: string; href: string }[];
  onLogWork: (message: string) => void;
}) {
  const router = useRouter();
  const notify = useNotice();
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const [actionsFor, setActionsFor] = React.useState<PaletteCommand | null>(null);
  const [recent, setRecent] = React.useState<RecentItem[]>([]);

  const go = (href: string, panel = false) => () => {
    if (panel) markPanelOpen(href);
    router.push(href as Route);
  };

  const raw = query.trim();
  const mode = raw.startsWith(">") ? "commands" : raw.startsWith("#") ? "projects" : "all";
  const q = (mode === "all" ? raw : raw.slice(1).trim()).toLowerCase();
  const search = useWorkSearch(open && mode === "all" ? raw : "");

  const complete = (c: PaletteCommand) => {
    if (!c.taskId || c.done) return;
    onOpenChange(false);
    void completeTaskAction({ taskId: c.taskId }).then((r) => notify(r.ok ? `Done. +${r.data.committed}.` : r.error));
  };

  const projectCommands: PaletteCommand[] = projects.map((p) => ({ id: p.href, label: p.name, group: "Projects", run: go(p.href) }));
  const found: PaletteCommand[] = search.hits.map((h) => ({
    id: `${h.kind}-${h.id}`,
    label: h.title,
    group: h.kind === "task" ? "Tasks" : "Commits",
    detail: h.context,
    hint: h.kind === "task" && h.done ? "done" : undefined,
    taskId: h.kind === "task" ? h.id : undefined,
    done: h.done,
    run: go(h.href, true),
  }));
  const recentCommands: PaletteCommand[] = recent.map((r) => ({
    id: `recent-${r.kind}-${r.id}`,
    label: r.title,
    group: "Recent",
    detail: r.kind === "task" ? "Task" : "Commit",
    taskId: r.kind === "task" ? r.id : undefined,
    run: go(r.href, true),
  }));
  const matches = (c: PaletteCommand) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q);

  let results: PaletteCommand[];
  if (actionsFor) {
    results = [
      { id: "a-open", label: `Open “${actionsFor.label}”`, group: "Task", run: actionsFor.run },
      ...(actionsFor.taskId && !actionsFor.done ? [{ id: "a-done", label: "Mark done", group: "Task", hint: "⌘ ↵", run: () => complete(actionsFor) }] : []),
      { id: "a-back", label: "Back to results", group: "Task", hint: "esc", run: () => setActionsFor(null) },
    ];
  } else if (mode === "commands") results = commands.filter(matches);
  else if (mode === "projects") results = projectCommands.filter(matches);
  else if (!q) results = [...recentCommands, ...commands];
  else {
    results = [...commands.filter(matches), ...projectCommands.filter(matches), ...found];
    if (!search.loading && results.length === 0) {
      results = [
        {
          id: "create-task",
          label: `Create task “${raw}”`,
          group: "Create",
          run: () =>
            void captureTaskAction({ text: raw }).then((r) => notify(r.ok ? `Captured “${r.data.title}” to Inbox.` : r.error)),
        },
        { id: "log-work", label: `Log work “${raw}”`, group: "Create", run: () => onLogWork(raw) },
      ];
    }
  }

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setActionsFor(null);
      setRecent(readRecent());
    }
  }, [open]);
  React.useEffect(() => setIndex(0), [query, actionsFor]);
  // Results arriving later can shorten the list under the cursor
  React.useEffect(() => setIndex((i) => Math.min(i, Math.max(0, results.length - 1))), [results.length]);

  const run = (c: PaletteCommand | undefined) => {
    if (!c) return;
    if (c.id === "a-back") return c.run();
    onOpenChange(false);
    c.run();
  };

  // Group headings, in first-seen order; the flat index drives the keyboard cursor
  const groups: { name: string; items: { c: PaletteCommand; i: number }[] }[] = [];
  results.forEach((c, i) => {
    const g = groups.find((x) => x.name === c.group) ?? groups[groups.push({ name: c.group, items: [] }) - 1];
    g.items.push({ c, i });
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (actionsFor) {
              e.preventDefault();
              setActionsFor(null);
            }
          }}
          className="app-overlay fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-hidden rounded-[24px] outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-5">
            <Search className="size-4 text-[#52525B]" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => (setQuery(e.target.value), setActionsFor(null))}
              onKeyDown={(e) => {
                const current = results[index];
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(results.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (current?.taskId) complete(actionsFor ?? current);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  run(current);
                } else if (e.key === "Tab" && !e.shiftKey && current?.taskId && !actionsFor) {
                  e.preventDefault();
                  setActionsFor(current);
                }
              }}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="palette-results"
              aria-activedescendant={results[index] ? `cmd-${index}` : undefined}
              placeholder="Search, or > commands, # projects…"
              className="h-14 flex-1 bg-transparent text-base text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none"
            />
            {search.loading && <Loader2 className="size-4 animate-spin text-[#71717A]" aria-hidden="true" />}
            <kbd className="rounded-[6px] bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-[#52525B]">esc</kbd>
          </div>
          <p role="status" className="sr-only">
            {q.length >= 2 && !search.loading ? `${results.length} results` : ""}
          </p>
          <div id="palette-results" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
            {results.length === 0 && <p className="px-3 py-6 text-center text-base text-[#52525B]">{search.loading ? "Searching…" : "No matches"}</p>}
            {groups.map((g) => (
              <div key={g.name} role="group" aria-label={g.name} className="pb-1">
                <p aria-hidden="true" className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#71717A]">
                  {g.name}
                </p>
                {g.items.map(({ c, i }) => (
                  <div
                    key={`${c.group}-${c.id}`}
                    id={`cmd-${i}`}
                    role="option"
                    aria-selected={i === index}
                    onPointerMove={() => setIndex(i)}
                    onClick={() => run(c)}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-base", i === index ? "bg-black/[0.05] text-[#0A0A0A]" : "text-[#27272A]")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.label}</span>
                      {c.detail && <span className="block truncate text-sm text-[#71717A]">{c.detail}</span>}
                    </span>
                    {i === index && c.taskId && !actionsFor ? (
                      <span className="hidden font-mono text-[11px] text-[#71717A] sm:inline">tab actions{c.done ? "" : " · ⌘↵ done"}</span>
                    ) : (
                      c.hint && <kbd className="font-mono text-[12px] text-[#71717A]">{c.hint}</kbd>
                    )}
                    {i === index && <CornerDownLeft aria-hidden="true" className="size-3.5 text-[#71717A]" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
