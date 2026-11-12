"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An endless, self-driven strip: two copies of the items slide by one copy's length on a
 * loop, so the motion never jumps. It is not driven by scroll or touch. Hover pauses it,
 * and the pause button stops it for good (WCAG 2.2.2). The second copy is hidden from
 * assistive tech. Reduced motion leaves it still.
 */
export function Marquee({
  children,
  label,
  duration = 40,
  reverse = false,
  vertical = false,
  fade = true,
  controls = true,
  className,
  trackClassName,
}: {
  children: React.ReactNode;
  label: string;
  duration?: number;
  reverse?: boolean;
  vertical?: boolean;
  fade?: boolean;
  controls?: boolean;
  className?: string;
  trackClassName?: string;
}) {
  const [paused, setPaused] = React.useState(false);
  const style = {
    "--marquee-name": vertical ? "marquee-y" : "marquee-x",
    "--marquee-duration": `${duration}s`,
    "--marquee-direction": reverse ? "reverse" : "normal",
  } as React.CSSProperties;

  return (
    <div
      role="region"
      aria-label={label}
      data-paused={paused || undefined}
      className={cn("marquee group/marquee relative overflow-hidden", fade && (vertical ? "marquee-fade-y" : "marquee-fade-x"), className)}
    >
      <div style={style} className={cn("marquee-track flex w-max", vertical && "w-auto flex-col", trackClassName)}>
        <div className={cn("flex shrink-0", vertical && "flex-col")}>{children}</div>
        <div aria-hidden="true" inert className={cn("flex shrink-0", vertical && "flex-col")}>
          {children}
        </div>
      </div>
      {controls && (
        <button
          type="button"
          aria-pressed={paused}
          aria-label={paused ? `Play ${label}` : `Pause ${label}`}
          onClick={() => setPaused((p) => !p)}
          className="mi-press absolute bottom-3 right-[max(1.25rem,calc((100vw_-_1120px)/2_+_2rem))] z-10 grid size-10 place-items-center rounded-full bg-white/90 text-[#0A0A0A] ring-1 ring-black/[0.08] backdrop-blur transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/marquee:opacity-100"
        >
          {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
