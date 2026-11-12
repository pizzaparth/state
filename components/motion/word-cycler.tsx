"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One word slot that cycles through a list: the current word slides up and out while the
 * next rises in. Screen readers get the first word only. Reduced motion keeps it still.
 */
export function WordCycler({ words, interval = 2400, className }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = React.useState(0);
  const [prev, setPrev] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        setPrev(i);
        return (i + 1) % words.length;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  // The slot is as wide as the longest word so the line never jumps
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <span className={cn("relative inline-block overflow-hidden pb-[0.1em] align-bottom", className)}>
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden="true" className="invisible">
        {longest}
      </span>
      {prev !== null && (
        <span key={`out-${prev}-${index}`} aria-hidden="true" className="cycle-out absolute inset-x-0 top-0 text-left">
          {words[prev]}
        </span>
      )}
      <span key={`in-${index}`} aria-hidden="true" className={cn("absolute inset-x-0 top-0 text-left", prev !== null && "cycle-in")}>
        {words[index]}
      </span>
      <span aria-hidden="true" className="underline-sweep absolute left-0 right-[8%] bottom-[0.06em] h-[0.07em] rounded-full bg-accent" />
    </span>
  );
}
