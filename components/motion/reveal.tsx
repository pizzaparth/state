"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "up" | "scale" | "left" | "right" | "group" | "none";

/**
 * Reveals its content when it scrolls into view. Server HTML is visible as-is; after
 * hydration, anything still below the fold is hidden ("waiting") and animates in ("in")
 * the first time it crosses into view. Reduced motion leaves everything visible.
 */
export function Reveal({
  as: Tag = "div",
  variant = "up",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: React.ElementType;
  variant?: Variant;
  delay?: number;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = React.useRef<HTMLElement>(null);
  const [state, setState] = React.useState<"static" | "waiting" | "in">("static");

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen
    setState("waiting");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-rv={state}
      className={cn("rv", variant === "group" ? "rv-group" : variant !== "none" && `rv-${variant}`, className)}
      style={delay ? ({ "--rv-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
