import * as React from "react";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

/**
 * A window onto the logged-in product: navy with the product's own hairlines,
 * so the real components inside render exactly as they do in the app. The bar names the
 * screen and says the data is a demo. Positioned so it also clips absolute descendants
 * (screen-reader-only chart tables) on narrow screens.
 */
export function ProductFrame({ path, caption, children, className }: { path: string; caption: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("relative min-w-0 overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#0F1B3D]", className)}>
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-3">
        <span aria-hidden="true" className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-white/[0.14]" />
          ))}
        </span>
        <span className="min-w-0 truncate font-mono text-[12px] text-[#8E9AC0]" translate="no">
          {path}
        </span>
        <span className="flex-1" />
        <span className={cn(TICK, "shrink-0 text-[11px] text-[#8E9AC0]")}>Demo data</span>
      </div>
      <div className="space-y-5 p-3 sm:p-5">{children}</div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
