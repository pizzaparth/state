"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { createCommitAction } from "@/app/(app)/client-actions";
import { WEIGHT_LEVELS, weightHint } from "@/lib/weights";
import { COMMIT_TAGS_MAX } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";

type Draft = { message: string; projectId: string; weight: number; tags: string };

const DRAFT_KEY = "state:draft:commit";
const LAST_KEY = "state:last-commit";

const read = <T,>(storage: "local" | "session", key: string): T | null => {
  try {
    const raw = (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (storage: "local" | "session", key: string, value: unknown) => {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: drafts last as long as the page
  }
};

const splitTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
    .filter(Boolean);

/**
 * Log work: a manual commit for work that never started as a task. The draft (message,
 * project, weight, tags) survives closing and reloading, and is cleared only by a
 * successful commit or Discard. The last project and weight are remembered; recent
 * messages are suggested as you type.
 */
export function CommitDialog({
  open,
  onOpenChange,
  projects,
  recentMessages,
  tagNames,
  initialMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string }[];
  /** Last manual commit messages, newest first. */
  recentMessages: string[];
  tagNames: string[];
  /** Prefill from the palette ("Log work …"); otherwise the saved draft. */
  initialMessage?: string | null;
}) {
  const notify = useNotice();
  const [draft, setDraft] = React.useState<Draft>({ message: "", projectId: "", weight: 2, tags: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // On open: the saved draft, else the remembered project and weight
  React.useEffect(() => {
    if (!open) return;
    const saved = read<Draft>("session", DRAFT_KEY);
    const last = read<{ projectId: string; weight: number }>("local", LAST_KEY);
    const base = saved ?? { message: "", projectId: last?.projectId ?? "", weight: last?.weight ?? 2, tags: "" };
    const projectOk = !base.projectId || projects.some((p) => p.id === base.projectId);
    setDraft({ ...base, projectId: projectOk ? base.projectId : "", message: initialMessage ?? base.message });
    setError(null);
  }, [open, initialMessage, projects]);

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      write("session", DRAFT_KEY, next.message || next.tags ? next : null);
      return next;
    });

  const dirty = Boolean(draft.message.trim() || draft.tags.trim());
  React.useEffect(() => {
    if (!open || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);

  const q = draft.message.trim().toLowerCase();
  const suggestions = q.length >= 2 ? [...new Set(recentMessages)].filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q).slice(0, 5) : [];
  const tagQuery = draft.tags.split(",").at(-1)?.trim().toLowerCase() ?? "";
  const tagSuggestions = tagQuery ? tagNames.filter((t) => t.startsWith(tagQuery) && !splitTags(draft.tags).includes(t)).slice(0, 5) : [];

  const discard = () => {
    write("session", DRAFT_KEY, null);
    setDraft((d) => ({ ...d, message: "", tags: "" }));
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content className="app-overlay fixed left-1/2 top-[10vh] z-50 max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in">
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Log work</Dialog.Title>
          <Dialog.Description className="mt-1 font-mono text-[12px] text-[#71717A]">finished work that never was a task</Dialog.Description>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const message = draft.message.trim();
              if (!message) {
                setError("Describe what you did.");
                textareaRef.current?.focus();
                return;
              }
              const tags = splitTags(draft.tags);
              if (tags.length > COMMIT_TAGS_MAX) {
                setError(`Up to ${COMMIT_TAGS_MAX} tags.`);
                return;
              }
              if (pending) return;
              startTransition(async () => {
                const result = await createCommitAction({ message, projectId: draft.projectId || null, weight: draft.weight, tags });
                if (!result.ok) {
                  setError(result.error);
                  textareaRef.current?.focus();
                  return;
                }
                write("session", DRAFT_KEY, null);
                write("local", LAST_KEY, { projectId: draft.projectId, weight: draft.weight });
                setDraft((d) => ({ ...d, message: "", tags: "" }));
                onOpenChange(false);
                notify(`Commit recorded: “${message}” +${draft.weight}.`);
              });
            }}
          >
            <div className="relative space-y-1.5">
              <label htmlFor="commit-message" className="text-sm font-medium text-[#52525B]">
                What did you do?
              </label>
              <textarea
                ref={textareaRef}
                id="commit-message"
                name="message"
                rows={3}
                maxLength={500}
                value={draft.message}
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "commit-message-error" : undefined}
                placeholder="Finished chapter 4…"
                onChange={(e) => (update({ message: e.target.value }), setError(null), setSuggestOpen(true))}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                  if (e.key === "Escape" && suggestOpen && suggestions.length) {
                    e.stopPropagation();
                    setSuggestOpen(false);
                  }
                }}
                className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-base"
              />
              {suggestOpen && suggestions.length > 0 && (
                <ul aria-label="Recent messages" className="app-overlay absolute inset-x-0 top-full z-10 mt-1 rounded-[14px] p-1.5">
                  {suggestions.map((m) => (
                    <li key={m}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => (update({ message: m }), setSuggestOpen(false), textareaRef.current?.focus())}
                        className="w-full truncate rounded-[10px] px-3 py-2 text-left text-base hover:bg-black/[0.05]"
                      >
                        {m}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && (
                <p id="commit-message-error" aria-live="polite" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="commit-project" className="text-sm font-medium text-[#52525B]">
                  Project
                </label>
                <select id="commit-project" name="project" className="app-select" value={draft.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="commit-weight" className="text-sm font-medium text-[#52525B]">
                  Weight
                </label>
                <select
                  id="commit-weight"
                  name="weight"
                  className="app-select"
                  value={draft.weight}
                  onChange={(e) => update({ weight: Number(e.target.value) })}
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
            <p id="commit-weight-hint" className="-mt-1 text-sm leading-relaxed text-[#52525B]">
              {weightHint(draft.weight)}
            </p>
            <div className="relative space-y-1.5">
              <label htmlFor="commit-tags" className="text-sm font-medium text-[#52525B]">
                Tags
              </label>
              <input
                id="commit-tags"
                name="tags"
                value={draft.tags}
                onChange={(e) => update({ tags: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="reading, chapter-4…"
                className="app-input h-11 w-full rounded-[14px] px-3 text-base"
              />
              {tagSuggestions.length > 0 && (
                <p className="flex flex-wrap gap-1.5">
                  {tagSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update({ tags: [...draft.tags.split(",").slice(0, -1).map((x) => x.trim()).filter(Boolean), t].join(", ") + ", " })}
                      className="app-btn h-8 rounded-full px-3 font-mono text-[12px]"
                    >
                      {t}
                    </button>
                  ))}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="font-mono text-[12px] text-[#71717A]">
                <kbd>⌘&nbsp;↵</kbd> commit
              </p>
              <div className="flex gap-2">
                {dirty ? (
                  <button type="button" onClick={discard} className="app-btn h-10 rounded-[12px] px-4 text-base font-medium">
                    Discard
                  </button>
                ) : (
                  <Dialog.Close className="app-btn h-10 rounded-[12px] px-4 text-base font-medium">Cancel</Dialog.Close>
                )}
                <button type="submit" disabled={pending} className={cn("app-inverse inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-base font-semibold disabled:opacity-70")}>
                  {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Commit
                </button>
              </div>
            </div>
            {dirty && <p className="-mt-2 font-mono text-[12px] text-[#71717A]">draft kept if you close</p>}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
