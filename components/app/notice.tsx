"use client";

import * as React from "react";

type NoticeAction = { label: string; run: () => void };
type Notice = { id: number; text: string; action?: NoticeAction };

const NoticeContext = React.createContext<(text: string, action?: NoticeAction) => void>(() => {});

/** How long `Z` can still run the most recent Undo after its notice appeared. */
const UNDO_WINDOW_MS = 30_000;

/**
 * Compact, polite status messages (bottom-centre). One at a time; no emoji, no confetti.
 * Up to two lines (the full text is in the title). A notice with an action (Undo) stays
 * longer; the timer pauses while the pointer is over the notice or focus is inside it.
 * `Z` runs the most recent Undo while it is still valid.
 */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [paused, setPaused] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const deadline = React.useRef(0);
  const remaining = React.useRef(0);
  const lastUndo = React.useRef<{ action: NoticeAction; until: number; id: number } | null>(null);

  const startTimer = React.useCallback((ms: number) => {
    window.clearTimeout(timer.current);
    deadline.current = Date.now() + ms;
    timer.current = window.setTimeout(() => setNotice(null), ms);
  }, []);

  const show = React.useCallback(
    (text: string, action?: NoticeAction) => {
      const id = Date.now();
      setNotice({ id, text, action });
      setPaused(false);
      if (action) lastUndo.current = { action, until: Date.now() + UNDO_WINDOW_MS, id };
      startTimer(action ? 8000 : 4200);
    },
    [startTimer]
  );

  const pause = () => {
    if (paused || !notice) return;
    window.clearTimeout(timer.current);
    remaining.current = Math.max(1000, deadline.current - Date.now());
    setPaused(true);
  };
  const resume = (e?: React.FocusEvent) => {
    if (!paused) return;
    // Focus moving within the notice keeps it paused
    if (e && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setPaused(false);
    startTimer(remaining.current);
  };

  const runAction = React.useCallback((action: NoticeAction) => {
    window.clearTimeout(timer.current);
    setNotice(null);
    lastUndo.current = null;
    action.run();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const undo = lastUndo.current;
      if (!undo || Date.now() > undo.until) return;
      e.preventDefault();
      runAction(undo.action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runAction]);

  return (
    <NoticeContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))]">
        {notice && (
          <div
            key={notice.id}
            title={notice.text}
            onPointerEnter={pause}
            onPointerLeave={() => resume()}
            onFocus={pause}
            onBlur={resume}
            className="app-inverse animate-toast-in pointer-events-auto relative flex max-w-[min(36rem,100%)] items-center gap-3 overflow-hidden rounded-[22px] px-4 py-2 text-base"
          >
            {/* Time left before the notice goes */}
            <span
              aria-hidden="true"
              className="mi-timer absolute inset-x-0 bottom-0 h-[2px] origin-left bg-accent-ink/40"
              style={{ animationDuration: notice.action ? "8000ms" : "4200ms", animationPlayState: paused ? "paused" : "running" }}
            />
            <span className="line-clamp-2 min-w-0">{notice.text}</span>
            {notice.action && (
              <button
                type="button"
                onClick={() => runAction(notice.action!)}
                className="-my-1 -mr-2 shrink-0 rounded-full px-3 py-1 font-semibold underline underline-offset-2 hover:bg-black/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {notice.action.label}
                {notice.action.label === "Undo" && <kbd className="ml-1.5 font-mono text-[12px] font-normal no-underline opacity-80 [@media(pointer:coarse)]:hidden">Z</kbd>}
              </button>
            )}
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => React.useContext(NoticeContext);
