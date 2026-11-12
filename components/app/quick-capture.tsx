"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { captureManyAction, captureTaskAction, createProjectAction } from "@/app/(app)/client-actions";
import { CAPTURE_MANY_MAX, parseQuickCapture, slugify } from "@/lib/validation";
import { dayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNotice } from "./notice";

type Project = { slug: string; name: string };

const PRIORITY_WORDS = ["critical", "high", "medium", "low"] as const;

// Tokens the parser reads, for the grey pills behind the text (escaped ones stay plain)
const TOKEN_RE =
  /(?<![\\\w])(#[\w-]+|!(?:critical|high|medium|low)\b|\+[1248](?=\s|$)|~(?:daily|weekdays|weekly|monthly)(?=\s|$)|\b(?:today|tomorrow|eom|next week|in \d{1,3} ?(?:d|days?|w|weeks?)|\d{4}-\d{2}-\d{2}|(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?)\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b)/gi;

function readDraft(key: string | undefined): string {
  if (!key) return "";
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string | undefined, value: string) {
  if (!key) return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage blocked: the draft lives only while the page does
  }
}

/** The `#word` or `!word` the caret is in, if any. */
function tokenAtCaret(value: string, caret: number): { kind: "#" | "!"; start: number; query: string } | null {
  const before = value.slice(0, caret);
  const m = before.match(/(?:^|\s)([#!])([\w-]*)$/);
  if (!m) return null;
  const start = caret - m[2].length - 1;
  if (value[start - 1] === "\\") return null;
  return { kind: m[1] as "#" | "!", start, query: m[2].toLowerCase() };
}

/**
 * One-field capture with a live preview of what the deterministic parser understood
 * (#project, !priority, +weight, ~repeat, due day). Recognised tokens get a grey pill
 * behind the text; typing # or ! opens a list of projects or priorities (APG combobox).
 *
 *   Enter          save to the Inbox (the field stays open for the next one)
 *   Shift+Enter    save straight to Queued on the board
 *   ⌘/Ctrl+Enter   save and close (in the capture dialog)
 *
 * An unknown #project is never dropped silently: the person creates it or keeps it as
 * text. Pasting several lines offers to add one task per line. With `draftKey`, the
 * text survives closing and reloading (sessionStorage) until it is saved.
 */
export function QuickCapture({
  projects: initialProjects,
  tz,
  autoFocus = false,
  showRecent = true,
  placeholder = "Add a task… #project !high fri",
  draftKey,
  onCaptured,
  inputRef: externalRef,
  defaultProject,
}: {
  /** Files captures under this project unless the text names another (#slug). */
  defaultProject?: string;
  projects: Project[];
  /** The person's timezone, so "today" in the preview is the server's today. */
  tz: string;
  autoFocus?: boolean;
  /** List this session's captures under the field (off where the Inbox list is already shown). */
  showRecent?: boolean;
  placeholder?: string;
  draftKey?: string;
  /** After a save; `close` is true for ⌘/Ctrl+Enter. */
  onCaptured?: (close: boolean) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [value, setValueState] = React.useState("");
  const [projects, setProjects] = React.useState(initialProjects);
  React.useEffect(() => setProjects(initialProjects), [initialProjects]);
  const [captured, setCaptured] = React.useState<{ id: string; title: string; detail: string; queued: boolean }[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<string[] | null>(null);
  const [unknownAsked, setUnknownAsked] = React.useState(false);
  const [caret, setCaret] = React.useState(0);
  const [active, setActive] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const notify = useNotice();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(externalRef, () => inputRef.current as HTMLInputElement);
  const id = React.useId();

  const setValue = (next: string) => {
    setValueState(next);
    writeDraft(draftKey, next);
  };

  React.useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft) setValueState(draft);
  }, [draftKey]);

  React.useEffect(() => {
    // Desktop with a single primary input: focus it; leave mobile keyboards closed
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = value.trim() ? parseQuickCapture(value, dayKey(new Date(), tz)) : null;
  const slug = parsed?.projectSlug?.toLowerCase();
  const project = slug ? projects.find((p) => p.slug === slug) : undefined;
  const unknownSlugRaw = slug && !project ? parsed!.projectSlug! : null;

  // ---------------------------------------------------------------- autocomplete
  const token = dismissed ? null : tokenAtCaret(value, caret);
  const options =
    token?.kind === "#"
      ? projects.filter((p) => p.slug.startsWith(token.query) || p.name.toLowerCase().includes(token.query)).slice(0, 8).map((p) => ({ value: p.slug, label: p.name, hint: `#${p.slug}` }))
      : token?.kind === "!"
        ? PRIORITY_WORDS.filter((p) => p.startsWith(token.query)).map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1), hint: `!${p}` }))
        : [];
  const listOpen = options.length > 0 && !(options.length === 1 && options[0].value === token?.query);
  const listId = `${id}-list`;
  // While the list is open the person is still typing the #project
  const unknownSlug = listOpen ? null : unknownSlugRaw;
  const pick = (option: { value: string }) => {
    if (!token) return;
    const end = token.start + 1 + token.query.length;
    const next = `${value.slice(0, token.start)}${token.kind}${option.value} ${value.slice(end).replace(/^\s+/, "")}`;
    setValue(next);
    const pos = token.start + option.value.length + 2;
    setCaret(pos);
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  // ---------------------------------------------------------------- saving
  const save = (opts: { queued?: boolean; close?: boolean; text?: string } = {}) => {
    const typed = opts.text ?? value;
    const text = defaultProject && !parseQuickCapture(typed, dayKey(new Date(), tz)).projectSlug ? `${typed} #${defaultProject}` : typed;
    const p = parseQuickCapture(text, dayKey(new Date(), tz));
    if (!p.title || pending) return;
    const s = p.projectSlug?.toLowerCase();
    if (s && !projects.some((x) => x.slug === s)) {
      setUnknownAsked(true);
      return;
    }
    startTransition(async () => {
      const result = await captureTaskAction({ text, queued: opts.queued ?? false });
      if (!result.ok) {
        setError(result.error);
        inputRef.current?.focus();
        return;
      }
      setError(null);
      setUnknownAsked(false);
      setValue("");
      const detail = [result.data.projectName, p.priority, p.weight ? `+${p.weight}` : null].filter(Boolean).join(", ") || "Unsorted";
      setCaptured((c) => [{ id: result.data.id, title: result.data.title, detail, queued: result.data.queued }, ...c].slice(0, 5));
      notify(`Captured “${result.data.title}” to ${result.data.queued ? "Queued" : "Inbox"}.`);
      onCaptured?.(opts.close ?? false);
    });
  };

  const createAndSave = (word: string) =>
    startTransition(async () => {
      const newSlug = slugify(word) || word.toLowerCase();
      const created = await createProjectAction({ name: word, slug: newSlug, description: null });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      setProjects((list) => [...list, { slug: created.data.slug, name: word }]);
      setUnknownAsked(false);
      const text = value.replace(new RegExp(`(^|\\s)#${word.replace(/[-]/g, "\\-")}(?=\\s|$)`), `$1#${created.data.slug}`);
      const result = await captureTaskAction({ text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue("");
      setCaptured((c) => [{ id: result.data.id, title: result.data.title, detail: word, queued: false }, ...c].slice(0, 5));
      notify(`Created #${created.data.slug} and captured “${result.data.title}”.`);
      onCaptured?.(false);
    });

  const keepAsText = (word: string) => {
    const text = value.replace(new RegExp(`(^|\\s)#${word.replace(/[-]/g, "\\-")}(?=\\s|$)`), `$1\\#${word}`);
    setValue(text);
    setUnknownAsked(false);
    save({ text });
  };

  const saveLines = (queued: boolean) => {
    if (!lines) return;
    const list = lines;
    startTransition(async () => {
      const result = await captureManyAction({ lines: list, queued });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLines(null);
      notify(`Added ${result.data.count} tasks to ${result.data.queued ? "Queued" : "Inbox"}.`);
      onCaptured?.(false);
    });
  };

  // Mirror scroll so the pills stay under their words
  const syncMirror = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.style.transform = `translateX(${-inputRef.current.scrollLeft}px)`;
  };

  const preview = parsed?.title && (
    <>
      {unknownSlug ? "" : "Task "}
      {!unknownSlug && <span className="font-medium text-[#0A0A0A]">“{parsed.title}”</span>}
      {!unknownSlug && project && `, project ${project.name}`}
      {!unknownSlug && parsed.priority && `, ${parsed.priority} priority`}
      {!unknownSlug && parsed.weight && `, +${parsed.weight}`}
      {!unknownSlug && parsed.repeat && `, repeats ${parsed.repeat}`}
      {!unknownSlug &&
        parsed.dueDate &&
        `, due ${new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${parsed.dueDate}T00:00:00Z`))}`}
    </>
  );

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="app-field relative flex items-center gap-2 rounded-[18px] p-1.5 pl-4"
      >
        <label htmlFor={id} className="sr-only">
          Capture a task
        </label>
        <div className="relative h-10 min-w-0 flex-1 overflow-hidden">
          {/* Mirrored text with the recognised tokens on grey pills, under the transparent input */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center whitespace-pre text-base text-transparent">
            <div ref={mirrorRef}>
              {value.split(TOKEN_RE).map((part, i) =>
                i % 2 === 1 ? (
                  <span key={i} className="rounded-[6px] bg-black/[0.07] shadow-[0_0_0_2px_rgba(0,0,0,0.07)]">
                    {part}
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </div>
          </div>
          <input
            ref={inputRef}
            id={id}
            name="task"
            autoComplete="off"
            spellCheck={false}
            value={value}
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setError(null);
              setActive(0);
              setDismissed(false);
              setUnknownAsked(false);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onScroll={syncMirror}
            onKeyUp={syncMirror}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              const split = text
                .split(/\r?\n/)
                .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
                .filter(Boolean);
              if (split.length > 1) {
                e.preventDefault();
                setLines(split.slice(0, CAPTURE_MANY_MAX));
              }
            }}
            onKeyDown={(e) => {
              if (listOpen) {
                if (e.key === "ArrowDown") return (e.preventDefault(), setActive((i) => (i + 1) % options.length));
                if (e.key === "ArrowUp") return (e.preventDefault(), setActive((i) => (i - 1 + options.length) % options.length));
                if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) || e.key === "Tab") {
                  e.preventDefault();
                  return pick(options[Math.min(active, options.length - 1)]);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  return setDismissed(true);
                }
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save({ close: true });
              } else if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                save({ queued: true });
              }
            }}
            maxLength={500}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-status`}
            placeholder={placeholder}
            className="relative h-10 w-full bg-transparent text-base text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none max-md:text-base"
          />
        </div>
        <button
          type="submit"
          disabled={!parsed?.title || pending}
          className="app-btn mi-spin inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 text-base font-medium disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          Capture
        </button>
        {listOpen && (
          <ul id={listId} role="listbox" aria-label={token?.kind === "#" ? "Projects" : "Priorities"} className="app-overlay absolute left-2 top-[calc(100%+6px)] z-30 min-w-56 rounded-[16px] p-1.5">
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => (e.preventDefault(), pick(o))}
                className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-[10px] px-3 py-2 text-base", i === active && "bg-black/[0.05]")}
              >
                <span className="truncate">{o.label}</span>
                <span className="font-mono text-[12px] text-[#71717A]">{o.hint}</span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div id={`${id}-status`} aria-live="polite" className="mt-2 min-h-5 px-2 text-sm text-[#52525B]">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : lines ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{lines.length} lines pasted.</span>
            <button type="button" disabled={pending} onClick={() => saveLines(false)} className="app-btn mi-press h-9 rounded-[10px] px-3 font-medium text-[#0A0A0A]">
              Add {lines.length} tasks
            </button>
            <button type="button" disabled={pending} onClick={() => saveLines(true)} className="app-btn mi-press h-9 rounded-[10px] px-3 font-medium text-[#0A0A0A]">
              to Queued
            </button>
            <button type="button" onClick={() => setLines(null)} className="h-9 rounded-[10px] px-2 hover:text-[#0A0A0A]">
              Cancel
            </button>
          </span>
        ) : unknownSlug ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>
              No project <span className="font-mono text-[#0A0A0A]">#{unknownSlug}</span>.
            </span>
            <button type="button" disabled={pending} onClick={() => createAndSave(unknownSlug)} className={cn("app-btn mi-press h-9 rounded-[10px] px-3 font-medium text-[#0A0A0A]", unknownAsked && "border-accent")}>
              Create project #{slugify(unknownSlug) || unknownSlug}
            </button>
            <button type="button" disabled={pending} onClick={() => keepAsText(unknownSlug)} className="app-btn mi-press h-9 rounded-[10px] px-3 font-medium text-[#0A0A0A]">
              Keep as text
            </button>
          </span>
        ) : (
          preview
        )}
      </div>

      {showRecent && captured.length > 0 && (
        <ul className="mt-2 space-y-1">
          {captured.map((c) => (
            <li key={c.id} className="flex animate-row-in items-center gap-3 rounded-[12px] px-3 py-2 text-base">
              <span aria-hidden="true" className="app-field size-3 rounded-full" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <span className="text-sm text-[#71717A]">{c.detail}</span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">{c.queued ? "Queued" : "In Inbox"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
