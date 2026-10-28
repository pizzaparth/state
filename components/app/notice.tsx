"use client";

import * as React from "react";

type Notice = { id: number; text: string };

const NoticeContext = React.createContext<(text: string) => void>(() => {});

/** Compact, polite status messages (bottom-centre). One at a time; no emoji, no confetti. */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  const show = React.useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setNotice({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);

  return (
    <NoticeContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-4">
        {notice && (
          <p key={notice.id} className="app-inverse animate-toast-in rounded-full px-4 py-2 text-sm">
            {notice.text}
          </p>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => React.useContext(NoticeContext);

/** Shown once per session the first time a local-only change is made. */
export function useLocalOnlyNotice() {
  const notify = useNotice();
  return React.useCallback(
    (text: string) => {
      let seen = false;
      try {
        seen = sessionStorage.getItem("state:local-only-seen") === "1";
        sessionStorage.setItem("state:local-only-seen", "1");
      } catch {
        // storage unavailable: show the full message every time
      }
      notify(seen ? text : `${text} Not saved yet: editing is not connected to the server.`);
    },
    [notify]
  );
}
