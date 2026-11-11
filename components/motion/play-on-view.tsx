"use client";

import * as React from "react";

/**
 * Plays a section's entrance animations when it scrolls into view instead of at page
 * load (when nobody sees them). The server HTML renders as-is; after hydration, sections
 * still below the fold are hidden, and on first view their children remount, so graph
 * cells fill, bars grow and numbers count up in front of the reader.
 */
export function PlayOnView({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<"static" | "waiting" | "played">("static");
  const [round, setRound] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already seen
    setState("waiting");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRound((r) => r + 1);
        setState("played");
        io.disconnect();
      },
      { rootMargin: "0px 0px -15% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: state === "waiting" ? 0 : 1,
        transform: state === "waiting" ? "translateY(32px)" : "none",
        transition: state === "played" ? "opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)" : undefined,
      }}
    >
      <React.Fragment key={round}>{children}</React.Fragment>
    </div>
  );
}
