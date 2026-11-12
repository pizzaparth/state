"use client";

import * as React from "react";
import { setProjectNotesAction } from "@/app/(app)/client-actions";
import { currentLocale } from "@/lib/locale";

/** Free-text project notes (up to 10 000 characters); saves on blur or ⌘/Ctrl+Enter. */
export function ProjectNotes({ projectId, notes, editable }: { projectId: string; notes: string | null; editable: boolean }) {
  const [text, setText] = React.useState(notes ?? "");
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const saved = React.useRef(notes ?? "");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 600)}px`;
  };
  React.useEffect(grow, []);
  const save = async () => {
    if (text === saved.current) return;
    setState("saving");
    const r = await setProjectNotesAction({ projectId, notes: text });
    if (!r.ok) {
      setState("idle");
      setError(r.error);
      return;
    }
    saved.current = text;
    setError(null);
    setState("saved");
    window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1800);
  };
  if (!editable) return notes ? <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#52525B]">{notes}</p> : null;
  return (
    <div>
      <label htmlFor="project-notes" className="sr-only">
        Project notes
      </label>
      <textarea
        ref={ref}
        id="project-notes"
        value={text}
        rows={3}
        maxLength={10_000}
        onChange={(e) => (setText(e.target.value), grow(), setError(null))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
        placeholder="Notes, links, decisions…"
        className="app-input w-full resize-none rounded-[14px] px-3 py-2.5 text-[15px] leading-relaxed"
      />
      <p aria-live="polite" className="mt-1 font-mono text-[12px] text-[#71717A]">
        {error ? <span className="text-danger">{error}</span> : state === "saving" ? "saving…" : state === "saved" ? "saved" : `${text.length.toLocaleString(currentLocale())} / 10,000`}
      </p>
    </div>
  );
}
