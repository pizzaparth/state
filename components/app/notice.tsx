"use client";

import * as React from "react";

type NoticeAction = { label: string; run: () => void };
type Notice = { id: number; text: string; action?: NoticeAction };

const NoticeContext = React.createContext<(text: string, action?: NoticeAction) => void>(() => {});

/**
 * Compact, polite status messages (bottom-centre). One at a time; no emoji, no confetti.
 * A notice with an action (Undo) stays longer so there is time to reach it.
 */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  const show = React.useCallback((text: string, action?: NoticeAction) => {
    window.clearTimeout(timer.current);
    setNotice({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setNotice(null), action ? 8000 : 4200);
  }, []);

  return (
    <NoticeContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-4">
        {notice && (
          <p key={notice.id} className="app-inverse animate-toast-in flex items-center gap-3 rounded-full px-4 py-2 text-base">
            <span className="min-w-0 truncate">{notice.text}</span>
            {notice.action && (
              <button
                type="button"
                onClick={() => {
                  window.clearTimeout(timer.current);
                  setNotice(null);
                  notice.action?.run();
                }}
                className="pointer-events-auto -my-1 -mr-2 shrink-0 rounded-full px-3 py-1 font-semibold underline underline-offset-2 hover:bg-[#00203D]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00203D]"
              >
                {notice.action.label}
              </button>
            )}
          </p>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => React.useContext(NoticeContext);
