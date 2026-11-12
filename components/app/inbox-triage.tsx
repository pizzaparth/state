"use client";

import * as React from "react";
import { renameTaskAction, setTaskDueAction, setTaskProjectAction } from "@/app/(app)/client-actions";
import { useNotice } from "./notice";
import { PromptDialog } from "./prompt-dialog";
import { BulkBar } from "./kanban";

type Dialog = { kind: "due" | "rename" | "project"; taskId: string; title: string } | null;

/**
 * Keyboard triage over the Inbox list (C14): J/K move, 1 Queue, 2 Start, D due, P project,
 * E rename, ⌫ delete (with Undo), Enter opens. X or Shift-click selects rows for the bulk
 * bar (C9). The rows are server-rendered; this reads their data-* attributes.
 */
export function InboxTriage({
  children,
  projects,
  columns,
  today,
}: {
  children: React.ReactNode;
  projects: { id: string; name: string; slug: string }[];
  columns: { id: string; name: string }[];
  today: string;
}) {
  const notify = useNotice();
  const ref = React.useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const rows = () => [...(ref.current?.querySelectorAll<HTMLLIElement>("li[data-task-id]") ?? [])];
  const current = () => (document.activeElement?.closest("li[data-task-id]") as HTMLLIElement | null) ?? null;
  const focusRow = (li: HTMLLIElement | undefined) => li?.querySelector<HTMLAnchorElement>("a")?.focus();

  // Selection is drawn on the rows themselves
  React.useEffect(() => {
    for (const li of rows()) li.dataset.selected = String(selected.has(li.dataset.taskId!));
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
    const list = rows();
    const li = current();
    const i = li ? list.indexOf(li) : -1;
    const key = e.key.toLowerCase();
    const press = (action: string) => li?.querySelector<HTMLButtonElement>(`[data-row-action="${action}"]`)?.click();
    if (key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(list[Math.min(list.length - 1, i + 1)]);
    } else if (key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(list[Math.max(0, i - 1)]);
    } else if (!li) return;
    else if (key === "1" || key === "2" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      press(key === "1" ? "queue" : key === "2" ? "start" : "delete");
      focusRow(list[i + 1] ?? list[i - 1]);
    } else if (key === "x") {
      e.preventDefault();
      toggle(li.dataset.taskId!);
    }
    else if (key === "d" || key === "e" || key === "p") {
      e.preventDefault();
      setDialog({ kind: key === "d" ? "due" : key === "e" ? "rename" : "project", taskId: li.dataset.taskId!, title: li.dataset.title ?? "" });
    } else if (e.key === "Escape" && selected.size) setSelected(new Set());
  };

  return (
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      onClickCapture={(e) => {
        const li = (e.target as HTMLElement).closest("li[data-task-id]") as HTMLLIElement | null;
        const link = (e.target as HTMLElement).closest("a");
        if (li && link && (e.shiftKey || selected.size > 0)) {
          e.preventDefault();
          e.stopPropagation();
          toggle(li.dataset.taskId!);
        }
      }}
    >
      {children}
      <p className="mt-3 hidden font-mono text-[12px] text-[#71717A] [@media(pointer:fine)]:block">
        j k move · 1 queue · 2 start · d due · p project · e rename · ⌫ delete · x select
      </p>
      {selected.size > 0 && (
        <BulkBar ids={[...selected]} columns={columns} projects={projects} onDone={() => setSelected(new Set())} onClear={() => setSelected(new Set())} notify={notify} moveLabel="Place in…" />
      )}
      <PromptDialog
        open={dialog?.kind === "due"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Due date for “${dialog?.title ?? ""}”`}
        label="Day (YYYY-MM-DD), empty clears"
        initial={today}
        placeholder="2026-11-20…"
        onSubmit={async (v) => {
          const r = await setTaskDueAction({ taskId: dialog!.taskId, dueDate: v || null });
          if (r.ok) notify(v ? `Due ${v}.` : "Due date cleared.");
          return r.ok ? null : r.error;
        }}
      />
      <PromptDialog
        open={dialog?.kind === "rename"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rename task"
        label="Title"
        initial={dialog?.title ?? ""}
        onSubmit={async (v) => {
          const r = await renameTaskAction({ taskId: dialog!.taskId, title: v });
          if (r.ok) notify("Title saved.");
          return r.ok ? null : r.error;
        }}
      />
      <PromptDialog
        open={dialog?.kind === "project"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Project for “${dialog?.title ?? ""}”`}
        label={`Project slug (${projects.map((p) => p.slug).join(", ") || "none yet"}); empty unfiles`}
        initial=""
        placeholder="thesis…"
        onSubmit={async (v) => {
          const project = v ? projects.find((p) => p.slug === v.replace(/^#/, "").toLowerCase()) : null;
          if (v && !project) return "No project with that slug.";
          const r = await setTaskProjectAction({ taskId: dialog!.taskId, projectId: project?.id ?? null });
          if (r.ok) notify(project ? `Filed under ${project.name}.` : "Unfiled.");
          return r.ok ? null : r.error;
        }}
      />
    </div>
  );
}
