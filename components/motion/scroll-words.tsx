"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A paragraph whose words darken one by one as it scrolls through the middle of the
 * view. Opacity only; the full text is always in the DOM. Reduced motion shows it solid.
 */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("[data-word]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top reaches 85% of the view, 1 when the bottom reaches 45%
      const progress = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (rect.height + vh * 0.4)));
      const lit = progress * spans.length;
      spans.forEach((s, i) => {
        s.style.opacity = String(Math.min(1, Math.max(0.18, lit - i + 0.18)));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <p ref={ref} className={cn(className)}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span data-word className="transition-opacity duration-200">
            {w}
          </span>{" "}
        </React.Fragment>
      ))}
    </p>
  );
}
